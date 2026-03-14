# F015 — Translation Memory

**Date:** 2026-03-14
**Branch:** `codex/f015-translation-memory`

---

## Objective

Store every approved corrected translation as a reusable translation memory (TM) entry, then surface matching suggestions when a translator opens the correction editor on a new record with identical source text.

---

## PRD Acceptance Criteria

1. Save a corrected translation for a record.
2. Open another record with the same source text segment.
3. Trigger translation generation or review for that record.
4. Confirm the system surfaces a prior corrected translation suggestion.
5. Confirm the user can accept, reject, or edit the suggested reused translation.

---

## Matching Strategy

**Exact string match** on `source_segment` scoped to the same `project_id`. Fuzzy matching via `pg_trgm` is a documented future enhancement — not in scope for F015.

---

## Data Model

### `translation_memory_entries` table

```sql
id                         uuid PK default gen_random_uuid()
project_id                 uuid FK projects NOT NULL
source_language            text NOT NULL
target_language            text NOT NULL
source_segment             text NOT NULL        -- content of the source layer (from MT's source_layer_id chain)
machine_translation        text                 -- what MT produced (nullable)
corrected_translation      text NOT NULL        -- the approved correction
created_from_record_id     uuid FK source_records NOT NULL
created_from_text_layer_id uuid FK text_layers NOT NULL UNIQUE  -- uniqueness guard against duplicate TM rows from retries
created_by                 uuid FK profiles NOT NULL
created_at                 timestamptz default now()
```

### Key design decisions (from addendums)

- **`created_from_text_layer_id` is UNIQUE** — prevents duplicate TM entries if correction is retried or saved twice. No UPDATE or DELETE (append-only in V1). Read-time deduplication is not needed with this constraint.
- **Index shape:** `(project_id, target_language, source_segment)` — matches the actual lookup query exactly.
- **Source segment resolution:** Always resolved from the MT layer's `source_layer_id`, not from the record's current active source layer. The editor operates on a concrete MT layer; re-deriving the source at query time can drift if a newer transcription is added later.

### RLS

- `SELECT`: any project member (via `project_memberships`)
- `INSERT`: project members with role in `('project_admin', 'researcher', 'translator')`
- No UPDATE or DELETE

---

## Approach

### Part 1 — Storage
New `translation_memory_entries` table with migration, indexes, and RLS.

### Part 2 — Capture
Hook `saveTranslationCorrection` server action to INSERT a TM entry after each successful corrected_translation layer creation.

**Source resolution via MT layer's `source_layer_id`:**
1. The corrected_translation layer's `source_layer_id` → the MT layer id (already known as `sourceLayerId`)
2. The MT layer's `source_layer_id` → the source transcription layer id
3. Fetch that source layer's `content` (source_segment) and `language` (source_language)
4. MT layer's `content` → machine_translation value
5. Corrected layer's `language` → target_language, `content` → corrected_translation

**Non-blocking:** Wrap TM insert in try/catch. Failure must NOT roll back the correction save.

### Part 3 — Surface
New `getTranslationMemorySuggestions` server action. Called from `TranslationEditorForm` on mount.

**Lookup:** `project_id` + `target_language` + exact `source_segment` match.
**Source segment:** resolved from the MT layer's `source_layer_id` chain (not record-level active layer).
**Returns:** array of max 5 suggestions, ORDER BY created_at DESC.

**Provenance display:** Use `canonical_ref` from the source record, not raw record ID or generic title.

---

## Files to Create or Modify

| File | Action |
|---|---|
| `supabase/migrations/20260314000001_f015_translation_memory.sql` | CREATE — table + indexes + RLS |
| `src/lib/actions/get-translation-memory-suggestions.ts` | CREATE — server action returning TM suggestions |
| `src/lib/actions/save-translation-correction.ts` | MODIFY — append TM INSERT after layer creation |
| `src/components/records/TranslationEditorForm.tsx` | MODIFY — fetch and display suggestions panel |
| `src/types/index.ts` | MODIFY — add `TranslationMemoryEntry` type |

---

## Steps

### Step 1 — Migration
Create `translation_memory_entries` table:
- Columns as specified above
- UNIQUE constraint on `created_from_text_layer_id`
- Indexes:
  - `(project_id, target_language, source_segment)` — for lookup
  - `(project_id, source_language, target_language)` — for browsing
- RLS policies as specified

### Step 2 — Type
Add `TranslationMemoryEntry` to `src/types/index.ts`.

### Step 3 — Capture hook
In `save-translation-correction.ts`, after the `INSERT INTO text_layers` succeeds:
- MT layer (`sourceLayerId`) already fetched — get its `source_layer_id` and `content` (machine_translation)
- Fetch the source transcription layer (`mt.source_layer_id`) → `content` (source_segment) and `language` (source_language)
- target_language = corrected layer's `language` (same as MT layer's language)
- corrected_translation = the submitted `content` form value
- INSERT into `translation_memory_entries` — ON CONFLICT (created_from_text_layer_id) DO NOTHING
- Wrap in try/catch; log error but do NOT return error to caller

### Step 4 — Suggestions action
`get-translation-memory-suggestions.ts`:
- Params: `{ mtLayerId, targetLanguage }`
- Fetch the MT layer → get `source_layer_id`, `record_id`
- Fetch the source layer → get `content` (source_segment)
- Fetch the record → get `project_id`
- Query `translation_memory_entries` WHERE `project_id = ?` AND `target_language = ?` AND `source_segment = ?`
- JOIN `source_records` to get `canonical_ref` for provenance
- Return array max 5, ORDER BY created_at DESC
- Auth check: requireAuth + project membership

### Step 5 — UI: TranslationEditorForm
- Extend props to accept `mtLayerId: string`
- On mount, call `getTranslationMemorySuggestions({ mtLayerId, targetLanguage: sourceLanguage })`
- If suggestions returned, show `TranslationMemorySuggestions` panel above the textarea:
  - Each suggestion shows: corrected_translation text, `canonical_ref` (provenance), date
  - "Use this" button → populates textarea with `corrected_translation`
  - Dismiss button (×) per suggestion, or "Dismiss all" to hide panel
  - If no suggestions OR if TM lookup fails, panel is hidden (editor must work even if TM fails)
- Panel state: local React state — dismissed suggestions not persisted

---

## Invariants to Preserve

- TM entry creation never blocks or rolls back a correction save
- TM entries are append-only (no UPDATE or DELETE in V1)
- Uniqueness on `created_from_text_layer_id` prevents duplicate entries from retries
- Suggestions are project-scoped — users never see TM entries from other projects
- Source segment resolved from MT layer's `source_layer_id`, not from record-level active source layer
- Editor remains functional if TM lookup fails

---

## Verification

```bash
# 1. Apply migration
supabase db push

# 2. Type check
npx tsc --noEmit

# 3. Lint
npx eslint src/

# 4. Manual flow — positive case (exact match)
# - Create Record A with a source text layer
# - Generate MT for Record A → correct it → save
# - Create Record B with IDENTICAL source text
# - Generate MT for Record B
# - Open Correct Translation on Record B
# - Verify suggestion from Record A appears (with canonical_ref provenance)
# - Accept suggestion ("Use this") → verify textarea populates
# - Save Record B correction → verify second TM entry created (different text_layer_id)

# 5. Manual flow — negative case (near-match text)
# - Create Record C with slightly different source text (e.g., one word changed)
# - Generate MT + open correction editor
# - Verify NO suggestion appears (exact match only)

# 6. Manual flow — interaction paths
# - Dismiss (×) on a single suggestion → suggestion hidden, others remain
# - Edit textarea after "Use this" → modified text saves correctly
# - Simulate TM lookup failure (e.g., bad mtLayerId) → editor still opens, no crash

# 7. Retry guard
# - Save same correction twice (simulate double-submit) → only one TM entry created
```

---

## Addendum Notes (from plan review)

1. **Source segment via MT chain:** Step 4 resolves `source_segment` from `MT.source_layer_id → source_layer.content`, not from the record's current active layer priority chain.
2. **Exact-match negative test:** Added verification step 5 — near-match text must produce no suggestions.
3. **Full acceptance path:** Verification covers dismiss, edit-after-accept, and failure-tolerant loading.
4. **Duplicate guard:** UNIQUE on `created_from_text_layer_id` + `ON CONFLICT DO NOTHING` in INSERT.
5. **Index shape:** `(project_id, target_language, source_segment)` matches actual lookup.
6. **Provenance:** `canonical_ref` displayed in suggestion panel, not raw UUID.

---

## Code Review Fixes (post-implementation)

**P0 — Supabase join type mismatch (tsc failure):**
The `source_records!created_from_record_id` join was typed as a single object but Supabase returns array shape, breaking `npm run typecheck`. Fixed by removing the join from the TM query entirely. Now selects `created_from_record_id` in the main query and resolves `canonical_ref` via a separate `source_records` batch lookup. No unsafe type cast.

**P1 — INSERT policy cross-project provenance gap:**
Original policy only checked project membership on `project_id`. A member of multiple projects (or anyone with a leaked UUID) could create a TM row in project A pointing at provenance from project B, leaking metadata on future reads. Fixed in migration `20260314000002`: added two `EXISTS` checks — `created_from_record_id.project_id = project_id` and `created_from_text_layer_id.record_id = created_from_record_id`.

**P2 — Redundant client-supplied targetLanguage:**
`getTranslationMemorySuggestions` previously took `targetLanguage` as a client-supplied param, even though it can be derived from `mtLayer.language` already fetched in step 1. Removed from the function signature; derived server-side. `TranslationEditorForm` updated to call with `{ mtLayerId }` only.

**Final state after fixes:** `npx tsc --noEmit` clean, `npx eslint src/` clean. PR #15 squash-merged to main.
