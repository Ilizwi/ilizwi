# F005 — Canonical Record Creation
Date: 2026-03-13
Status: PASSED
PR: #5 (squash merged to main)

## Objective

Complete Day 1 by adding a record detail page, a `text_layers` table, and an `addTextLayer` server action — making provenance visible and text-layer content additive without touching file assets.

## Approach

Minimal scope: migration + types + server action + detail page + form. No editor, no OCR, no machine translation. Three parallel agents (foundation, backend, frontend) then a quality gate.

## Files Created or Modified

| Action | Path |
|--------|------|
| CREATE | `supabase/migrations/20260313000001_f005_text_layers.sql` |
| CREATE | `supabase/migrations/20260313000002_f005_drop_text_layers_update_policy.sql` |
| MODIFY | `src/types/index.ts` — added `TextLayer` type |
| CREATE | `src/lib/actions/text-layers.ts` — `addTextLayer` server action |
| CREATE | `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` — record detail page |
| CREATE | `src/components/records/AddTextLayerForm.tsx` — client form component |
| MODIFY | `src/app/(app)/projects/[id]/records/page.tsx` — canonical_ref cell links to detail page |

## Steps Completed

1. Migration — `text_layers` table with idempotent enum creation (`layer_type`, `layer_status`, `layer_source_method`), RLS (SELECT for project members, INSERT for super_admin/project_admin/researcher), `updated_at` trigger. No UPDATE policy shipped (see review fix below).
2. Types — `TextLayer` type added after `FileAsset` in `src/types/index.ts`.
3. Server action — `addTextLayer` in dedicated `src/lib/actions/text-layers.ts`; permission guard mirrors F003 pattern; derives `project_id` from `source_records` (not client-supplied form field); translator/reviewer denied with friendly error; audit log; `revalidatePath`.
4. Detail page — combined tenancy guard (`project_id` + `recordId` in one query); provenance panel (read-only grid); file assets table; text layers table with type/status badges; `AddTextLayerForm` shown only to project_admin/researcher/super_admin.
5. Form — `AddTextLayerForm` client component; `useActionState`; layer_type select, content textarea, optional language, source_method select.
6. Records list — canonical_ref cell wrapped in `<Link>` to detail page.

## Review Fixes (post-review, same PR)

- **P1:** Removed `text_layers_update_owner` UPDATE policy. Compensating migration `20260313000002` drops it from remote; original migration updated so fresh installs never create it. Reason: content immutability invariant, no F005 UI uses UPDATE, policy was not scoped to current project membership.
- **Tightened app-layer guard:** `addTextLayer` now derives `project_id` by querying `source_records` on the server rather than trusting the hidden `projectId` form field.

## Acceptance Criteria — All Satisfied

1. Upload a record via `/projects/{id}/upload` → succeeds, record appears in list. ✓ (F003/F004)
2. Open record detail → source_archive, source_type, publication_title, language, date_issued, canonical_ref all visible. ✓
3. File assets section shows uploaded file; text_layers section is empty (separate table). ✓
4. Refresh detail page → provenance fields unchanged. ✓
5. Add a text layer via the form → layer appears in text layers section; file asset unchanged. ✓

## Known Limitations / Deferred

- No status-only UPDATE path for text layers. When needed (F011 or later), add a constrained migration with DB-level column enforcement and a current-project-membership check.
- `LEGACY-{uuid}` sentinel rows from pre-F004 development remain visible in the detail page as-is. They are valid unique canonical refs; no special handling needed.
- Storage path is `{projectId}/{recordId}/{filename}` — not aligned with canonical_ref. Deferred.
- No automated tests for text-layer authorization paths. Deferred to a testing feature.
