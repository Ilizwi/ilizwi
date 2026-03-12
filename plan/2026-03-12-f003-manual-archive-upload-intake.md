# Plan: F003 — Manual Archive Upload Intake

**Date:** 2026-03-12
**Branch:** `codex/f003-manual-archive-upload-intake`
**Status:** Approved with addendums

---

## Objective

Users can upload an archival file into a project, fill in required metadata (source archive, publication title, language, date issued), and see the record appear in the project's record list. The original file is stored immutably and provenance is preserved.

---

## Addendums Applied (from review)

1. **Pre-generate `record_id`** in application code before upload — use same UUID for storage path and both DB inserts.
2. **Compensating (not atomic) transaction** — Storage + DB are separate systems. Clear rollback strategy per step (see Upload Transaction Model below).
3. **Explicit server-side role enforcement** — `project_admin` and `researcher` allowed; `translator` and `reviewer` explicitly denied. Do not rely on RLS alone.
4. **Bucket creation in migration SQL** — reproducible, not dashboard-only.
5. **Server-side file validation** — required, non-zero size, allowed mime types (`application/pdf`, `image/*`), max 50MB, sanitized storage filename, `upsert: false`.
6. **File asset read access derived from project membership** — no separate looser rule; access flows through parent record's project.
7. **SQL enums for constrained values** — `source_type`, `record_status`, `asset_type` all use `CREATE TYPE ... AS ENUM`.
8. **Sanitize storage filenames** — strip path separators, normalize to alphanumeric + hyphens + dots.

---

## Database Schema

```sql
-- Enums (constrained values, not raw text)
CREATE TYPE source_type AS ENUM ('manual_readex', 'ibali', 'nlsa', 'wits');
CREATE TYPE record_status AS ENUM ('raw', 'in_review', 'approved');
CREATE TYPE asset_type AS ENUM ('source_file', 'transcription_file', 'export', 'derived_asset');

-- source_records: one row per archival item
CREATE TABLE source_records (
  id               uuid PRIMARY KEY,  -- app-generated, pre-upload
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type      source_type NOT NULL DEFAULT 'manual_readex',
  source_archive   text NOT NULL,
  publication_title text NOT NULL,
  language         text NOT NULL,
  date_issued      date,
  date_issued_raw  text,  -- for partial/uncertain dates
  page_label       text,
  record_status    record_status NOT NULL DEFAULT 'raw',
  created_by       uuid NOT NULL REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- file_assets: files attached to records
CREATE TABLE file_assets (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id        uuid NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  asset_type       asset_type NOT NULL DEFAULT 'source_file',
  storage_path     text NOT NULL,
  original_filename text NOT NULL,
  mime_type        text,
  size_bytes       bigint,
  is_original      boolean NOT NULL DEFAULT true,
  uploaded_by      uuid NOT NULL REFERENCES profiles(id),
  uploaded_at      timestamptz NOT NULL DEFAULT now()
);
```

**RLS rules:**
- `source_records`: SELECT — project member; INSERT — project_admin or researcher; no UPDATE/DELETE on source_file records.
- `file_assets`: SELECT — derived from parent record's project membership (use `is_project_member` helper); INSERT — project_admin or researcher; no UPDATE/DELETE where `is_original = true`.

---

## Upload Transaction Model (Compensating)

Storage and DB cannot be truly atomic. Explicit rollback at each step:

```
1. assertUploadPermission → must be project_admin or researcher (else return error)
2. Validate file → required, non-zero size, allowed mime, ≤50MB (else return error)
3. record_id = crypto.randomUUID()  ← generated before any I/O
4. safe_filename = sanitize(originalFilename)
5. storagePath = `archive-files/${projectId}/${record_id}/${safe_filename}`

6. Upload file to storagePath (upsert: false)
   → On failure: return { error }  [nothing to clean up]

7. INSERT source_records (id = record_id)
   → On failure: DELETE storagePath → return { error }

8. INSERT file_assets (record_id = record_id)
   → On failure: DELETE storagePath + DELETE source_records WHERE id = record_id → return { error }

9. Audit log: actor, project_id, record_id, filename, mime_type
10. revalidatePath → return { recordId }
```

---

## Files to Create or Modify

| File | Action |
|------|--------|
| `supabase/migrations/YYYYMMDD_f003_source_records.sql` | Create |
| `src/types/index.ts` | Modify — add SourceRecord, FileAsset types |
| `src/lib/actions/records.ts` | Create — uploadRecord server action |
| `src/components/records/UploadForm.tsx` | Create — client upload form |
| `src/app/(app)/projects/[id]/upload/page.tsx` | Create — upload page |
| `src/app/(app)/projects/[id]/records/page.tsx` | Create — records list page |
| `src/app/(app)/projects/[id]/page.tsx` | Modify — add records section/link |

---

## Implementation Tasks

### Task 1: Database Migration (Backend Agent)
Write `supabase/migrations/YYYYMMDD_f003_source_records.sql`:
- Create enums: `source_type`, `record_status`, `asset_type`
- Create `source_records` table (id is app-generated, no DEFAULT gen_random_uuid())
- Create `file_assets` table
- Create storage bucket via `storage.buckets` insert: `archive-files`, public=false
- Add `is_project_member()`-based RLS policies for both tables
- Add `update_updated_at` trigger on `source_records`
- Apply with `supabase db push`

### Task 2: TypeScript Types (Frontend Agent — do first)
Update `src/types/index.ts`:
- Add `RecordStatus` type: `'raw' | 'in_review' | 'approved'`
- Add `SourceRecord` type (mirrors source_records table)
- Add `FileAsset` type (mirrors file_assets table)
- Note: `SourceType` and `AssetType` stubs already exist — align/expand them

### Task 3: Server Action (Backend Agent — after types)
Create `src/lib/actions/records.ts`:
- `assertUploadPermission(supabase, projectId, callerId)` — checks project_admin or researcher role only; translator/reviewer return error
- `sanitizeFilename(name: string): string` — strips path chars, normalizes
- `uploadRecord(_prevState, formData)` — full compensating flow per model above
- Allowed mime types: `application/pdf`, `image/jpeg`, `image/png`, `image/tiff`, `image/webp`
- Max file size: 50MB
- `upsert: false` on storage upload

### Task 4: UploadForm Component (Frontend Agent)
Create `src/components/records/UploadForm.tsx`:
- `"use client"` — uses `useActionState`
- File picker input (accept: pdf, image/*)
- Fields: source_archive (required), publication_title (required), language (required), date_issued (optional), page_label (optional)
- source_type dropdown: manual_readex | ibali | nlsa | wits
- Shows inline error from action state
- On success: redirect to `/projects/[id]/records`
- Follows ILIZWI design tokens (desk-text, desk-border, vault-surface, font-serif headings, font-sans body)

### Task 5: Upload Page (Frontend Agent)
Create `src/app/(app)/projects/[id]/upload/page.tsx`:
- Server component
- Calls `requireProjectMember(id)` — redirects non-members
- Checks caller role: only project_admin and researcher can access; others redirect to `/projects/[id]`
- Renders `<UploadForm projectId={id} />`
- ILIZWI layout consistent with other project pages

### Task 6: Records List Page (Frontend Agent)
Create `src/app/(app)/projects/[id]/records/page.tsx`:
- Server component
- Calls `requireProjectMember(id)`
- Queries `source_records` for project, ordered by created_at desc
- Shows: publication_title, source_archive, language, date_issued/date_issued_raw, record_status, created_at
- Empty state with link to upload
- Each row links to record detail (placeholder for F004+)
- Upload button for project_admin and researcher roles

### Task 7: Project Detail Update (Frontend Agent)
Modify `src/app/(app)/projects/[id]/page.tsx`:
- Query count of `source_records` for project
- Add "Records" section below Team section
- Show count + link to `/projects/[id]/records`
- Upload link for project_admin and researcher roles

---

## Acceptance Criteria

- [ ] Researcher can upload a file within a project
- [ ] Required fields enforced server-side (source_archive, publication_title, language)
- [ ] File stored at deterministic path: `{project_id}/{record_id}/{safe_filename}`, upsert: false
- [ ] `source_records` row created and linked to project
- [ ] `file_assets` row created and linked to record
- [ ] Record visible after page reload (persists)
- [ ] Original file preserved — no silent overwrite
- [ ] Only project_admin and researcher can upload (both page-level guard AND server action check)
- [ ] translator/reviewer attempting upload (direct POST) gets explicit "Insufficient permissions" error
- [ ] Storage + DB failure leaves no orphans (compensating cleanup verified)
- [ ] Constrained fields use SQL enums, not raw text

---

## Verification Steps

1. Login as researcher → project → click Upload → upload file with all fields → confirm success → navigate to records list
2. Check Supabase Storage → file at expected path
3. Reload records page → record still present
4. Try upload without required fields → confirm validation error
5. Login as translator → navigate to upload URL directly → confirm redirect
6. Direct POST as translator → confirm "Insufficient permissions"
7. Build passes, typecheck passes, lint passes
