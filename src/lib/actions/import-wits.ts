"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  generateCanonicalRef,
  appendCollisionSuffix,
  MAX_COLLISION_RETRIES,
} from "@/lib/records/canonical-ref";
import { fetchWitsItem, validateWitsRef, normalizeWitsRef } from "@/lib/sources/wits";
import { insertAuditLog } from "@/lib/audit/log";

// --- Permission guard (mirrors assertImportPermission in import-nlsa.ts exactly) ---

async function assertImportPermission(
  supabase: SupabaseClient,
  projectId: string,
  callerId: string
): Promise<string | null> {
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("global_role")
    .eq("id", callerId)
    .single();

  if (callerProfile?.global_role === "super_admin") return null;

  const { data: membership } = await supabase
    .from("project_memberships")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", callerId)
    .single();

  if (!membership) return "Not a member of this project";
  if (!["project_admin", "researcher"].includes(membership.role)) {
    return "Insufficient permissions — only project admins and researchers can import records";
  }
  return null;
}

// --- Error message mapping for Wits OAI-PMH errors ---

function witsErrorMessage(
  error: { type: string; message?: string },
  ref: string
): string {
  switch (error.type) {
    case "not_found":
      return `Wits record ${ref} was not found. Check the OAI identifier and try again.`;
    case "timeout":
      return "Wits Research Archives did not respond in time. Try again shortly.";
    default:
      return `Could not reach the Wits Research Archives OAI endpoint: ${(error as { message?: string }).message ?? "unknown error"}`;
  }
}

// --- Server action ---

export async function importFromWits(
  _prevState: { error: string | null; recordId?: string },
  formData: FormData
): Promise<{ error: string | null; recordId?: string }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const projectId = (formData.get("projectId") as string)?.trim();
  const witsRef = ((formData.get("witsRef") as string) ?? "").trim();

  if (!projectId) return { error: "Project ID is required" };

  // Validate OAI identifier format (both short and long forms accepted)
  if (!validateWitsRef(witsRef)) {
    return {
      error:
        "Enter a valid Wits OAI identifier. Accepted formats: oai:researcharchives.wits.ac.za:{id} or oai:researcharchives.wits.ac.za:443:{id}",
    };
  }

  // Normalise to canonical long form before idempotency check and storage.
  // Both input forms map to the same stored identifier, preventing duplicates.
  const canonicalRef = normalizeWitsRef(witsRef);

  // Permission check (server-side — not UI-only)
  const permError = await assertImportPermission(supabase, projectId, profile.id);
  if (permError) return { error: permError };

  // Idempotency check — use normalized identifier so both input forms resolve to same record
  const { data: existing } = await supabase
    .from("source_records")
    .select("id")
    .eq("project_id", projectId)
    .eq("source_type", "wits")
    .eq("source_identifier", canonicalRef)
    .maybeSingle();
  if (existing) return { error: null, recordId: existing.id };

  // Fetch from Wits OAI-PMH endpoint (use normalized ref for the OAI request)
  const itemResult = await fetchWitsItem(canonicalRef);
  if (!itemResult.ok) {
    return { error: witsErrorMessage(itemResult.error, canonicalRef) };
  }

  const mapped = itemResult.data;

  // Date validation — require a parseable year at minimum
  // date_extracted is synthesised to YYYY-01-01 if only a year range is present.
  // Reject only if no year could be extracted at all.
  if (!mapped.date_extracted) {
    return {
      error:
        "This Wits record has no parseable date. A year is required.",
    };
  }

  // Generate canonical record ref using synthesised date
  const baseRecordRef = generateCanonicalRef({
    source_type: "wits",
    publication_title: mapped.title,
    date_issued: mapped.date_extracted,
    volume: null,
    issue_number: null,
  });

  const recordId = crypto.randomUUID();

  // Insert source_records with canonical ref collision retry.
  // Collision on canonical_ref is expected for Wits records with date ranges
  // (multiple records for the same publication+year produce identical refs).
  // The retry loop (r2–r9) handles this correctly.
  let recordRef = baseRecordRef;
  let recordError: { message: string; code?: string } | null = null;
  for (let attempt = 1; attempt <= MAX_COLLISION_RETRIES; attempt++) {
    recordRef = attempt === 1 ? baseRecordRef : appendCollisionSuffix(baseRecordRef, attempt);
    const { error } = await supabase.from("source_records").insert({
      id: recordId,
      project_id: projectId,
      source_type: "wits",
      source_archive: "Wits",
      source_identifier: canonicalRef,     // normalised OAI identifier
      source_url: mapped.landing_url,      // first landing-page URL from dc:identifier (provenance)
      publication_title: mapped.title,
      language: mapped.language ?? "und",
      date_issued: mapped.date_extracted,
      date_issued_raw: mapped.date_raw,    // verbatim dc:date — provenance preserved
      volume: null,
      issue_number: null,
      canonical_ref: recordRef,
      created_by: profile.id,
    });
    if (!error) { recordError = null; break; }
    if ((error as { code?: string }).code !== "23505") { recordError = error; break; }
    if (error.message?.includes("source_records_project_source_dedup_idx")) {
      return { error: "This Wits item has already been imported into this project." };
    }
    // canonical_ref collision — continue retry loop (expected for Wits date ranges)
    recordError = error;
  }
  if (recordError) {
    if ((recordError as { code?: string }).code === "23505") {
      return {
        error:
          "A record with this metadata already exists. This Wits item may have already been imported.",
      };
    }
    return { error: `Record creation failed: ${recordError.message}` };
  }

  // Insert file_assets only if a file URL was detected in dc:identifier.
  // If no file URL is present this is a metadata-only import — skip asset entirely.
  if (mapped.file_url !== null) {
    const filename = mapped.file_url.split("/").pop() ?? `wits-${recordId}`;
    const lc = filename.toLowerCase();
    const mimeType = lc.endsWith(".pdf")
      ? "application/pdf"
      : lc.endsWith(".png")
      ? "image/png"
      : lc.match(/\.(jpg|jpeg)$/)
      ? "image/jpeg"
      : lc.match(/\.(tiff|tif)$/)
      ? "image/tiff"
      : null;

    const { error: assetError } = await supabase.from("file_assets").insert({
      record_id: recordId,
      asset_type: "source_file",
      storage_path: null,
      source_url: mapped.file_url,
      original_filename: filename,
      mime_type: mimeType,
      size_bytes: null,
      is_original: true,
      uploaded_by: profile.id,
    });
    if (assetError) {
      await supabase.from("source_records").delete().eq("id", recordId);
      return {
        error:
          "Import failed: could not register file reference. No record was saved.",
      };
    }
  }

  // No text_layers insert — Wits is metadata-only; OAI-DC carries no OCR text.

  console.log(
    `[importFromWits] actor=${profile.id} wits_ref=${canonicalRef} record=${recordId} ref=${recordRef} project=${projectId}`
  );

  await insertAuditLog({
    projectId,
    actorId: profile.id,
    actionType: "import_wits",
    recordId,
    metadata: { canonicalRef: recordRef, sourceIdentifier: canonicalRef },
  });

  revalidatePath(`/projects/${projectId}/records`);
  return { error: null, recordId };
}
