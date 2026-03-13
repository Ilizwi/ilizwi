# F014 — Translation Editor and Correction Workflow
**Date:** 2026-03-13
**Branch:** `codex/f014-translation-editor-correction-workflow`
**Status:** PASSED — squash merged to main (PR #14)

## Post-Implementation Review Fixes

**P1 — Superseded source layer check (save-translation-correction.ts)**
The initial implementation verified that `sourceLayerId` pointed to a `machine_translation` layer but did not verify the layer was still active. A crafted request against a superseded MT draft would have passed the type check and created a `corrected_translation` from an obsolete source. Fix: added a `count` query for `text_layers` rows with `supersedes_layer_id = sourceLayerId`; if any exists, the layer is superseded and the action returns an error before INSERT.

**P2 — super_admin shortcut removed from canCorrectTranslation (page.tsx)**
The frontend agent initialised `canCorrectTranslation` from `profile.global_role === "super_admin"`, mirroring how `canAddLayer` is initialised. However `saveTranslationCorrection` is membership-only (no super_admin bypass) and the `text_layers` SELECT policy is also membership-only. This created the same read/write boundary mismatch removed in F012/F013: a non-member super_admin would see the "Correct Translation" button but the server action would reject the submission. Fix: `canCorrectTranslation` initialised to `false` and set exclusively from the membership query.

---

## Objective

Allow a researcher, translator, or project admin to open a `machine_translation` draft, edit its content, and save a `corrected_translation` layer that:
- Records `source_layer_id` → the originating MT layer (provenance, not supersession)
- Records `created_by` (user.id from session) and `created_at` (DB default) automatically
- Is distinct from and does not replace the original machine translation draft
- Is accessible alongside the MT draft on record reopen

---

## Context

F013 added machine translation draft generation. F014 closes the translation loop by giving researchers and translators a way to open a machine translation draft, edit it, and save the correction as a distinct `corrected_translation` text layer — while keeping the original machine translation draft intact.

### Resolved Design Issues

1. **Cross-type supersession is invalid.** The existing `addTextLayer` action rejects `supersedes_layer_id` if the referenced layer is a different `layer_type`. `machine_translation` → `corrected_translation` is a cross-type derivation, not a same-type version replacement. The corrected_translation layer uses `source_layer_id = <MT layer ID>`, not `supersedes_layer_id`. Both layers remain active.

2. **Dedicated server action.** A new `saveTranslationCorrection` action handles the permission check that explicitly includes `translator` role. Does not overload `addTextLayer`.

3. **RLS migration required (confirmed).** The app uses the session-bound Supabase client (not service-role). The current `text_layers_insert_contributor` policy only allows `super_admin`, `project_admin`, and `researcher`. Translator INSERT support requires an RLS migration.

### Addendums (from plan review)
- Mirror existing `text_layers_insert_contributor` policy shape with `source_records` + `project_memberships` join. No new SQL helper functions.
- In `saveTranslationCorrection`, derive `record_id`, `project_id`, and source language from the validated `sourceLayerId` on the server. Language is not accepted as client input.
- Language field in the editor is read-only display only (not submitted as form data).

---

## Approach

- New RLS migration: add INSERT policy for `translator` role on `corrected_translation` layers
- New server action `saveTranslationCorrection`: validates translator/researcher/admin role, derives language from MT layer server-side, inserts `corrected_translation` with `source_layer_id`
- New `TranslationEditorForm` component: mirrors `TranscriptionEditorForm`, language is read-only
- Modify `TextLayerCard`: add `canCorrectTranslation` prop and "Correct Translation" trigger
- Modify record detail page: derive `canCorrectTranslation` flag including `translator` role

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260313000006_f014_translation_correction_rls.sql` | INSERT policy for translator role on corrected_translation |
| `src/lib/actions/save-translation-correction.ts` | Server action: validates role, inserts corrected_translation with source_layer_id |
| `src/components/records/TranslationEditorForm.tsx` | Editor component: pre-filled textarea, language read-only, calls saveTranslationCorrection |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/records/TextLayerCard.tsx` | Add `canCorrectTranslation` prop and "Correct Translation" button for machine_translation layers |
| `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` | Derive `canCorrectTranslation` flag (includes translator role), pass to TextLayerCard |

---

## Steps

### 1. Migration: extend INSERT RLS for translator role

New policy mirrors `text_layers_insert_contributor` shape:

```sql
CREATE POLICY "text_layers_insert_translator"
  ON text_layers FOR INSERT
  WITH CHECK (
    layer_type = 'corrected_translation'
    AND EXISTS (
      SELECT 1 FROM source_records sr
      JOIN project_memberships pm ON pm.project_id = sr.project_id
      WHERE sr.id = text_layers.record_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'translator'
    )
  );
```

### 2. Create `saveTranslationCorrection` server action

- Params (from formData): `sourceLayerId`, `content`
- Fetch source layer → derive `record_id`, `project_id`, `language` (server-side, no client trust)
- Validate source layer is `machine_translation` type and active
- Permission check: user must be `project_admin`, `researcher`, OR `translator` on the record's project
- Insert `corrected_translation` with:
  - `layer_type = corrected_translation`
  - `source_method = manual_entry`
  - `source_layer_id = sourceLayerId`
  - `supersedes_layer_id = NULL`
  - `status = raw`
  - `language = (from source layer)`
- Audit log
- `revalidatePath` on record page

### 3. Create `TranslationEditorForm.tsx`

- Props: `recordId`, `sourceContent`, `sourceLanguage`, `sourceLayerId`, `onClose`
- Hidden input: `sourceLayerId` (passed to server action)
- `recordId` not needed as a form input — server derives from sourceLayerId
- Textarea pre-filled with `sourceContent`
- Language: read-only display (not a form field, not submitted)
- `useActionState(saveTranslationCorrection, ...)`
- Auto-close on success via `useEffect` + submitted ref
- `disabled={isPending}` on submit button

### 4. Modify `TextLayerCard.tsx`

- Add `canCorrectTranslation: boolean` prop
- Add `showTranslationForm` state
- "Correct Translation" button shown when: `layer.layer_type === 'machine_translation'` AND `!isSuperseded` AND `canCorrectTranslation`
- Render `<TranslationEditorForm>` inline when `showTranslationForm` is true

### 5. Modify record detail page

- Derive `canCorrectTranslation`: membership check includes `translator` role alongside `researcher` and `project_admin`
- Pass to each `TextLayerCard` instance

---

## Acceptance Criteria (PRD F014)

| # | Step | How Satisfied |
|---|------|---------------|
| 1 | Open a machine translation draft | TextLayerCard shows "Correct Translation" on machine_translation layers |
| 2 | Edit the draft and save a corrected translation | TranslationEditorForm → saveTranslationCorrection creates corrected_translation row |
| 3 | Corrected translation stored with author + timestamp | `created_by` (user.id from session) and `created_at` (DB default) auto-populated |
| 4 | Original MT draft remains preserved separately | MT layer row untouched; no supersedes_layer_id set on it from this operation |
| 5 | Reopen record, both versions accessible | Both appear in active layers section with distinct layer_type labels |

---

## Invariants Preserved

- No cross-type supersession (same-type invariant in addTextLayer unchanged)
- `source_layer_id` immutability preserved (set at insert, never updated)
- `corrected_translation` is semantically downstream of `machine_translation`, not a replacement
- Language is server-derived from the source MT layer (not client-supplied)
- Membership-only permission boundary maintained
