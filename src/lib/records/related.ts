import type { SupabaseClient } from "@supabase/supabase-js";
import type { SourceRecord } from "@/types";

export type RelatedRecord = {
  record: SourceRecord;
  reason: string;
};

export async function getRelatedRecords(
  record: SourceRecord,
  supabase: SupabaseClient
): Promise<RelatedRecord[]> {
  const results: RelatedRecord[] = [];
  const seenIds = new Set<string>([record.id]);

  // Signal 1: Same issue (only when both volume AND issue_number are present)
  if (record.publication_title && record.volume && record.issue_number && results.length < 5) {
    const { data } = await supabase
      .from("source_records")
      .select("*")
      .eq("project_id", record.project_id)
      .eq("publication_title", record.publication_title)
      .eq("volume", record.volume)
      .eq("issue_number", record.issue_number)
      .neq("id", record.id)
      .limit(5);

    for (const r of data ?? []) {
      if (!seenIds.has(r.id) && results.length < 5) {
        seenIds.add(r.id);
        results.push({ record: r as SourceRecord, reason: "Same issue" });
      }
    }
  }

  // Signal 2: Same publication + language (different issue) — deduplication handles overlap
  if (record.publication_title && results.length < 5) {
    let query = supabase
      .from("source_records")
      .select("*")
      .eq("project_id", record.project_id)
      .eq("publication_title", record.publication_title)
      .neq("id", record.id);

    if (record.language) {
      query = query.eq("language", record.language);
    }

    const { data } = await query.limit(10);

    for (const r of data ?? []) {
      if (!seenIds.has(r.id) && results.length < 5) {
        seenIds.add(r.id);
        results.push({ record: r as SourceRecord, reason: "Same publication" });
      }
    }
  }

  // Signal 3: Same language + date within ±1 year (only when both language AND date_issued exist)
  if (record.language && record.date_issued && results.length < 5) {
    const date = new Date(record.date_issued);
    const yearBefore = new Date(date);
    yearBefore.setFullYear(date.getFullYear() - 1);
    const yearAfter = new Date(date);
    yearAfter.setFullYear(date.getFullYear() + 1);

    const { data } = await supabase
      .from("source_records")
      .select("*")
      .eq("project_id", record.project_id)
      .eq("language", record.language)
      .neq("id", record.id)
      .gte("date_issued", yearBefore.toISOString().split("T")[0])
      .lte("date_issued", yearAfter.toISOString().split("T")[0])
      .limit(10);

    for (const r of data ?? []) {
      if (!seenIds.has(r.id) && results.length < 5) {
        seenIds.add(r.id);
        results.push({ record: r as SourceRecord, reason: "Same language & period" });
      }
    }
  }

  return results;
}
