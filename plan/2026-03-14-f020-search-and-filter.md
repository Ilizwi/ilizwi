# Plan: F020 — Search and Filter

Date: 2026-03-14
Branch: `codex/f020-search-and-filter`
Status: MERGED — PR #20 squash merged to main
Result: F020 PASSED

---

## Context

F020 is the final Day 4 feature (P0). All F017–F019 are complete. The records list page currently shows all records for a project with a single `?flagged=true` filter (added in F019). F020 adds full search and filter capability so researchers can find materials by term, source archive, language, date, and workflow status.

---

## Addendums Applied

1. **No `"use client"` needed** — `RecordSearchFilters` is a plain server component with a `<form method="GET">`. No `useRouter`/`useSearchParams`.
2. **Deterministic search implementation** — fetch matching `record_id`s from `text_layers` (ilike on content), then run a single `source_records` query with `.or()` on metadata fields plus `id.in(text_layer_ids)` only when that ID list is non-empty. No client-side set merging.
3. **Intersection semantics for `flagged=true`** — the flagged ID list and the search/filter results are both applied to the same query chain, not merged separately. All constraints narrow a single query.
4. **Navigation** — existing behavior preserved: canonical ref cell is the clickable link to record detail. No full-row click added. Verification wording updated to match.
5. **Language filter** — curated list (xh, zu, st, nl, en) for V1. Records in other languages won't be directly filterable from the UI. Noted in UX notes below.

---

## Approach

URL-driven filtering. No DB migrations needed — all fields exist on `source_records`.

**Query params:**
- `?q=term` — ilike search across `publication_title`, `source_archive`, `canonical_ref`, plus `text_layers.content` subquery
- `?source=ibali` — filter by `source_type` enum (UI label → DB enum mapping server-side)
- `?language=xh` — filter by `language`
- `?date_from=YYYY-MM-DD` / `?date_to=YYYY-MM-DD` — filter by `date_issued` range
- `?status=raw` — filter by `record_status`
- `?flagged=true` — existing filter, composed into the same query chain

**Source type UI → DB enum mapping:**
- "Manual / Readex" → `manual_readex`
- "Ibali" → `ibali`
- "NLSA" → `nlsa`
- "Wits" → `wits`

**date_issued note:** Records with only `date_issued_raw` and no parsed `date_issued` will not match date range filters. This is expected V1 behavior — shown as a UI note (no change needed).

---

## Files

**Create:**
- `src/components/records/RecordSearchFilters.tsx` — server component; plain GET form

**Modify:**
- `src/app/(app)/projects/[id]/records/page.tsx` — read new searchParams; build Supabase query chain; render filter component; show result count

---

## Steps

### 1. Create branch
```bash
git checkout -b codex/f020-search-and-filter
```

### 2. Create `RecordSearchFilters.tsx`

`src/components/records/RecordSearchFilters.tsx` — server component (no `"use client"`):

```tsx
interface RecordSearchFiltersProps {
  projectId: string;
  q?: string;
  source?: string;
  language?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  flagged?: string;
}
```

Renders a `<form action={`/projects/${projectId}/records`} method="GET">`:
- Text input: `name="q"`, placeholder "Search records…", value={q}
- Source select: `name="source"` — options: `""` (All Sources), `ibali`, `nlsa`, `wits`, `manual_readex`
- Language select: `name="language"` — options: `""` (All Languages), `xh`, `zu`, `st`, `nl`, `en`
- Status select: `name="status"` — options: `""` (All Statuses), `raw`, `in_review`, `approved`
- Date from: `<input type="date" name="date_from">`, value={dateFrom}
- Date to: `<input type="date" name="date_to">`, value={dateTo}
- If `flagged === "true"`: include `<input type="hidden" name="flagged" value="true">` so flagged filter persists through search
- Submit button: "Search"
- "Clear filters" link: `href={`/projects/${projectId}/records${flagged === "true" ? "?flagged=true" : ""}`}` — visible only when q/source/language/dateFrom/dateTo/status is non-empty
- ILIZWI design tokens only (desk-border, desk-muted, desk-text, vault-bg, vault-text, font-sans, rounded-[2px])

### 3. Update `records/page.tsx`

**searchParams destructuring:**
```typescript
searchParams?: Promise<{
  flagged?: string;
  q?: string;
  source?: string;
  language?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
}>;
```

**Query build — deterministic order:**

```typescript
// Step 1: if q is set, fetch matching text_layer record IDs
let textLayerIds: string[] = [];
if (q) {
  const { data: tlMatches } = await supabase
    .from("text_layers")
    .select("record_id")
    .eq("project_id", id)  // if project_id exists on text_layers; else join via source_records
    .ilike("content", `%${q}%`);
  textLayerIds = [...new Set((tlMatches ?? []).map((t) => t.record_id))];
}

// Step 2: build main query
let recordsQuery = supabase
  .from("source_records")
  .select("id, publication_title, source_archive, language, date_issued, date_issued_raw, record_status, canonical_ref, created_at")
  .eq("project_id", id)
  .order("created_at", { ascending: false });

// Step 3: apply text search (metadata OR text layer IDs)
if (q) {
  const metaFilter = `publication_title.ilike.%${q}%,source_archive.ilike.%${q}%,canonical_ref.ilike.%${q}%`;
  if (textLayerIds.length > 0) {
    recordsQuery = recordsQuery.or(`${metaFilter},id.in.(${textLayerIds.join(",")})`);
  } else {
    recordsQuery = recordsQuery.or(metaFilter);
  }
}

// Step 4: apply structured filters
if (source) recordsQuery = recordsQuery.eq("source_type", source);
if (language) recordsQuery = recordsQuery.eq("language", language);
if (status) recordsQuery = recordsQuery.eq("record_status", status);
if (date_from) recordsQuery = recordsQuery.gte("date_issued", date_from);
if (date_to) recordsQuery = recordsQuery.lte("date_issued", date_to);

// Step 5: apply flagged filter (same query chain — intersection, not union)
if (showFlaggedOnly) {
  const { data: flaggedIds } = await supabase
    .from("record_flags")
    .select("record_id")
    .eq("project_id", id);
  const ids = [...new Set((flaggedIds ?? []).map((f) => f.record_id))];
  if (ids.length === 0) {
    recordsQuery = recordsQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
  } else {
    recordsQuery = recordsQuery.in("id", ids);
  }
}

const { data: records } = await recordsQuery;
```

**Render:**
- Add `<RecordSearchFilters>` above table, passing all current filter values
- Add result count: `{records?.length ?? 0} record{records?.length !== 1 ? "s" : ""} found` below the filter bar
- Keep existing flagged toggle link in header (preserve current behavior)
- Keep canonical ref as clickable link (no full-row click)

### 4. Verify

```bash
npm run build
npm run typecheck
npm run lint
```

---

## Acceptance Criteria

1. Search input finds records by publication title, source archive, canonical ref, or text layer content
2. Source, language, date range, and status filters narrow results correctly
3. Multiple filters compose correctly (intersection)
4. Clearing filters returns the full list (or flagged-only if flagged=true is active)
5. Canonical ref cell navigates to correct record detail page (existing behavior preserved)
6. `?flagged=true` composes correctly with other filters (intersection via same query chain)
7. Result count is displayed
8. Build, typecheck, lint all pass

---

## Notes

- No DB migration required
- No new Supabase RLS needed — all queries scoped to project_id via existing policies
- Language filter is curated (xh, zu, st, nl, en); records in other languages not directly filterable from UI (V1 known limitation)
- date_issued filtering excludes records with only date_issued_raw (V1 known limitation, no UX change needed)
- text_layers has no project_id — RLS scopes readable rows to member projects; main query's .eq("project_id") handles final intersection

## Review Findings (Session 21)

**P1 — Raw `q` in PostgREST `.or()` filter** (fixed)
- Search term was embedded directly into the filter string. Commas and parentheses are structural characters in PostgREST filter syntax and would break query parsing.
- Fix: `safeQ = q.replace(/[(),.\s]+/g, " ").trim()` applied before building the metaFilter string. text_layers ilike call is parameterized and unaffected.

**P1 — Flagged toggle discarded active filters** (fixed)
- The Show Flagged / Flagged Only link was hardcoded to `/projects/${id}/records` or `?flagged=true`, wiping q/source/language/status/date.
- Fix: `flaggedToggleHref` computed from all active search params with URLSearchParams, toggling only the `flagged` key.
