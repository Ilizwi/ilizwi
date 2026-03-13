"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import type { SupabaseClient } from "@supabase/supabase-js";

const VALID_LAYER_TYPES = [
  "source_ocr",
  "source_transcription",
  "corrected_transcription",
  "normalized_orthography",
  "machine_translation",
  "corrected_translation",
] as const;

const VALID_CREATION_STATUSES = ["raw", "reviewed", "needs_expert_review"] as const;
const VALID_LAYER_STATUSES = ["raw", "reviewed", "approved", "uncertain", "needs_expert_review"] as const;

async function assertLayerPermission(
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
    return "Insufficient permissions — only project admins and researchers can add text layers";
  }
  return null;
}

export async function addTextLayer(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const recordId = formData.get("recordId") as string;
  const layerType = formData.get("layerType") as string;
  const content = ((formData.get("content") as string) ?? "").trim();
  const languageRaw = ((formData.get("language") as string) ?? "").trim();
  const language = languageRaw || null;
  const sourceMethod = (formData.get("sourceMethod") as string) || "manual_entry";
  const supersedesRaw = ((formData.get("supersedes_layer_id") as string) ?? "").trim();
  const supersedesLayerId = supersedesRaw || null;
  const statusRaw = ((formData.get("status") as string) ?? "").trim();

  // Validation
  if (!recordId) return { error: "Record ID is required" };
  if (!content) return { error: "Content is required" };
  if (!VALID_LAYER_TYPES.includes(layerType as (typeof VALID_LAYER_TYPES)[number])) {
    return { error: "Invalid layer type" };
  }

  // Derive projectId from the record — do not trust client-supplied projectId
  const { data: record } = await supabase
    .from("source_records")
    .select("project_id")
    .eq("id", recordId)
    .single();
  if (!record) return { error: "Record not found" };
  const projectId = record.project_id;

  // Permission check
  const permError = await assertLayerPermission(supabase, projectId, profile.id);
  if (permError) return { error: permError };

  // Validate supersedes_layer_id if provided
  if (supersedesLayerId) {
    const { data: supersededLayer } = await supabase
      .from("text_layers")
      .select("record_id, layer_type")
      .eq("id", supersedesLayerId)
      .single();
    if (!supersededLayer) return { error: "Superseded layer not found" };
    if (supersededLayer.record_id !== recordId) {
      return { error: "Superseded layer does not belong to this record" };
    }
    if (supersededLayer.layer_type !== layerType) {
      return { error: "Layer type mismatch — a version must have the same type as the layer it supersedes" };
    }
  }

  // Resolve status
  let status: string;
  if (!statusRaw) {
    status = "raw";
  } else if (!VALID_CREATION_STATUSES.includes(statusRaw as (typeof VALID_CREATION_STATUSES)[number])) {
    return { error: "Invalid status for layer creation" };
  } else {
    status = statusRaw;
  }

  // Insert text layer
  const { data: row, error } = await supabase
    .from("text_layers")
    .insert({
      record_id: recordId,
      layer_type: layerType,
      content,
      language,
      status,
      source_method: sourceMethod,
      created_by: profile.id,
      supersedes_layer_id: supersedesLayerId,
    })
    .select("id")
    .single();

  if (error) return { error: `Layer creation failed: ${error.message}` };

  console.log(
    `[addTextLayer] actor=${profile.id} added layer=${row.id} type=${layerType} to record=${recordId} project=${projectId}${supersedesLayerId ? ` supersedes=${supersedesLayerId}` : ""}`
  );

  revalidatePath(`/projects/${projectId}/records/${recordId}`);
  return { error: null };
}

export async function updateLayerStatus(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const layerId = (formData.get("layerId") as string ?? "").trim();
  const newStatus = (formData.get("newStatus") as string ?? "").trim();

  if (!layerId) return { error: "Layer ID is required" };
  if (!VALID_LAYER_STATUSES.includes(newStatus as (typeof VALID_LAYER_STATUSES)[number])) {
    return { error: "Invalid status value" };
  }

  // Derive record_id and project_id from DB — do not trust client-supplied routing context
  const { data: layerRow } = await supabase
    .from("text_layers")
    .select("record_id, source_records(project_id)")
    .eq("id", layerId)
    .single();

  if (!layerRow) return { error: "Layer not found" };
  const recordId = layerRow.record_id;
  const projectId = (layerRow.source_records as unknown as { project_id: string }).project_id;

  // Permission check
  const permError = await assertLayerPermission(supabase, projectId, profile.id);
  if (permError) return { error: permError };

  const { error } = await supabase
    .from("text_layers")
    .update({ status: newStatus })
    .eq("id", layerId);

  if (error) return { error: `Status update failed: ${error.message}` };

  console.log(
    `[updateLayerStatus] actor=${profile.id} layer=${layerId} status=${newStatus} record=${recordId} project=${projectId}`
  );

  revalidatePath(`/projects/${projectId}/records/${recordId}`);
  return { error: null };
}
