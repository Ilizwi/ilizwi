# F022 — Corpus Trend View

**Date:** 2026-03-14
**Branch:** `codex/f022-corpus-trend-view`
**Status:** COMPLETE — PASSED (2026-03-14, PR #22)

---

## Objective

Give researchers a way to see how a term or concept distributes across the corpus — by year, publication, language, or source — and navigate back to underlying records. Read-only analytical view built on top of the existing `source_records` + `text_layers` data.

---

## Approach

- New server-component page at `/projects/[id]/trends`
- URL-driven filters (`q`, `source`, `language`) — same pattern as records page
- Fetch + aggregate in a plain server utility (NOT a server action — no client component needs it)
- Two-phase text search identical to F020 records page (see §Search Behavior below)
- Aggregate in JS: group by publication_year (from `date_issued`), `publication_title`, `language`, `source_type`
- Render as CSS bar charts — no charting library
- Each bar links back to `/records` with filter mappings defined below
- Add "Corpus Trends" nav link on project dashboard

---

## Addendum Notes (from review)

### 1. No server action — use plain server utility

`src/lib/trends/corpus-trends.ts` will be a plain async function, not a `"use server"` action. The trends page is a server component and calls it directly. This keeps the diff smaller and avoids introducing an unnecessary action surface.

### 2. Reuse F020 search behavior exactly

The trends query MUST use the exact same escaped search logic fixed in F020 (records page `src/app/(app)/projects/[id]/records/page.tsx` lines 56–68):

```ts
// Step 1: fetch text layer record IDs
const { data: tlMatches } = await supabase
  .from("text_layers")
  .select("record_id")
  .ilike("content", `%${q}%`);
const textLayerIds = [...new Set((tlMatches ?? []).map((t) => t.record_id))];

// Step 2: metadata OR text layer IDs with PostgREST-safe sanitization
const safeQ = q.replace(/[(),.\s]+/g, " ").trim();
const metaFilter = `publication_title.ilike.%${safeQ}%,source_archive.ilike.%${safeQ}%,canonical_ref.ilike.%${safeQ}%`;
```

Do NOT re-implement this from scratch. Copy the pattern verbatim. Diverging risks reintroducing the raw PostgREST interpolation bug.

### 3. Drill-down link mappings (defined up front)

The records page supports: `q`, `source` (= source_type), `language`, `date_from`, `date_to`, `status`, `flagged`.

It does NOT have a `publication_title` exact-match filter.

Bar href construction:

| Dimension | Records page filter |
|-----------|-------------------|
| **byYear** (e.g. 1934) | `q={term}&date_from=1934-01-01&date_to=1934-12-31` |
| **byPublication** (e.g. "Umteteli") | `q={publicationTitle}` — uses metadata ILIKE on publication_title. Acceptable V1 approximation; acknowledged as fuzzy. |
| **byLanguage** | `q={term}&language={language}` |
| **bySource** | `q={term}&source={source_type}` |

All hrefs preserve the active `source` and `language` filters from the trends URL, plus `q`.

V1 limitation: byPublication bars use `q=<publicationTitle>` which is ILIKE-fuzzy, not exact. This is explicitly accepted and does not need fixing in this session.

### 4. Acceptance criterion 4 — corrected

Criterion 4 was "Open one underlying record from trend view → navigates correctly to record detail." This is inaccurate. Trend bars navigate to a filtered records list, not directly to record detail. Corrected criterion:

> 4. Click a bar → navigates to `/records` with the correct filters pre-applied, showing only the matching subset.

Direct record-detail drill-down is out of scope for F022.

### 5. Project-scope guard before aggregation

The utility MUST apply `.eq("project_id", projectId)` on the `source_records` query before fetching any rows. Aggregation happens only on the already-scoped result set. Never aggregate across projects.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/trends/corpus-trends.ts` | Plain server utility (not a server action) — fetches project-scoped records, aggregates into 4 buckets |
| `src/components/records/TrendBarChart.tsx` | Reusable CSS bar chart component |
| `src/app/(app)/projects/[id]/trends/page.tsx` | Main server-component page |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/(app)/projects/[id]/page.tsx` | Add "Corpus Trends →" nav link |

---

## Implementation Steps

### Step 1 — `src/lib/trends/corpus-trends.ts`

```ts
// Plain async utility — NOT "use server"
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
```

- Accept `projectId`, optional `q`, `source`, `language`
- Always `.eq("project_id", projectId)` first
- Two-phase search identical to F020 (copy pattern exactly)
- Apply `source` → `.eq("source_type", source)`, `language` → `.eq("language", language)`
- Return matching rows, then aggregate in JS into 4 buckets
- Sort each bucket descending by count
- Build hrefs per the mapping table above

### Step 2 — `src/components/records/TrendBarChart.tsx`

- Props: `title: string`, `items: TrendBucket[]`, `projectId: string`
- Horizontal bars: label left, bar (CSS width %), count + % right
- Bar width = `(count / max) * 100%` (max = items[0].count)
- Each bar is a Next.js `<Link>` to `href`
- ILIZWI styling: `bg-[var(--color-vault-bg)]` bars (Historic Green), serif label, muted count
- Empty state: "No data" text
- Max 15 items shown

### Step 3 — `/trends/page.tsx`

- Server component
- Reads `searchParams`: `q`, `source`, `language`
- Calls `getCorpusTrends(projectId, q, source, language)`
- Renders:
  - Page header with project name
  - Term search input (GET form, `name="q"`)
  - Source + language dropdowns (same values as records page)
  - If `q` is empty: prompt "Enter a search term to begin"
  - If `q` set but zero results: "No records match this term"
  - If results: 4 `TrendBarChart` panels in 2×2 grid (byYear, byPublication, byLanguage, bySource)
  - Summary: "{total} records match this term"
- ILIZWI desk workspace styling — same spacing/tone as records page

### Step 4 — Modify project dashboard

Add after the existing "View records →" link:
```tsx
<Link href={`/projects/${id}/trends`} ...>
  Corpus Trends →
</Link>
```

---

## Acceptance Criteria (Corrected)

1. Open corpus trend view for a term present in multiple records → grouped results appear
2. System groups results across all 4 dimensions (year, publication, language, source) → 4 panels shown
3. Change source or language filter → view updates accordingly (URL-driven, server re-renders)
4. Click a bar → navigates to `/records` with correct filters pre-applied, showing matching subset

---

## Verification

```bash
npm run build      # must pass
npm run typecheck  # must pass
npm run lint       # must pass
```

Manual: load `/projects/[id]/trends`, search a known term, confirm all 4 panels render, click a bar, confirm records page shows filtered results.
