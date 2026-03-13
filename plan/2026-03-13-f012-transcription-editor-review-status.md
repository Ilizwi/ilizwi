# F012 — Transcription Editor and Review Status

**Date:** 2026-03-13
**Branch:** `codex/f012-transcription-editor-review-status`
**PR:** #12 (squash merged to main, commit c90e62c)
**Status:** PASSED

---

## Objective

Allow researchers to create corrected transcriptions from source layers, and to set/update layer review status. Extends the F005/F011 text_layers model with a status-only update path backed by a DB-level immutability trigger and a scoped UPDATE RLS policy.

---

## Approach

No new table. One migration adds:
1. `enforce_text_layers_immutability()` — BEFORE UPDATE trigger that blocks changes to all immutable fields (including `id`) using null-safe `IS DISTINCT FROM` comparisons.
2. `check_text_layers_immutability` trigger on `text_layers`.
3. `text_layers_update_status` UPDATE RLS policy — membership-only (project_admin/researcher); no super_admin bypass to match the membership-only SELECT policy boundary.

`TranscriptionEditorForm` creates a new `corrected_transcription` row from a source layer's content. No `supersedes_layer_id` — cross-type supersession is rejected by existing validation.

`updateLayerStatus` uses a direct membership-only permission check (not `assertLayerPermission`) consistent with the DB policy.

---

## Files Created or Modified

### New
- `supabase/migrations/20260313000004_f012_text_layer_status_update.sql`
- `src/components/records/TranscriptionEditorForm.tsx`
- `src/components/records/UpdateLayerStatusForm.tsx`

### Modified
- `src/lib/actions/text-layers.ts` — `addTextLayer` accepts optional creation-time status (absent → `raw`, invalid → error, not silent coerce); new `updateLayerStatus` export (membership-only, status-field-only UPDATE)
- `src/components/records/TextLayerCard.tsx` — wires in both new forms; "Edit / Transcribe" button on source_ocr/source_transcription layers; `UpdateLayerStatusForm` on all active layers; mutually exclusive form state

---

## Key Decisions

- **super_admin excluded from UPDATE policy and action**: SELECT policy is membership-only; keeping both consistent avoids a read/write boundary mismatch. Documented in migration comment and action comment.
- **No supersedes_layer_id on corrected_transcription**: cross-type supersession is already rejected by existing validation; new row is a fresh contribution not a version of the source layer.
- **Creation-time status**: absent = `raw` (backward compat); present + invalid = error (not silent coerce, per addendum).
- **Immutability trigger guards `id`**: added after code review (P1 finding); `IS DISTINCT FROM` used throughout for null-safe comparisons on nullable fields.

---

## Addendums Applied

1. Invalid creation-time status returns an error rather than silently coercing to `raw`.
2. Immutability trigger uses `IS DISTINCT FROM` for all nullable fields (`language`, `supersedes_layer_id`) and for `id`.
3. UPDATE policy uses identical `USING` and `WITH CHECK` expressions (no `is_super_admin()` in either clause).
4. `lint` added to verification checklist and run before merge.

---

## Code Review Findings Addressed

- **P1**: Added `NEW.id IS DISTINCT FROM OLD.id` to immutability trigger.
- **P2**: Removed `is_super_admin()` from UPDATE RLS policy and replaced `assertLayerPermission` in `updateLayerStatus` with a direct membership-only check — eliminates read/write boundary mismatch.

---

## Acceptance Criteria (all satisfied)

1. Open a record with a `source_ocr` or `source_transcription` layer → "Edit / Transcribe" button is visible ✓
2. Click → editor opens pre-filled with source content; save creates new `corrected_transcription`; source layer unchanged ✓
3. Status select allows `raw`, `reviewed`, `needs_expert_review` at creation time ✓
4. `UpdateLayerStatusForm` allows all 5 statuses post-creation ✓
5. Reload → corrected transcription persists with correct status label ✓
6. Source text layer still present with original content intact ✓

---

## Verification

- `npx tsc --noEmit` — PASS
- `npx next build` — PASS
- `npx next lint` — PASS
- `updateLayerStatus` UPDATE payload contains only `{ status: newStatus }` — verified by code review
- DB trigger blocks immutable field changes — confirmed in migration SQL
- Existing callers (AddTextLayerForm, CreateLayerVersionForm) send no `status` → default to `raw` — backward compat confirmed
