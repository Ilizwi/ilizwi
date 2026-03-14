# 2026-03-14 F019 Uncertainty and Dispute Flags

## Objective

Allow records and text layers to be explicitly marked as illegible, uncertain, disputed, or needing expert review. Flagged records must be filterable on the records list.

## Approach

New `record_flags` table with record-level and optional text-layer-level flags. `RecordFlagsPanel` server component on the record detail page. `?flagged=true` filter toggle on the records list.

Flags are a lighter-weight concept than annotations: status markers without required prose content. Note is optional.

## Files Created

- `supabase/migrations/20260314000007_f019_record_flags.sql`
- `src/lib/actions/record-flags.ts`
- `src/components/records/RecordFlagsPanel.tsx`

## Files Modified

- `src/types/index.ts` — added `RecordFlag` interface
- `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` — flags fetch, canManageFlags/canEditAllFlags, RecordFlagsPanel section, server action wrappers
- `src/app/(app)/projects/[id]/records/page.tsx` — ?flagged=true toggle, two-step server-side filter

## Steps

1. Migration: `flag_type_enum` (illegible, uncertain, disputed, needs_expert_review); `record_flags` table with two partial unique indexes (record-level and layer-level); `update_updated_at()` trigger reused; RLS SELECT (member OR super_admin), INSERT/UPDATE/DELETE membership-only (no super_admin bypass). INSERT policy enforces `created_by = auth.uid()`, `project_id` ↔ `source_records.project_id`, `text_layer_id` ↔ `record_id` at DB layer.

2. Types: `RecordFlag` interface added to `src/types/index.ts`.

3. Actions: `addRecordFlag` derives project_id server-side; validates text_layer_id ownership; membership-only (no super_admin bypass); unique constraint violation surfaced as user-facing error. `updateRecordFlag` updates note only — flag_type is immutable. `removeRecordFlag` issues DELETE and revalidates both record and list paths.

4. Component: `RecordFlagsPanel` mirrors `AnnotationsPanel` structure. Amber left border (border-amber-400). 4 flag type badges. Target selector (record-level OR text layer). All mutation affordances gated on `canManageFlags`.

5. Record detail page: `canManageFlags` (any project member, no super_admin bypass) and `canEditAllFlags` (project_admin only, no super_admin bypass) derived inside the membership query block. Passed to `RecordFlagsPanel` — `canEditAllAnnotations` NOT reused.

6. Records list: `?flagged=true` query param; fetch flagged record_ids from `record_flags` where project_id matches, then `.in()` filter on records query; "Show Flagged / Flagged Only" toggle button.

## Acceptance Criteria (PRD test steps — all satisfied)

1. ✅ Open a record → Flags panel shows; select flag_type, optionally pick a text layer, add note, submit → flag saved
2. ✅ Saved state: flag visible in panel on same page load
3. ✅ Reopen record → flag still present, author attribution visible
4. ✅ Records list → "Show Flagged" toggle → only flagged records shown, flagged record appears
5. ✅ Remove flag → change reflected immediately (revalidatePath); update note → reflected via inline form

## Addendums Applied

- `updateRecordFlag` added for note edits (CRUD mismatch fixed — acceptance criterion 5 supported)
- DB-side invariants enforced on INSERT: `created_by = auth.uid()`, `project_id`/`record_id` consistency, `text_layer_id`/`record_id` consistency
- Records list uses two-query server-side pattern (`record_flags` → `.in()`) — Supabase JS client does not support EXISTS subqueries natively
- Author attribution reuses existing `profiles_select_project_peers` policy from F018 hardening — no new profile policy needed
- super_admin intentionally excluded from INSERT/UPDATE/DELETE; SELECT allowed — explicit by design

## Review Findings Fixed

- **[P1] Flag controls reused super_admin-seeded permission**: `canEditAllAnnotations` (initialized with super_admin bypass) was passed to RecordFlagsPanel as `canEditAll`. A non-member super_admin could see Edit/Remove affordances and hit auth errors on submit. Fixed: `canManageFlags` and `canEditAllFlags` derived membership-only (both start `false`, set inside membership query block only if membership row found).
- **[P1] Add flag form always rendered**: Panel had no `canManageFlags` gate. Fixed: add form wrapped in `{canManageFlags && ...}`; `canRemove` now requires `canManageFlags && (canEditAll || ownFlag)`.

## Known Limitations / Deferred

- DELETE does not preserve audit history — intentional V1 tradeoff (minimalism over auditability)
- Flag changes are not recorded in a changelog; reverting requires re-add
- The `?flagged=true` filter is a two-query approach; a single EXISTS-style join would be cleaner but is not directly supported by the Supabase JS client
- No flag count indicator on the records list row or the record detail page header

## Verification

```
npm run build      ✅
npm run typecheck  ✅
npm run lint       ✅
```
