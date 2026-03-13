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
import {
  fetchNlsaItem,
  mapNlsaItem,
  extractNlsaRefs,
} from "@/lib/sources/nlsa";

const NLSA_BASE = "https://cdm21048.contentdm.oclc.org";

// --- Permission guard (mirrors assertImportPermission in import-ibali.ts exactly) ---

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

// --- Error message mapping for NLSA API errors ---

function nlsaErrorMessage(
  error: { type: string; message?: string },
  ref: string
): string {
  switch (error.type) {
    case "not_found":
      return `NLSA item ${ref} was not found. Check the alias and item ID and try again.`;
    case "timeout":
      return "NLSA ContentDM API did not respond in time. Try again shortly.";
    default:
      return `Could not reach the NLSA ContentDM API: ${(error as { message?: string }).message ?? "unknown error"}`;
  }
}

// --- Date validation ---
// Accept YYYY, YYYY-MM, or YYYY-MM-DD. Reject anything else.
const ISO_DATE_PATTERN = /^\d{4}(-\d{2}(-\d{2})?)?$/;

function validateNlsaDate(
  dateRaw: string | null,
  ref: string
): { valid: true; date: string } | { valid: false; error: string } {
  if (!dateRaw) {
    return {
      valid: false,
      error: `NLSA item ${ref} does not include a date. Cannot create a canonical record without an issue date.`,
    };
  }
  if (!ISO_DATE_PATTERN.test(dateRaw)) {
    return {
      valid: false,
      error: `NLSA item ${ref} has a date in an unrecognised format ("${dateRaw}"). Acceptable formats are YYYY, YYYY-MM, or YYYY-MM-DD. Cannot create a canonical record without a parseable date.`,
    };
  }
  return { valid: true, date: dateRaw };
}

// --- nlsa_ref parser ---
// Accepts exactly:
//   1. "{alias}/{id}"  e.g. "p21048coll37/1"
//   2. Full ContentDM URL: "https://cdm21048.contentdm.oclc.org/digital/collection/{alias}/id/{id}"
// Returns { alias, id } with alias normalised to lowercase, or null on mismatch.

const CONTENTDM_URL_PATTERN =
  /^https:\/\/cdm21048\.contentdm\.oclc\.org\/digital\/collection\/([A-Za-z0-9]+)\/id\/(\d+)\/?$/;
const SHORTHAND_PATTERN = /^([A-Za-z0-9]+)\/(\d+)$/;

function parseNlsaRef(
  input: string
): { alias: string; id: string } | null {
  const urlMatch = input.match(CONTENTDM_URL_PATTERN);
  if (urlMatch) {
    return { alias: urlMatch[1].toLowerCase(), id: urlMatch[2] };
  }
  const shortMatch = input.match(SHORTHAND_PATTERN);
  if (shortMatch) {
    return { alias: shortMatch[1].toLowerCase(), id: shortMatch[2] };
  }
  return null;
}

// --- Server action ---

export async function importFromNlsa(
  _prevState: { error: string | null; recordId?: string },
  formData: FormData
): Promise<{ error: string | null; recordId?: string }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const projectId = (formData.get("projectId") as string)?.trim();
  const rawInput = ((formData.get("nlsa_ref") as string) ?? "").trim();

  if (!projectId) return { error: "Project ID is required" };

  // Permission check (server-side — not UI-only)
  const permError = await assertImportPermission(supabase, projectId, profile.id);
  if (permError) return { error: permError };

  // Parse nlsa_ref — strict contract, two accepted formats only
  const parsed = parseNlsaRef(rawInput);
  if (!parsed) {
    return {
      error:
        'Enter a valid NLSA reference. Accepted formats: "p21048coll37/1" or a full ContentDM URL (https://cdm21048.contentdm.oclc.org/digital/collection/{alias}/id/{id}).',
    };
  }
  const { alias, id: itemId } = parsed;
  const sourceIdentifier = `${alias}/${itemId}`;

  // Idempotency check — return existing record if already imported
  const { data: existing } = await supabase
    .from("source_records")
    .select("id")
    .eq("project_id", projectId)
    .eq("source_type", "nlsa")
    .eq("source_identifier", sourceIdentifier)
    .maybeSingle();
  if (existing) return { error: null, recordId: existing.id };

  // Fetch from NLSA ContentDM API
  const itemResult = await fetchNlsaItem(alias, itemId);
  if (!itemResult.ok) {
    return { error: nlsaErrorMessage(itemResult.error, sourceIdentifier) };
  }

  const mapped = mapNlsaItem(itemResult.data);
  const refs = extractNlsaRefs(alias, itemId, itemResult.data);

  // Validate date — reject missing or non-parseable dates
  const dateCheck = validateNlsaDate(mapped.date_issued, sourceIdentifier);
  if (!dateCheck.valid) return { error: dateCheck.error };

  // Generate canonical ref
  const baseRef = generateCanonicalRef({
    source_type: "nlsa",
    publication_title: mapped.publication_title,
    date_issued: dateCheck.date,
    volume: null,
    issue_number: null,
  });

  const recordId = crypto.randomUUID();
  const sourceUrl = `${NLSA_BASE}/digital/collection/${alias}/id/${itemId}`;

  // Insert source_records with canonical ref collision retry
  let canonicalRef = baseRef;
  let recordError: { message: string; code?: string } | null = null;
  for (let attempt = 1; attempt <= MAX_COLLISION_RETRIES; attempt++) {
    canonicalRef = attempt === 1 ? baseRef : appendCollisionSuffix(baseRef, attempt);
    const { error } = await supabase.from("source_records").insert({
      id: recordId,
      project_id: projectId,
      source_type: "nlsa",
      source_archive: "NLSA",
      source_identifier: sourceIdentifier,
      source_url: sourceUrl,
      publication_title: mapped.publication_title,
      language: mapped.language ?? "und",
      date_issued: dateCheck.date,
      volume: null,
      issue_number: null,
      canonical_ref: canonicalRef,
      created_by: profile.id,
    });
    if (!error) { recordError = null; break; }
    if ((error as { code?: string }).code !== "23505") { recordError = error; break; }
    if (error.message?.includes("source_records_project_source_dedup_idx")) {
      return { error: "This NLSA item has already been imported into this project." };
    }
    recordError = error;
  }
  if (recordError) {
    if ((recordError as { code?: string }).code === "23505") {
      return { error: "A record with this metadata already exists. This NLSA item may have already been imported." };
    }
    return { error: `Record creation failed: ${recordError.message}` };
  }

  // Insert file_assets (PDF URL reference — storage_path null, source_url set)
  const { data: asset, error: assetError } = await supabase
    .from("file_assets")
    .insert({
      record_id: recordId,
      asset_type: "source_file",
      storage_path: null,
      source_url: refs.pdfUrl,
      original_filename: `nlsa-${alias}-${itemId}.pdf`,
      mime_type: "application/pdf",
      size_bytes: null,
      is_original: true,
      uploaded_by: profile.id,
    })
    .select("id")
    .single();
  if (assetError) {
    await supabase.from("source_records").delete().eq("id", recordId);
    return { error: "Import failed: could not register PDF file reference. No record was saved." };
  }

  // Insert text_layers for OCR text (if present)
  if (refs.ocrText) {
    const { error: layerError } = await supabase.from("text_layers").insert({
      record_id: recordId,
      layer_type: "source_ocr",
      content: refs.ocrText,
      language: mapped.language ?? null,
      status: "raw",
      source_method: "api_import",
      created_by: profile.id,
    });
    if (layerError) {
      await supabase.from("file_assets").delete().eq("id", asset.id);
      await supabase.from("source_records").delete().eq("id", recordId);
      return { error: "Import failed: could not save OCR text layer. No record was saved." };
    }
  }

  console.log(
    `[importFromNlsa] actor=${profile.id} nlsa_ref=${sourceIdentifier} record=${recordId} ref=${canonicalRef} project=${projectId}`
  );

  revalidatePath(`/projects/${projectId}/records`);
  return { error: null, recordId };
}
