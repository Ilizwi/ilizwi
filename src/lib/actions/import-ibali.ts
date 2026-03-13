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
  fetchIbaliItem,
  fetchIbaliMedia,
  mapIbaliItem,
  extractMediaRefs,
} from "@/lib/sources/ibali";

// --- Permission guard (mirrors assertUploadPermission in records.ts exactly) ---

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

// --- Error message mapping for Ibali API errors ---

function ibaliErrorMessage(
  error: { type: string; message?: string },
  itemId: string
): string {
  switch (error.type) {
    case "not_found":
      return `Ibali item ${itemId} was not found. Check the item ID and try again.`;
    case "timeout":
      return "Ibali API did not respond in time. Try again shortly.";
    default:
      return `Could not reach the Ibali API: ${(error as { message?: string }).message ?? "unknown error"}`;
  }
}

// --- Server action ---

export async function importFromIbali(
  _prevState: { error: string | null; recordId?: string },
  formData: FormData
): Promise<{ error: string | null; recordId?: string }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const projectId = (formData.get("projectId") as string)?.trim();
  const rawInput = ((formData.get("ibali_item_id") as string) ?? "").trim();

  if (!projectId) return { error: "Project ID is required" };

  // Permission check (server-side — not UI-only)
  const permError = await assertImportPermission(supabase, projectId, profile.id);
  if (permError) return { error: permError };

  // Parse item ID — accept raw number or full URL (extract trailing digits)
  const idMatch = rawInput.match(/(\d+)\/?$/);
  const itemId = idMatch ? idMatch[1] : null;
  if (!itemId) {
    return { error: "Enter a valid Ibali item ID (e.g. 180673) or full Ibali item URL" };
  }

  // Idempotency check — return existing record if already imported
  const { data: existing } = await supabase
    .from("source_records")
    .select("id")
    .eq("project_id", projectId)
    .eq("source_type", "ibali")
    .eq("source_identifier", itemId)
    .maybeSingle();
  if (existing) return { error: null, recordId: existing.id };

  // Fetch from Ibali API
  const itemResult = await fetchIbaliItem(itemId);
  if (!itemResult.ok) return { error: ibaliErrorMessage(itemResult.error, itemId) };

  const mediaResult = await fetchIbaliMedia(itemId);
  if (!mediaResult.ok) return { error: ibaliErrorMessage(mediaResult.error, itemId) };

  const mapped = mapIbaliItem(itemResult.data);
  const refs = extractMediaRefs(mediaResult.data);

  // Require a real date from the source — do not synthesize one
  if (!mapped.date_issued) {
    return {
      error: `Ibali item ${itemId} does not include a date (dcterms:date). Cannot create a canonical record without an issue date.`,
    };
  }

  // Generate canonical ref
  const baseRef = generateCanonicalRef({
    source_type: "ibali",
    publication_title: mapped.publication_title,
    date_issued: mapped.date_issued,
    volume: mapped.volume,
    issue_number: mapped.issue_number,
  });

  const recordId = crypto.randomUUID();
  const sourceUrl = `https://ibali.uct.ac.za/items/${itemId}`;

  // Insert source_records with canonical ref collision retry
  let canonicalRef = baseRef;
  let recordError: { message: string; code?: string } | null = null;
  for (let attempt = 1; attempt <= MAX_COLLISION_RETRIES; attempt++) {
    canonicalRef = attempt === 1 ? baseRef : appendCollisionSuffix(baseRef, attempt);
    const { error } = await supabase.from("source_records").insert({
      id: recordId,
      project_id: projectId,
      source_type: "ibali",
      source_archive: "UCT Ibali",
      source_identifier: itemId,
      source_url: sourceUrl,
      publication_title: mapped.publication_title,
      language: mapped.language ?? "und",
      date_issued: mapped.date_issued,
      volume: mapped.volume,
      issue_number: mapped.issue_number,
      canonical_ref: canonicalRef,
      created_by: profile.id,
    });
    if (!error) { recordError = null; break; }
    if ((error as { code?: string }).code !== "23505") { recordError = error; break; }
    // Check if the 23505 is on the dedup index (not canonical_ref)
    if (error.message?.includes("source_records_project_source_dedup_idx")) {
      return { error: "This Ibali item has already been imported into this project." };
    }
    recordError = error;
  }
  if (recordError) {
    if ((recordError as { code?: string }).code === "23505") {
      return { error: "A record with this metadata already exists. This Ibali item may have already been imported." };
    }
    return { error: `Record creation failed: ${recordError.message}` };
  }

  // Insert file_assets (external URL references, storage_path=null)
  const insertedAssetIds: string[] = [];
  for (const ref of refs) {
    const filename = ref.originalUrl.split("/").pop() ?? "ibali-file";
    const { data: asset, error: assetError } = await supabase
      .from("file_assets")
      .insert({
        record_id: recordId,
        asset_type: "transcription_file",
        storage_path: null,
        source_url: ref.originalUrl,
        original_filename: filename,
        mime_type: null,
        size_bytes: null,
        is_original: true,
        uploaded_by: profile.id,
      })
      .select("id")
      .single();
    if (assetError) {
      // Compensate: delete the source record
      await supabase.from("source_records").delete().eq("id", recordId);
      return { error: "Import failed: could not register file reference. No record was saved." };
    }
    insertedAssetIds.push(asset.id);
  }

  // Insert text_layers for extracted transcription text
  for (const ref of refs) {
    if (!ref.extractedText) continue;
    const { error: layerError } = await supabase.from("text_layers").insert({
      record_id: recordId,
      layer_type: "source_transcription",
      content: ref.extractedText,
      language: mapped.language ?? null,
      status: "raw",
      source_method: "api_import",
      created_by: profile.id,
    });
    if (layerError) {
      // Compensate: delete file_assets and source_record
      if (insertedAssetIds.length > 0) {
        await supabase.from("file_assets").delete().in("id", insertedAssetIds);
      }
      await supabase.from("source_records").delete().eq("id", recordId);
      return { error: "Import failed: could not save transcription layer. No record was saved." };
    }
  }

  console.log(
    `[importFromIbali] actor=${profile.id} ibali_item=${itemId} record=${recordId} ref=${canonicalRef} project=${projectId}`
  );

  revalidatePath(`/projects/${projectId}/records`);
  return { error: null, recordId };
}
