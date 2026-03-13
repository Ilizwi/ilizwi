"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";

export async function saveTranslationCorrection(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  // 1. Parse + validate inputs
  const sourceLayerId = ((formData.get("sourceLayerId") as string) ?? "").trim();
  const content = ((formData.get("content") as string) ?? "").trim();

  if (!sourceLayerId || !content) {
    return { error: "Source layer ID and content are required." };
  }

  // 2. Fetch source layer — must be a machine_translation
  const { data: sourceLayer } = await supabase
    .from("text_layers")
    .select("id, record_id, layer_type, language")
    .eq("id", sourceLayerId)
    .single();

  if (!sourceLayer) return { error: "Source layer not found." };

  if (sourceLayer.layer_type !== "machine_translation") {
    return { error: "Source layer must be a machine translation." };
  }

  // 3. Verify the source MT layer is active (not superseded by another layer)
  const { count: supersedingCount } = await supabase
    .from("text_layers")
    .select("id", { count: "exact", head: true })
    .eq("supersedes_layer_id", sourceLayerId);

  if (supersedingCount && supersedingCount > 0) {
    return { error: "Source layer is superseded and cannot be corrected." };
  }

  // 5. Derive record and project — server-derived, no client trust
  const recordId = sourceLayer.record_id;
  const language = sourceLayer.language;

  const { data: record } = await supabase
    .from("source_records")
    .select("id, project_id")
    .eq("id", recordId)
    .single();

  if (!record) return { error: "Record not found." };
  const projectId = record.project_id;

  // 6. Permission check — membership-only
  const { data: membership } = await supabase
    .from("project_memberships")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", profile.id)
    .single();

  if (
    !membership ||
    !["project_admin", "researcher", "translator"].includes(membership.role)
  ) {
    return {
      error:
        "Insufficient permissions — project admins, researchers, and translators can correct translations.",
    };
  }

  // 7. Insert corrected_translation layer
  const { data: newLayer, error: insertError } = await supabase
    .from("text_layers")
    .insert({
      record_id: recordId,
      layer_type: "corrected_translation",
      content,
      language,
      status: "raw",
      source_method: "manual_entry",
      source_layer_id: sourceLayerId,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (insertError || !newLayer) {
    return { error: "Failed to save corrected translation layer." };
  }

  // 8. Audit log
  console.log("[audit] save_translation_correction", {
    actor: profile.id,
    new_layer_id: newLayer.id,
    source_layer_id: sourceLayerId,
    record_id: recordId,
    project_id: projectId,
  });

  // 9. Revalidate record page
  revalidatePath(`/projects/${projectId}/records/${recordId}`);

  return { error: null };
}
