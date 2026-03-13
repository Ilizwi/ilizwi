# Plan: F008 — Wits Supplementary Source Intake
Date: 2026-03-13
Status: COMPLETE — PASSED (PR #11, squash merged to main 2026-03-13)

## Context
F009, F010, F011 are all complete. Under the temporary sequencing rule, F008 is next. F008 is P1/secondary — Wits is a supplementary archival source (not a structured newspaper API like Ibali/NLSA). It provides metadata via OAI-PMH and selective digital objects.

## Live Contract (verified before implementation)
- **OAI endpoint**: `https://researcharchives.wits.ac.za/;oai` (NOT `.../index.php/;oai`)
- **Identify**: `https://researcharchives.wits.ac.za/;oai?verb=Identify` — confirmed live
- **OAI identifier shape**: `oai:researcharchives.wits.ac.za:443:historic_100002` (includes port and numeric path segment)
- **Record page URLs**: pattern is unreliable — `index.php/{slug}` does not resolve; do NOT accept URLs as input
- **Date format in real records**: often date ranges like `1913 - 1975` or `14 July 1913 - 21 October 1975`, NOT `YYYY-MM-DD`
- **dc:identifier in live OAI-DC**: contains record landing page URLs (not downloadable file URLs)

## Key Decisions
- **Input format**: Accept OAI identifier only (`oai:researcharchives.wits.ac.za:443:{id}`). No URL input — URL pattern unreliable.
- **No DB migration needed**: `source_type='wits'` already in ENUM; `source_identifier`, `source_url` already on source_records from F006; file_assets XOR constraint already supports external URLs.
- **Supplementary marker**: `source_type='wits'` is sufficient — no new boolean column.
- **Date handling — best-effort extraction** (not strict reject):
  1. Try strict `/^\d{4}-\d{2}-\d{2}$/` → use as-is for `date_issued`
  2. Else extract first 4-digit year → `{year}-01-01` stored in `date_issued`; raw string stored in `date_issued_raw` (never rewritten — provenance preserved as-is from source)
  3. If no 4-digit year found → reject import with error
  This approach allows most real Wits records to import while preserving `date_issued_raw` as provenance. The raw string is NEVER modified by the adapter — it is always stored verbatim from dc:date.
- **File discovery**: Only create `file_asset` if `dc:identifier` URL ends in a known file extension (`.pdf`, `.jpg`, `.png`, `.tiff`, `.tif`). Landing page URLs are skipped. Most imports will be metadata-only in V1.
- **No text layers**: Wits OAI-DC has no extracted text.
- **XML parsing**: Node 22 has no `DOMParser`. Use `fast-xml-parser` (not present in package.json — add it; keep usage narrow to this adapter only, no generic OAI framework).
- **Verified sample**: Implementation must test against at least one live OAI identifier before marking acceptance criteria met.

## Addendums (from review)

### Addendum 1 — Metadata-only path verification
Add an explicit acceptance criterion: importing a record whose `dc:identifier` array contains only landing page URLs (no file-extension URLs) must create only a `source_records` row and must NOT attempt a `file_assets` insert. This is the expected V1 behaviour for most real Wits records. The test must confirm this path explicitly.

### Addendum 2 — date_issued_raw provenance invariant
The adapter must store the raw dc:date string verbatim in `date_issued_raw`. The server action must:
- Use only `date_extracted` (the synthesised `YYYY-MM-DD`) for `date_issued` column
- Always persist the original source string into `date_issued_raw`, whether or not it was a clean ISO date
- Never rewrite or normalise `date_issued_raw` — it is a provenance field, not a display field
- This invariant applies even when dc:date is already a clean ISO date (store it in both fields)

### Addendum 3 — OAI-DC single-vs-array field normalisation
OAI-DC fields (`dc:identifier`, `dc:title`, `dc:language`, `dc:description`, `dc:publisher`) may arrive from `fast-xml-parser` as either a single value or an array depending on how many values are present. The adapter contract must explicitly normalise these fields:
- Multi-value fields (e.g. `dc:identifier`): always normalise to `string[]` before processing
- Single-value fields used as strings (e.g. `dc:title`, `dc:date`): take first element if array, or use directly if string
- This normalisation must be explicit and documented in the adapter — not an implicit implementation detail

### Addendum 4 — Collision retry is expected, not exceptional (for Wits)
Using `{year}-01-01` for ranged or fuzzy dates increases canonical-ref collisions for Wits imports sharing a publication title and year (e.g. multiple issues of Imvo from 1913 all mapped to `WITS-IMV-1913-01-01`). The collision retry loop (r2–r9) handles this by design. Implementation should treat this as expected behaviour, not an error path. The plan should not flag collision retries as anomalies in the Wits context.

## Contract Verification Step (Step 0 — before any code)
Before writing adapter code, run a live probe:
1. `GET https://researcharchives.wits.ac.za/;oai?verb=GetRecord&identifier=oai:researcharchives.wits.ac.za:443:historic_100002&metadataPrefix=oai_dc`
2. Confirm response structure: OAI-DC fields present, date format, dc:identifier content
3. Confirm no auth required, no rate limiting
4. If the identifier is stale, use `ListRecords?verb=ListRecords&metadataPrefix=oai_dc` to discover a valid one
5. Document the confirmed identifier in the plan addendum before continuing

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/lib/sources/wits.ts` | CREATE — OAI-PMH XML adapter |
| `src/lib/actions/import-wits.ts` | CREATE — server action (idempotency, insert, rollback) |
| `src/components/records/WitsImportForm.tsx` | CREATE — client form |
| `src/app/(app)/projects/[id]/import/wits/page.tsx` | CREATE — server page with role gate |
| `src/app/(app)/projects/[id]/page.tsx` | MODIFY — add "Import from Wits →" link |
| `feature_list.json` | MODIFY (end) — F008 passes: true |
| `claude-progress.txt` | MODIFY (end) — session log |
| `plan/2026-03-13-f008-wits-supplementary-source.md` | CREATE (end) |

## Implementation Steps

### Step 0 — Contract Verification
- Probe live OAI-PMH endpoint and document actual response shape
- Identify at least one valid OAI identifier for a Panashe-relevant record (Imvo or press cuttings)
- Confirm date field format in real records
- Confirm dc:identifier content (landing pages vs file URLs)
- Update implementation steps if shape differs from plan

### Step 1 — Wits OAI-PMH Adapter (`src/lib/sources/wits.ts`)
- `WITS_OAI_BASE = 'https://researcharchives.wits.ac.za/;oai'`
- `FETCH_TIMEOUT_MS = 10_000`
- **Ref parser**: accept only `oai:researcharchives.wits.ac.za:443:{id}` format; reject anything else with descriptive error
- **Fetch**: `GET {WITS_OAI_BASE}?verb=GetRecord&identifier={oai-id}&metadataPrefix=oai_dc`
- **XML parse**: use `fast-xml-parser` (narrow usage — no generic OAI abstraction)
  - Extract: `dc:title`, `dc:date`, `dc:language`, `dc:description`, `dc:identifier[]`, `dc:publisher`
  - **Normalisation (Addendum 3)**: explicitly coerce each field:
    - `dc:identifier`: always `string[]` — `Array.isArray(v) ? v : v ? [v] : []`
    - `dc:title`, `dc:date`, `dc:language`, `dc:description`, `dc:publisher`: take first if array, use directly if string
  - If OAI error element present (e.g., `idDoesNotExist`) → return `{ ok: false, error: 'not_found' }`
- **Date extraction** (Addendum 2 — provenance invariant):
  - Raw dc:date string stored verbatim in `date_raw` output field (NEVER rewritten, even if already ISO)
  - Strict ISO: if `/^\d{4}-\d{2}-\d{2}$/` → `date_extracted = dc:date`, `date_issued_raw = dc:date`
  - Year fallback: extract first `/\d{4}/` from raw string → `date_extracted = '{year}-01-01'`, `date_issued_raw = dc:date_raw_string`
  - No year found → `date_extracted: null`
- **File URL detection**: scan `dc:identifier[]` for entries ending in `.pdf|.jpg|.png|.tiff|.tif` (case-insensitive) — take first match as `file_url`; otherwise `file_url: null`
- **Typed output**: `MappedWitsItem { title, date_raw, date_extracted, language, description, oai_identifier, file_url: string | null }`
- **Error shapes**: `ok: true | false`, variants: `not_found`, `timeout`, `network`, `parse_error`
- No throw — return typed result

### Step 2 — Server Action (`src/lib/actions/import-wits.ts`)
Follows `import-nlsa.ts` pattern exactly:

1. Extract `projectId` + `witsRef` from formData
2. `assertImportPermission` — super_admin | project_admin | researcher (mirror existing helper)
3. Validate `witsRef` format: must match `oai:researcharchives.wits.ac.za:443:` prefix; reject otherwise
4. Idempotency pre-check: `SELECT id FROM source_records WHERE project_id=$1 AND source_type='wits' AND source_identifier=$2`
5. Fetch via `fetchWitsItem(witsRef)` — return error on failure
6. Extract `date_issued` from `MappedWitsItem.date_extracted` (already validated in adapter); reject if null
7. Map: `source_archive='Wits'`, `publication_title` from `dc:title`, `language`, `date_issued`, `date_issued_raw` (verbatim from adapter — Addendum 2)
8. `generateCanonicalRef({ source_type: 'wits', publication_title, date_issued, ... })`
9. Insert `source_records` with collision retry (r2–r9), `source_type='wits'`, `source_identifier=witsRef`
   - Note: collision retries are **expected and normal** for Wits imports due to year-level date synthesis (Addendum 4)
10. If `file_url` present: insert `file_assets` with `source_url=file_url`, `storage_path=null`, `asset_type='source_file'`, `original_filename` derived from URL tail. Compensate (delete source_records) on failure.
    - If `file_url` is null: skip file_assets insert entirely — metadata-only path (Addendum 1)
11. No text_layers insert
12. `console.log` audit entry
13. `revalidatePath('/projects/{projectId}/records')`
14. Return `{ error: null, recordId }`

### Step 3 — Import Page (`src/app/(app)/projects/[id]/import/wits/page.tsx`)
- Mirror `import/nlsa/page.tsx` exactly
- Role gate: super_admin | project_admin | researcher; translators/reviewers see inline access-denied (not redirect)
- Render `<WitsImportForm projectId={id} />`
- Heading: "Import from Wits Research Archives"

### Step 4 — Form Component (`src/components/records/WitsImportForm.tsx`)
- `"use client"`
- `useActionState` from `importFromWits`
- Input field: `witsRef` — OAI identifier only
- Placeholder: `oai:researcharchives.wits.ac.za:443:historic_100002`
- Hint text: accepted format + note that records missing a parseable year will be rejected + note that files are only linked if directly accessible from OAI metadata
- Success: show record link `/projects/{id}/records/{recordId}`
- Error: inline
- `disabled={isPending}` guard

### Step 5 — Project Detail Page (`src/app/(app)/projects/[id]/page.tsx`)
- Add "Import from Wits →" next to NLSA link
- Same role gate: `isAdmin || callerMembership?.role === 'researcher'`
- Route: `/projects/{id}/import/wits`

### Step 6 — Documentation + Completion
- `feature_list.json`: F008 `passes: true`
- `claude-progress.txt`: session log
- Install `fast-xml-parser` before writing adapter

## Acceptance Criteria (PRD Test Steps)

| Step | Satisfied by |
|------|-------------|
| 1. Harvest Wits metadata for Panashe-relevant query | OAI-PMH GetRecord for a verified Imvo/press-cuttings identifier |
| 2. Store as source-linked record | source_records insert with source_type='wits', source_identifier=oai_id |
| 3. Link file where publicly available | file_assets with source_url if dc:identifier contains a file-extension URL; metadata-only if not |
| 4. Mark as supplementary (not primary) | source_type='wits' distinguishes from ibali/nlsa in all queries and display |
| 5. Participate in search | Same source_records table — F020 will include Wits automatically |

### Additional acceptance criteria (addendums)

| Addendum | Verified by |
|----------|-------------|
| Metadata-only path (Addendum 1) | Import a record with only landing page dc:identifier values → only source_records row created, no file_assets row |
| date_issued_raw provenance (Addendum 2) | Import a record with a range date → date_issued_raw = verbatim dc:date string; date_issued = {year}-01-01 |
| Single-vs-array normalisation (Addendum 3) | Adapter handles both single-value and multi-value dc:identifier without runtime error |
| Collision retry as expected (Addendum 4) | Two imports of different Wits records for same publication+year produce distinct canonical refs via collision suffix |

## Verification
1. `pnpm build` — must pass
2. `pnpm typecheck` — must pass
3. `pnpm lint` — must pass
4. Manual: Import a verified OAI identifier (confirmed in Step 0)
5. Confirm record in `/projects/{id}/records` with canonical_ref starting `WITS-`
6. Confirm source provenance panel shows source_type='wits', source_archive='Wits'
7. Confirm date_issued_raw preserved when date was extracted from a range string
8. Idempotency: re-import same ref returns existing record, no duplicate
9. Translator/reviewer: /import/wits shows access-denied inline, not redirect
10. Metadata-only path: record with no file-extension dc:identifier → no file_assets row (Addendum 1)
