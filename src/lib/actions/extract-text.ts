"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractTextFromBuffer } from "@/lib/sources/text-extractor";
import { insertAuditLog } from "@/lib/audit/log";

// Note: super_admin bypass is intentionally absent here.
// SELECT policies on source_records, file_assets, text_layers, and storage.objects
// are all membership-only — a super_admin who is not a project member cannot read the
// record or its assets, so allowing them through the app-layer check would cause
// "Record not found" immediately after. The action boundary must match the DB boundary.
async function assertLayerPermission(
  supabase: SupabaseClient,
  projectId: string,
  callerId: string
): Promise<string | null> {
  const { data: membership } = await supabase
    .from("project_memberships")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", callerId)
    .single();

  if (!membership) return "Not a member of this project";
  if (!["project_admin", "researcher"].includes(membership.role)) {
    return "Insufficient permissions";
  }
  return null;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function extractTextFromRecord(
  _prevState: { error: string | null; layerId?: string },
  formData: FormData
): Promise<{ error: string | null; layerId?: string }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const recordId = (formData.get("recordId") as string)?.trim();
  if (!recordId) return { error: "Record ID is required" };

  // Derive projectId from record — never trust client-supplied value
  const { data: record } = await supabase
    .from("source_records")
    .select("project_id")
    .eq("id", recordId)
    .single();
  if (!record) return { error: "Record not found" };
  const projectId = record.project_id;

  const permError = await assertLayerPermission(supabase, projectId, profile.id);
  if (permError) return { error: permError };

  // V1 rule: pick first uploaded PDF with a storage_path (manually uploaded only)
  const { data: assets } = await supabase
    .from("file_assets")
    .select("id, storage_path, mime_type")
    .eq("record_id", recordId)
    .eq("mime_type", "application/pdf")
    .not("storage_path", "is", null)
    .order("uploaded_at", { ascending: true })
    .limit(2);

  if ((assets?.length ?? 0) > 1) {
    console.log(
      `[extractTextFromRecord] record=${recordId} has ${assets!.length} PDF assets — using first only (V1)`
    );
  }

  const asset = assets?.[0] ?? null;
  if (!asset?.storage_path) {
    return {
      error:
        "No locally-uploaded PDF found on this record. Only uploaded PDF files support text extraction in V1.",
    };
  }

  // Download from Supabase storage
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("archive-files")
    .download(asset.storage_path);

  if (downloadError || !fileBlob) {
    console.error("[extractTextFromRecord] download failed:", downloadError);
    return { error: "File download failed. Please try again or contact support." };
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const extractResult = await extractTextFromBuffer(buffer, "application/pdf");

  if (!extractResult.ok) {
    if (extractResult.reason === "empty_content") {
      return {
        error:
          "The PDF contains no extractable text. It may be a scanned image — add text manually using the form below.",
      };
    }
    // parse_error or unsupported_mime_type (shouldn't happen given mime check above)
    return { error: "Text extraction failed. The file may be corrupted or unsupported." };
  }

  // Content-hash no-op: if latest source_ocr/file_extract layer has identical content, skip insert
  const { data: existingLayers } = await supabase
    .from("text_layers")
    .select("id, content")
    .eq("record_id", recordId)
    .eq("layer_type", "source_ocr")
    .eq("source_method", "file_extract")
    .order("created_at", { ascending: false })
    .limit(1);

  const latestLayer = existingLayers?.[0] ?? null;
  if (latestLayer && sha256(latestLayer.content) === sha256(extractResult.text)) {
    console.log(
      `[extractTextFromRecord] content unchanged — returning existing layer ${latestLayer.id}`
    );
    return { error: null, layerId: latestLayer.id };
  }

  const supersedes_layer_id = latestLayer?.id ?? null;

  const { data: row, error: insertError } = await supabase
    .from("text_layers")
    .insert({
      record_id: recordId,
      layer_type: "source_ocr",
      content: extractResult.text,
      language: null,
      status: "raw",
      source_method: "file_extract",
      supersedes_layer_id,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[extractTextFromRecord] insert failed:", insertError);
    return { error: "Failed to save text layer. Please try again." };
  }

  console.log(
    `[extractTextFromRecord] actor=${profile.id} record=${recordId} project=${projectId} layer=${row.id} supersedes=${supersedes_layer_id ?? "none"}`
  );

  await insertAuditLog({
    projectId,
    actorId: profile.id,
    actionType: "extract_text",
    recordId,
    metadata: { layerId: row.id, layerType: "source_ocr" },
  });

  revalidatePath(`/projects/${projectId}/records/${recordId}`);
  return { error: null, layerId: row.id };
}
