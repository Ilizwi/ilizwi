"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import {
  translateWithClaude,
  CLAUDE_PROVIDER_NAME,
} from "@/lib/translation/claude-translate";
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

const GOOGLE_PROVIDER = "google_cloud_translation";

export async function generateClaudeTranslation(
  _prevState: GenerateResult | null,
  formData: FormData
): Promise<GenerateResult> {
  const profile = await requireAuth();
  const supabase = await createClient();

  // 1. Parse inputs
  const recordId = ((formData.get("recordId") as string) ?? "").trim();
  if (!recordId) return { error: "Record ID is required." };

  // 2. Resolve project_id from record — server-derived, no client trust
  const { data: record } = await supabase
    .from("source_records")
    .select("id, project_id")
    .eq("id", recordId)
    .single();

  if (!record) return { error: "Record not found." };
  const projectId = record.project_id;

  // 3. Permission check — membership-only (matches F013 boundary)
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

  // 5. Compute active layers (exclude superseded)
  const supersededIds = new Set(
    layers
      .map((l) => l.supersedes_layer_id)
      .filter(Boolean) as string[]
  );
  const activeLayers = layers.filter((l) => !supersededIds.has(l.id));

  // 6. Idempotency guard — block if Claude MT layer already exists
  const hasClaudeMt = activeLayers.some(
    (l) =>
      l.layer_type === "machine_translation" &&
      l.translation_provider === CLAUDE_PROVIDER_NAME
  );
  if (hasClaudeMt) {
    return {
      error: "A Claude translation draft already exists for this record.",
    };
  }

  // 7. Require an existing Google MT layer — escalation only makes sense after Google MT
  const googleMtLayer = activeLayers.find(
    (l) =>
      l.layer_type === "machine_translation" &&
      l.translation_provider === GOOGLE_PROVIDER
  );
  if (!googleMtLayer) {
    return {
      error: "Generate a Google machine translation draft first before escalating to Claude.",
    };
  }

  // 8. Select source layer by priority: corrected_transcription > source_transcription > source_ocr
  let sourceLayer: TextLayer | null = null;
  for (const layerType of ELIGIBLE_LAYER_TYPES as readonly EligibleLayerType[]) {
    const candidate = activeLayers.find((l) => l.layer_type === layerType);
    if (candidate) {
      sourceLayer = candidate;
      break;
    }
  }

  if (!sourceLayer) {
    return { error: "No eligible text layer available for translation." };
  }

  // 9. Infer target language from existing Google MT layer
  const targetLanguage = googleMtLayer.language;
  if (!targetLanguage) {
    return { error: "Could not determine target language from existing Google translation." };
  }

  // 10. Call Claude translation
  const result = await translateWithClaude(
    sourceLayer.content,
    sourceLayer.language,
    targetLanguage
  );

  if (!result.ok) return { error: result.error };

  // 11. Insert new machine_translation layer (Claude)
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
      translation_provider: CLAUDE_PROVIDER_NAME,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (insertError || !newLayer) {
    return { error: "Failed to save Claude translation layer." };
  }

  // 12. Audit log — reuse generate_translation action type, distinguish via metadata
  await insertAuditLog({
    projectId,
    actorId: profile.id,
    actionType: "generate_translation",
    recordId,
    metadata: {
      layerId: newLayer.id,
      targetLanguage,
      provider: CLAUDE_PROVIDER_NAME,
    },
  });

  // 13. Revalidate record page
  revalidatePath(`/projects/${projectId}/records/${recordId}`);

  return { data: { layerId: newLayer.id } };
}
