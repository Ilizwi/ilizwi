# F006: Ibali Source Integration

**Date:** 2026-03-13
**Branch:** `codex/f006-ibali-source-integration`
**Status:** APPROVED WITH ADDENDUMS

---

## Context

Day 1 (F001–F005) is complete. F006 is the first source integration — connecting the platform to the UCT Ibali archive (Omeka S). The Ibali API is publicly reachable and confirmed working. The known test item is Isigidimi sama-Xosa 1870-10-01 (`item id: 180673`). Ibali media payloads include `extracttext:extracted_text` (transcription text) and downloadable `.docx` file URLs.

Goal: allow a researcher to enter an Ibali item ID, import metadata + transcription text, and have it saved as a canonical internal record with Ibali provenance.

---

## Approach

Server-side fetch-only (no credentials, Ibali API is public). All mapping happens in a server action. The Ibali adapter is a pure module with no directives so it can be shared. File assets store external `.docx` URLs (not downloaded) — `storage_path` becomes nullable to support external references. Extracted text stored as a text_layer.

---

## Addendums (from review)

### A1: Idempotency / Dedupe Invariant

**Rule:** Re-importing the same Ibali item into the same project must be a no-op that returns the existing record — never create duplicates.

**Implementation:**
- Add a UNIQUE constraint (partial index) on `source_records(project_id, source_type, source_identifier)` WHERE source_identifier IS NOT NULL.
- In `importFromIbali`: before inserting, query for an existing record matching `(project_id, source_type='ibali', source_identifier=itemId)`.
- If found: return `{ error: null, recordId: existing.id }` immediately — no re-insert, no duplicate children.
- Error message if constraint is ever hit at DB level: "This Ibali item has already been imported into this project."

### A2: file_assets Location Invariant (CHECK Constraint)

**Rule:** Every `file_assets` row must have exactly one location source — either `storage_path` IS NOT NULL or `source_url` IS NOT NULL (but not neither, and not both).

**SQL:**
```sql
ALTER TABLE file_assets
  ADD CONSTRAINT file_assets_location_check
  CHECK (
    (storage_path IS NOT NULL AND source_url IS NULL)
    OR
    (storage_path IS NULL AND source_url IS NOT NULL)
  );
```

This protects the schema-wide provenance invariant — making `storage_path` nullable does not introduce an invalid null-null state.

### A3: Compensating Behavior for Partial Failures

**Rule:** The import is all-or-nothing. Partial success is not accepted or surfaced.

**Rollback order in `importFromIbali`:**

1. `source_records` INSERT succeeds → proceed to children
2. Any `file_assets` INSERT fails:
   - DELETE the `source_records` row
   - Return `{ error: "Import failed: could not register file reference. No record was saved." }`
3. Any `text_layers` INSERT fails:
   - DELETE any already-inserted `file_assets` rows for this record
   - DELETE the `source_records` row
   - Return `{ error: "Import failed: could not save transcription layer. No record was saved." }`

No partial record is left in the database. Rollback is explicit (Supabase JS client does not provide multi-statement transactions).

### A4: Timeout and Error-Shaping for Ibali API Fetches

**Rule:** External API drift and slow responses must not hang the server action indefinitely.

**Implementation in `ibali.ts`:**
- All fetches use `AbortSignal.timeout(10_000)` (10-second limit).
- Three distinct error shapes:
  - `{ type: 'not_found' }` — HTTP 404 from Ibali
  - `{ type: 'timeout' }` — AbortError / timeout
  - `{ type: 'network', message }` — all other fetch failures
- `importFromIbali` maps each error type to a user-visible message:
  - not_found → "Ibali item {id} was not found. Check the item ID and try again."
  - timeout → "Ibali API did not respond in time. Try again shortly."
  - network → "Could not reach the Ibali API: {message}"

### A5: Role-Check Pattern — Exact Reuse

**Rule:** Do not introduce any new generic "source import" abstraction. Reuse the identical `assertXxxPermission` pattern from `records.ts` and `text-layers.ts`.

**Implementation:**
- In `import-ibali.ts`: define `assertImportPermission(supabase, projectId, callerId)` — identical structure to `assertUploadPermission` and `assertLayerPermission`.
- Allowed roles: `project_admin`, `researcher`.
- This function is local to `import-ibali.ts` — not shared or abstracted further.

### A6: Server-Side Role Gate (Negative Path)

**Rule:** The server action must reject translator/reviewer roles even if they POST directly (not just UI gating).

**Verification:** acceptance criteria include a direct `importFromIbali` call by a translator/reviewer user returning `{ error: "Insufficient permissions..." }`.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260313000003_f006_ibali_fields.sql` | Add `source_identifier`, `source_url` to `source_records`; add `source_url` to `file_assets`; make `storage_path` nullable; add location CHECK constraint; add dedupe partial unique index |
| `src/lib/sources/ibali.ts` | Ibali API adapter — fetch item + media, map to internal types, timeout + error shaping |
| `src/lib/actions/import-ibali.ts` | Server action — idempotency check, orchestrated import, full compensating rollback, role guard |
| `src/app/(app)/projects/[id]/import/ibali/page.tsx` | Import page — role-gated server component |
| `src/components/records/IbaliImportForm.tsx` | Client form — item ID input, useActionState, success/error state |

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `source_identifier`, `source_url` to `SourceRecord`; add `source_url`, make `storage_path` optional on `FileAsset` |
| `src/app/(app)/projects/[id]/page.tsx` | Add "Import from Ibali" link (role-gated to project_admin/researcher) |

---

## Steps

### Step 1: Migration

File: `supabase/migrations/20260313000003_f006_ibali_fields.sql`

```sql
-- source_records: external source provenance fields
ALTER TABLE source_records
  ADD COLUMN IF NOT EXISTS source_identifier text,
  ADD COLUMN IF NOT EXISTS source_url text;

-- Dedupe invariant: same external item cannot be imported twice into same project
CREATE UNIQUE INDEX IF NOT EXISTS source_records_project_source_dedup_idx
  ON source_records (project_id, source_type, source_identifier)
  WHERE source_identifier IS NOT NULL;

-- file_assets: support external URL references
ALTER TABLE file_assets
  ADD COLUMN IF NOT EXISTS source_url text;

-- Allow null storage_path for external-reference assets
ALTER TABLE file_assets
  ALTER COLUMN storage_path DROP NOT NULL;

-- Location invariant: exactly one of storage_path or source_url must be set
ALTER TABLE file_assets
  ADD CONSTRAINT file_assets_location_check
  CHECK (
    (storage_path IS NOT NULL AND source_url IS NULL)
    OR
    (storage_path IS NULL AND source_url IS NOT NULL)
  );
```

### Step 2: Ibali Adapter (`src/lib/sources/ibali.ts`)

No `"use server"` — pure TypeScript module.

**Types:**
- `IbaliErrorType`: `'not_found' | 'timeout' | 'network'`
- `IbaliError`: `{ type: IbaliErrorType; message?: string }`
- `IbaliFetchResult<T>`: `{ ok: true; data: T } | { ok: false; error: IbaliError }`
- `IbaliItem`: raw Omeka S item shape (typed loosely, all field access via helper)
- `IbaliMedia`: raw Omeka S media shape
- `MappedIbaliItem`: `{ publication_title, date_issued, volume, issue_number, language, identifier }`
- `IbaliMediaRef`: `{ originalUrl: string; extractedText: string | null }`

**Functions:**
- `getProp(obj, ns, prop)` — reads `obj[\`${ns}:${prop}\`]?.[0]?.["@value"] ?? null`
- `fetchIbaliItem(itemId)` — GET with 10s timeout, error-shaped result
- `fetchIbaliMedia(itemId)` — GET with 10s timeout, error-shaped result
- `mapIbaliItem(item)` — maps dcterms/bibo fields to `MappedIbaliItem`
- `extractMediaRefs(media[])` — maps each media to `IbaliMediaRef`

Omeka S field access pattern: `item["dcterms:title"]?.[0]?.["@value"]`

### Step 3: Server Action (`src/lib/actions/import-ibali.ts`)

`"use server"` — mirrors `records.ts` patterns exactly.

```typescript
export async function importFromIbali(
  _prevState: { error: string | null; recordId?: string },
  formData: FormData
): Promise<{ error: string | null; recordId?: string }>
```

**Flow:**

1. `requireAuth()` → get profile
2. Parse `project_id` and `ibali_item_id` from formData
3. `assertImportPermission(supabase, projectId, profile.id)` — returns error if translator/reviewer
4. Parse item ID: accept raw number or full URL, extract trailing digits with a regex match
5. **Idempotency check:** query `source_records` for `(project_id, source_type='ibali', source_identifier=itemId)`. If found → return `{ error: null, recordId: existing.id }`.
6. `fetchIbaliItem(itemId)` → if not ok, map error type → user message → return `{ error }`
7. `fetchIbaliMedia(itemId)` → if not ok, map error type → user message → return `{ error }`
8. `mapIbaliItem(item)` → mapped fields; `extractMediaRefs(media)` → refs
9. `generateCanonicalRef({ source_type: 'ibali', publication_title, date_issued, volume, issue_number })`
10. `recordId = crypto.randomUUID()`
11. INSERT `source_records` with canonical_ref collision retry (same loop as `records.ts`)
    - Include `source_identifier = itemId`, `source_url = "https://ibali.uct.ac.za/items/{itemId}"`
    - On 23505 for dedup index → return "This Ibali item has already been imported into this project."
12. INSERT each `file_assets` row: `storage_path=null, source_url=ref.originalUrl`
    - On failure → DELETE `source_records` row → return compensating error
13. INSERT each `text_layers` row: `layer_type='source_transcription', source_method='api_import', status='raw'`
    - On failure → DELETE inserted `file_assets` rows → DELETE `source_records` row → return compensating error
14. `console.log("[importFromIbali] actor=... ibali_item=... record=... project=...")`
15. `revalidatePath(/projects/${projectId}/records)`
16. Return `{ error: null, recordId }`

**`assertImportPermission`** — identical structure to `assertUploadPermission` in `records.ts`:
```typescript
async function assertImportPermission(
  supabase: SupabaseClient,
  projectId: string,
  callerId: string
): Promise<string | null>
```

### Step 4: Import Page (`src/app/(app)/projects/[id]/import/ibali/page.tsx`)

- Server component
- `requireProjectMember(id)` → redirects non-members
- Role check: `super_admin`, `project_admin`, `researcher` → render `<IbaliImportForm projectId={id} />`
- `translator` / `reviewer` → render inline access-denied state (not a redirect)

### Step 5: Import Form (`src/components/records/IbaliImportForm.tsx`)

- `"use client"` — `useActionState(importFromIbali, { error: null })`
- Input: text field labelled "Ibali Item ID or URL", placeholder shows `180673`
- Also passes `projectId` as hidden input
- Success: "Record imported." + link to `/projects/{projectId}/records/{recordId}`
- Error: inline error message below the input
- Style: ILIZWI design tokens — same form style as `AddTextLayerForm`, `AddMemberForm`

### Step 6: Navigation (`src/app/(app)/projects/[id]/page.tsx`)

Add "Import from Ibali →" link in the Records section. Use same gate as Upload: `isAdmin || callerMembership?.role === "researcher"`.

---

## Acceptance Criteria

1. Enter Ibali item ID 180673 → platform queries Ibali API and retrieves issue metadata
2. Created record shows title, date, volume/issue from Ibali item JSON
3. `file_assets` rows have `source_url` pointing to `.docx` files; `storage_path` is null
4. `text_layers` row has `layer_type='source_transcription'`, `source_method='api_import'`, `status='raw'`
5. Record has `source_type='ibali'`, `source_archive='UCT Ibali'` — provenance visible on detail page
6. Re-importing the same item ID returns the existing `recordId` — no duplicate records, file_assets, or text_layers
7. Any mid-import failure leaves no orphan rows in any table
8. Ibali API timeout returns user-visible error; server action does not hang
9. Translator/reviewer: page shows access-denied state; direct server action call returns permission error

---

## Verification Checklist

- [ ] `supabase db push` succeeds
- [ ] `/projects/{id}/import/ibali` loads as project_admin
- [ ] Submit `180673` → success + record link
- [ ] Record detail shows publication_title, date_issued, volume, issue_number, source_type=ibali
- [ ] `file_assets` has rows with source_url set, storage_path null
- [ ] `text_layers` has `source_transcription` row with content
- [ ] Re-import same ID → same recordId returned, no new rows created
- [ ] Invalid item ID → user-visible error
- [ ] Translator role → access-denied in page AND server action returns error
- [ ] Non-existent item ID → "item not found" message
