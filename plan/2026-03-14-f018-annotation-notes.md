# F018 — Annotation and Notes

**Date:** 2026-03-14
**Branch:** `codex/f018-annotation-notes`
**Priority:** P0 | Day 4

---

## Context

F001–F017 are all complete. F018 is the correct next feature.

F018 allows researchers to attach typed annotations to records (and optionally to specific text layers), with full author attribution and edit capability. This enables scholarly documentation of historical context, contested terms, names, and disputes directly in the platform.

Types already exist in `src/types/index.ts` (`AnnotationType`, `FlagType`) — the DB table and UI are what's missing.

**Scope:** Create, Read, Update. No delete/deactivate in this version.

---

## Objective

Implement the full annotation CRU workflow: create, read, update, display annotations on the record detail page, with author attribution and type selection.

---

## Approach

Consistent with all prior features:
- Supabase migration for the `annotations` table with RLS
- Server actions for add and update (return `{ error }`, callers handle redirects)
- Component panel rendered in the record detail page
- Edit via URL search param (`?editAnnotation=<id>`) consistent with glossary pattern
- `project_id` derived server-side from `record_id` (no client trust)
- `text_layer_id` validated against `record_id` in both action and DB

---

## Addendums (Approved 2026-03-14)

1. **No client-supplied `project_id`**: For `addAnnotation`, derive `project_id` from `record_id` server-side. For `updateAnnotation`, derive project/record context from `annotation_id`. Matches the "server-derived, no client trust" pattern throughout.

2. **`text_layer_id` consistency check**: If provided, must belong to the same `record_id`. Enforced in the action (explicit query) and ideally also at DB level via a trigger or partial check strategy.

3. **Action pattern alignment**: Actions return `{ error: string | null }` and revalidate. Page-level server action wrappers handle redirects and `?editAnnotation=` transitions. Actions themselves do not redirect.

4. **Verification commands**: `npm run build`, `npm run typecheck`, `npm run lint` (not pnpm).

5. **Tightened scope**: Create/Read/Update only. No delete/deactivate.

6. **Authorization verification**: Manual test must include an actual non-author update attempt to confirm RLS/action layer rejects it — not just UI hiding.

7. **`profiles` join**: Verify relationship name matches generated Supabase FK. Use explicit FK-qualified join if needed.

---

## Files to Create or Modify

### New files
1. `supabase/migrations/20260314000005_f018_annotations.sql`
2. `src/lib/actions/annotations.ts`
3. `src/components/records/AnnotationsPanel.tsx`

### Modified files
4. `src/types/index.ts` — add `Annotation` interface
5. `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` — fetch annotations, render `<AnnotationsPanel />`

---

## Steps

### 1. Migration

```sql
CREATE TYPE annotation_type_enum AS ENUM (
  'editorial_note', 'context_note', 'term_note', 'translation_note', 'dispute_note'
);

CREATE TABLE annotations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  record_id        UUID NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  text_layer_id    UUID REFERENCES text_layers(id) ON DELETE SET NULL,
  annotation_type  annotation_type_enum NOT NULL,
  content          TEXT NOT NULL CHECK (char_length(content) > 0),
  created_by       UUID NOT NULL REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS policies:
- SELECT: project member OR super_admin
- INSERT: project member (any role) OR super_admin
- UPDATE: author (`created_by = auth.uid()`) OR project_admin OR super_admin

Indexes: `record_id`, `project_id`

`updated_at` trigger consistent with prior tables.

### 2. Types — `src/types/index.ts`

Add `Annotation` interface with `profiles?` join shape.

### 3. Server actions — `src/lib/actions/annotations.ts`

**`addAnnotation(prevState, formData)`**
- Requires authenticated session
- Derives `project_id` from `record_id` (not client field)
- If `text_layer_id` provided: validates it belongs to same `record_id`
- Verifies caller is project member
- Returns `{ error: string | null }`
- `revalidatePath` on success

**`updateAnnotation(prevState, formData)`**
- Derives `record_id`/`project_id` from `annotation_id`
- Validates caller is author OR project_admin OR super_admin
- Only updates `content` (type is immutable)
- Returns `{ error: string | null }`

### 4. Component — `src/components/records/AnnotationsPanel.tsx`

Server component (no "use client" needed since forms use server action wrappers in the page).

Props: `annotations`, `textLayers`, `projectId`, `recordId`, `currentUserId`, `canEditAll` (for admins), `editAnnotationId` (from search param).

Design: scholarly marginalia style — subtle left border, muted type labels, reverse-chronological list.

### 5. Record detail page

Fetch annotations with profiles join. Pass `editAnnotation` search param. Render `<AnnotationsPanel />` below Text Layers section.

---

## Review Findings and Fixes (Applied 2026-03-14)

**[P0] INSERT policy too weak** — Fixed in migration `20260314000006`:
- Added `created_by = auth.uid()` (prevents authorship forgery)
- Added `project_id` ↔ `source_records.project_id` consistency check (prevents cross-project linkage via forged project_id)
- Added `text_layer_id` ↔ `record_id` consistency check at DB layer (not only in server action)

**[P1] Wrong `canEditAll` flag** — Fixed in `page.tsx`:
- Introduced separate `canEditAllAnnotations` flag: `super_admin OR project_admin` only
- Researchers can add layers (`canAddLayer`) but cannot edit others' annotations (`canEditAllAnnotations`)
- `canAddLayer` was erroneously reused — now corrected

**[P1] Author attribution blocked by profiles RLS** — Fixed in migration `20260314000006`:
- Added `profiles_select_project_peers` SELECT policy: project members can read display_name/email of fellow project members
- Scope is minimal — only shared-project peers exposed; broader profile privacy preserved

**Migrations:** `20260314000005` (initial), `20260314000006` (hardening/review fixes)

---

## Acceptance Criteria

1. Open a record → add an annotation with a type and content → save → annotation appears in list with author name
2. Optionally link annotation to a specific text layer → layer label visible in list
3. Author attribution correct (display_name or email)
4. Navigate away and return → annotation still visible
5. Edit annotation as author → updated content persists; as non-author non-admin → edit button hidden

---

## Verification

```bash
npm run build
npm run typecheck
npm run lint
```

Manual:
- Apply migration via Supabase dashboard or `supabase db push`
- Create annotation as researcher → appears in record
- Edit as same user → content updates
- Actual HTTP/action call as different non-admin user → action returns error (not just UI hidden)
- Log in as project_admin → edit button visible on all annotations
