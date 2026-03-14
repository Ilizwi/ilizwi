"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import {
  translateWithGoogle,
  TARGET_LANGUAGE_ALLOWLIST,
  PROVIDER_NAME,
  type TargetLanguage,
} from "@/lib/translation/google-translate";
import type { TextLayer } from "@/types";
import { insertAuditLog } from "@/lib/audit/log";

type GenerateResult =
  | { data: { layerId: string } }
  | { error: string };

const ELIGIBLE_LAYER_TYPES = [
  "corrected_transcription",
  "source_transcription",
  "source_ocr",
] as const;

type EligibleLayerType = (typeof ELIGIBLE_LAYER_TYPES)[number];

export async function generateMachineTranslation(
  _prevState: GenerateResult | null,
  formData: FormData
): Promise<GenerateResult> {
  const profile = await requireAuth();
  const supabase = await createClient();

  // 1. Parse + validate inputs
  const recordId = ((formData.get("recordId") as string) ?? "").trim();
  const targetLanguageRaw = ((formData.get("targetLanguage") as string) ?? "en").trim();

  if (!recordId) return { error: "Record ID is required." };

  if (!TARGET_LANGUAGE_ALLOWLIST.includes(targetLanguageRaw as TargetLanguage)) {
    return { error: `Invalid target language: "${targetLanguageRaw}". Supported: ${TARGET_LANGUAGE_ALLOWLIST.join(", ")}.` };
  }
  const targetLanguage = targetLanguageRaw as TargetLanguage;

  // 2. Resolve project_id from record — server-derived, no client trust
  const { data: record } = await supabase
    .from("source_records")
    .select("id, project_id")
    .eq("id", recordId)
    .single();

  if (!record) return { error: "Record not found." };
  const projectId = record.project_id;

  // 3. Permission check — membership-only (no super_admin bypass)
  //    Matches text_layers SELECT/UPDATE policy boundary (F010/F012)
  const { data: membership } = await supabase
    .from("project_memberships")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", profile.id)
    .single();

  if (
    !membership ||
    !["project_admin", "researcher"].includes(membership.role)
  ) {
    return { error: "Permission denied." };
  }

  // 4. Fetch all text layers for the record
  const { data: textLayers, error: layersError } = await supabase
    .from("text_layers")
    .select("*")
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });

  if (layersError) return { error: "Failed to load text layers." };
  const layers = (textLayers ?? []) as TextLayer[];

  // 5. Compute superseded IDs
  const supersededIds = new Set(
    layers
      .map((l) => l.supersedes_layer_id)
      .filter(Boolean) as string[]
  );

  const activeLayers = layers.filter((l) => !supersededIds.has(l.id));

  // 6. Block if any active machine_translation layer exists (including manually created)
  const hasActiveMt = activeLayers.some(
    (l) => l.layer_type === "machine_translation"
  );
  if (hasActiveMt) {
    return {
      error:
        "An active machine translation draft already exists for this record. Regeneration is not available in this version.",
    };
  }

  // 7. Select source layer by priority: corrected_transcription > source_transcription > source_ocr
  //    Within each type: most recent active layer (ordered by created_at DESC already)
  let sourceLayer: TextLayer | null = null;
  for (const layerType of ELIGIBLE_LAYER_TYPES as readonly EligibleLayerType[]) {
    const candidate = activeLayers.find((l) => l.layer_type === layerType);
    if (candidate) {
      sourceLayer = candidate;
      break;
    }
  }

  if (!sourceLayer) {
    return {
      error: "No eligible text layer available for translation.",
    };
  }

  // 8. Validate API key
  if (!process.env.GOOGLE_TRANSLATE_API_KEY) {
    return { error: "Translation service is not configured." };
  }

  // 9. Call translation API
  const result = await translateWithGoogle(
    sourceLayer.content,
    sourceLayer.language,
    targetLanguage
  );

  if (!result.ok) return { error: result.error };

  // 10. Insert new machine_translation layer
  const { data: newLayer, error: insertError } = await supabase
    .from("text_layers")
    .insert({
      record_id: recordId,
      layer_type: "machine_translation",
      content: result.translation,
      language: targetLanguage,
      source_method: "api_import",
      status: "raw",
      source_layer_id: sourceLayer.id,
      translation_provider: PROVIDER_NAME,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (insertError || !newLayer) {
    return { error: "Failed to save machine translation layer." };
  }

  // 11. Audit log
  console.log("[audit] generate_machine_translation", {
    actor: profile.id,
    new_layer_id: newLayer.id,
    source_layer_id: sourceLayer.id,
    translation_provider: PROVIDER_NAME,
    record_id: recordId,
    project_id: projectId,
  });

  await insertAuditLog({
    projectId,
    actorId: profile.id,
    actionType: "generate_translation",
    recordId,
    metadata: { layerId: newLayer.id, targetLanguage, provider: PROVIDER_NAME },
  });

  // 12. Revalidate record page
  const { data: projectRecord } = await supabase
    .from("source_records")
    .select("project_id")
    .eq("id", recordId)
    .single();

  if (projectRecord) {
    revalidatePath(
      `/projects/${projectRecord.project_id}/records/${recordId}`
    );
  }

  // 13. Return success
  return { data: { layerId: newLayer.id } };
}
