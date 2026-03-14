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
}: {
  mtLayerId: string;
}): Promise<TranslationMemorySuggestion[]> {
  if (!mtLayerId) return [];

  try {
    await requireAuth();
    const supabase = await createClient();

    // 1. Fetch MT layer — language is the target language (MT output language)
    const { data: mtLayer } = await supabase
      .from("text_layers")
      .select("id, record_id, source_layer_id, language")
      .eq("id", mtLayerId)
      .single();

    if (!mtLayer?.source_layer_id || !mtLayer?.record_id || !mtLayer?.language) return [];

    const targetLanguage = mtLayer.language;

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
    //    No join: fetch created_from_record_id and resolve canonical_ref separately
    //    to avoid Supabase join shape ambiguity (array vs object) in the TypeScript types.
    const { data: entries } = await supabase
      .from("translation_memory_entries")
      .select(
        "id, corrected_translation, machine_translation, source_segment, created_at, created_from_record_id"
      )
      .eq("project_id", record.project_id)
      .eq("target_language", targetLanguage)
      .eq("source_segment", sourceLayer.content)
      .order("created_at", { ascending: false })
      .limit(5);

    if (!entries || entries.length === 0) return [];

    // 5. Batch-fetch canonical_refs for the provenance display
    const recordIds = [...new Set(entries.map((e) => e.created_from_record_id as string))];
    const { data: sourceRecords } = await supabase
      .from("source_records")
      .select("id, canonical_ref")
      .in("id", recordIds);

    const canonicalRefMap = new Map(
      (sourceRecords ?? []).map((r) => [r.id as string, r.canonical_ref as string])
    );

    return entries.map((e) => ({
      id: e.id as string,
      corrected_translation: e.corrected_translation as string,
      machine_translation: (e.machine_translation as string | null) ?? null,
      source_segment: e.source_segment as string,
      canonical_ref: canonicalRefMap.get(e.created_from_record_id as string) ?? "Unknown record",
      created_at: e.created_at as string,
    }));
  } catch {
    // TM lookup failure must never break the editor
    return [];
  }
}
