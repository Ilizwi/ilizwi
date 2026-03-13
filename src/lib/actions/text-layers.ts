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
  const projectId = formData.get("projectId") as string;
  const layerType = formData.get("layerType") as string;
  const content = ((formData.get("content") as string) ?? "").trim();
  const languageRaw = ((formData.get("language") as string) ?? "").trim();
  const language = languageRaw || null;
  const sourceMethod = (formData.get("sourceMethod") as string) || "manual_entry";

  // Validation
  if (!recordId) return { error: "Record ID is required" };
  if (!content) return { error: "Content is required" };
  if (!VALID_LAYER_TYPES.includes(layerType as (typeof VALID_LAYER_TYPES)[number])) {
    return { error: "Invalid layer type" };
  }

  // Permission check
  const permError = await assertLayerPermission(supabase, projectId, profile.id);
  if (permError) return { error: permError };

  // Insert text layer
  const { data: row, error } = await supabase
    .from("text_layers")
    .insert({
      record_id: recordId,
      layer_type: layerType,
      content,
      language,
      status: "raw",
      source_method: sourceMethod,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error) return { error: `Layer creation failed: ${error.message}` };

  console.log(
    `[addTextLayer] actor=${profile.id} added layer=${row.id} type=${layerType} to record=${recordId} project=${projectId}`
  );

  revalidatePath(`/projects/${projectId}/records/${recordId}`);
  return { error: null };
}
