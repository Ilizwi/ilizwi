import { createClient } from "@/lib/supabase/server";

export interface TrendRecord {
  id: string;
  publication_title: string;
  language: string;
  date_issued: string | null;
  source_type: string;
  canonical_ref: string | null;
}

export interface TrendBucket {
  label: string;
  count: number;
  href: string;
}

export interface CorpusTrends {
  total: number;
  byYear: TrendBucket[];
  byPublication: TrendBucket[];
  byLanguage: TrendBucket[];
  bySource: TrendBucket[];
}

export async function getCorpusTrends(
  projectId: string,
  q?: string,
  source?: string,
  language?: string
): Promise<CorpusTrends> {
  const supabase = await createClient();

  // Step 1: fetch text layer record IDs if full-text search requested
  let textLayerIds: string[] = [];
  if (q) {
    const { data: tlMatches } = await supabase
      .from("text_layers")
      .select("record_id")
      .ilike("content", `%${q}%`);
    textLayerIds = [
      ...new Set((tlMatches ?? []).map((t: { record_id: string }) => t.record_id)),
    ];
  }

  // Step 2: build base query scoped to project
  let recordsQuery = supabase
    .from("source_records")
    .select("id, publication_title, language, date_issued, source_type, canonical_ref")
    .eq("project_id", projectId);

  // Step 3: apply text search — metadata OR text layer IDs
  if (q) {
    const safeQ = q.replace(/[(),.\s]+/g, " ").trim();
    const metaFilter = `publication_title.ilike.%${safeQ}%,source_archive.ilike.%${safeQ}%,canonical_ref.ilike.%${safeQ}%`;
    if (textLayerIds.length > 0) {
      recordsQuery = recordsQuery.or(
        `${metaFilter},id.in.(${textLayerIds.join(",")})`
      );
    } else {
      recordsQuery = recordsQuery.or(metaFilter);
    }
  }

  // Step 4: apply structured filters
  if (source) recordsQuery = recordsQuery.eq("source_type", source);
  if (language) recordsQuery = recordsQuery.eq("language", language);

  const { data: records } = await recordsQuery;
  const rows: TrendRecord[] = records ?? [];

  const total = rows.length;
  const encodedQ = encodeURIComponent(q ?? "");
  const base = `/projects/${projectId}/records`;

  // --- byYear ---
  const yearMap = new Map<string, number>();
  for (const r of rows) {
    if (!r.date_issued) continue;
    const year = r.date_issued.substring(0, 4);
    if (!/^\d{4}$/.test(year)) continue;
    yearMap.set(year, (yearMap.get(year) ?? 0) + 1);
  }
  const byYear: TrendBucket[] = [...yearMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      href: `${base}?q=${encodedQ}&date_from=${label}-01-01&date_to=${label}-12-31`,
    }));

  // --- byPublication ---
  const pubMap = new Map<string, number>();
  for (const r of rows) {
    const pub = r.publication_title?.trim();
    if (!pub) continue;
    pubMap.set(pub, (pubMap.get(pub) ?? 0) + 1);
  }
  const byPublication: TrendBucket[] = [...pubMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      href: `${base}?q=${encodeURIComponent(label)}`,
    }));

  // --- byLanguage ---
  const langMap = new Map<string, number>();
  for (const r of rows) {
    const lang = r.language?.trim();
    if (!lang) continue;
    langMap.set(lang, (langMap.get(lang) ?? 0) + 1);
  }
  const byLanguage: TrendBucket[] = [...langMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      href: `${base}?q=${encodedQ}&language=${encodeURIComponent(label)}`,
    }));

  // --- bySource ---
  const srcMap = new Map<string, number>();
  for (const r of rows) {
    const src = r.source_type?.trim();
    if (!src) continue;
    srcMap.set(src, (srcMap.get(src) ?? 0) + 1);
  }
  const bySource: TrendBucket[] = [...srcMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      href: `${base}?q=${encodedQ}&source=${encodeURIComponent(label)}`,
    }));

  return { total, byYear, byPublication, byLanguage, bySource };
}
