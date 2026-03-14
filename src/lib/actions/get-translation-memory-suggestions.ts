"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";

export type TranslationMemorySuggestion = {
  id: string;
  corrected_translation: string;
  machine_translation: string | null;
  source_segment: string;
  canonical_ref: string;
  created_at: string;
};

export async function getTranslationMemorySuggestions({
  mtLayerId,
  targetLanguage,
}: {
  mtLayerId: string;
  targetLanguage: string | null;
}): Promise<TranslationMemorySuggestion[]> {
  if (!mtLayerId || !targetLanguage) return [];

  try {
    await requireAuth();
    const supabase = await createClient();

    // 1. Fetch the MT layer to get source_layer_id and record_id
    const { data: mtLayer } = await supabase
      .from("text_layers")
      .select("id, record_id, source_layer_id")
      .eq("id", mtLayerId)
      .single();

    if (!mtLayer?.source_layer_id || !mtLayer?.record_id) return [];

    // 2. Fetch the source transcription layer to get source_segment
    const { data: sourceLayer } = await supabase
      .from("text_layers")
      .select("content")
      .eq("id", mtLayer.source_layer_id)
      .single();

    if (!sourceLayer?.content) return [];

    // 3. Fetch the record to get project_id
    const { data: record } = await supabase
      .from("source_records")
      .select("project_id")
      .eq("id", mtLayer.record_id)
      .single();

    if (!record?.project_id) return [];

    // 4. Query TM entries — exact match on (project_id, target_language, source_segment)
    const { data: entries } = await supabase
      .from("translation_memory_entries")
      .select(`
        id,
        corrected_translation,
        machine_translation,
        source_segment,
        created_at,
        source_records!created_from_record_id (
          canonical_ref
        )
      `)
      .eq("project_id", record.project_id)
      .eq("target_language", targetLanguage)
      .eq("source_segment", sourceLayer.content)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!entries) return [];

    type RawEntry = {
      id: string;
      corrected_translation: string;
      machine_translation: string | null;
      source_segment: string;
      created_at: string;
      source_records: { canonical_ref: string } | null;
    };

    return (entries as RawEntry[]).map((e) => ({
      id: e.id,
      corrected_translation: e.corrected_translation,
      machine_translation: e.machine_translation ?? null,
      source_segment: e.source_segment,
      canonical_ref: e.source_records?.canonical_ref ?? "Unknown record",
      created_at: e.created_at,
    }));
  } catch {
    // TM lookup failure must never break the editor
    return [];
  }
}
