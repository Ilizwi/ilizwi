# F007 — NLSA Source Integration

**Date:** 2026-03-13
**Branch:** `codex/f007-nlsa-source-integration`
**PR:** #7 (squash merged to main)
**Status:** PASSED

---

## Objective

Add NLSA (National Library of South Africa) ContentDM as a second structured source integration alongside Ibali. No new DB migration — F006 schema already covers NLSA.

---

## Approach

Mirror the F006 Ibali integration shape, adapted for the ContentDM REST API. Five files total: adapter, server action, import page, form component, and one edit to the project detail page.

### ContentDM API

- Single item: `GET https://cdm21048.contentdm.oclc.org/digital/api/singleitem/collection/{alias}/id/{id}`
- PDF URL: `https://cdm21048.contentdm.oclc.org/utils/getfile/collection/{alias}/id/{id}`
- No auth required for public collections
- Relevant fields: `title`, `date`, `langua`, `descri`, `find`, `fulltext` (OCR)

### Key design decisions (addendums applied)

1. **Strict nlsa_ref parser** — two accepted shapes only:
   - `{alias}/{id}` e.g. `p21048coll37/1`
   - Full ContentDM URL: `https://cdm21048.contentdm.oclc.org/digital/collection/{alias}/id/{id}`
   - Anything else → descriptive error listing accepted formats

2. **Date validation** — full `YYYY-MM-DD` required. Partial dates (YYYY, YYYY-MM) are rejected. ContentDM often returns partial or human-formatted dates; these cannot be fed into `CanonicalRefFields.date_issued` (typed `// YYYY-MM-DD`) or the `source_records.date_issued` date column.

3. **Alias normalisation** — alias lowercased to lowercase before dedup index check and `source_identifier` storage.

4. **Provenance distinction** — `layer_type="source_ocr"` (ContentDM exposes raw OCR) vs. Ibali's `"source_transcription"`.

5. **Server-side role gate** — translator/reviewer POST rejected in action (not just page-level access denied).

---

## Files Created or Modified

| File | Change |
|------|--------|
| `src/lib/sources/nlsa.ts` | New — ContentDM adapter |
| `src/lib/actions/import-nlsa.ts` | New — server action |
| `src/app/(app)/projects/[id]/import/nlsa/page.tsx` | New — import page |
| `src/components/records/NlsaImportForm.tsx` | New — client form |
| `src/app/(app)/projects/[id]/page.tsx` | Modified — added NLSA import link |

---

## Review Finding (P1 fix applied)

**Finding:** `validateNlsaDate()` initially accepted `YYYY` and `YYYY-MM` via `/^\d{4}(-\d{2}(-\d{2})?)?$/`. This violates the `CanonicalRefFields.date_issued // YYYY-MM-DD` contract and the `source_records.date_issued` PostgreSQL `date` column. Partial dates would produce malformed canonical refs (e.g. `NLSA-IMV-1900`) and rely on DB coercion.

**Fix:** Regex tightened to `/^\d{4}-\d{2}-\d{2}$/`. Partial dates now rejected with user-visible message.

---

## Acceptance Criteria

- [x] Query NLSA using `p21048coll37/1` — API fetch succeeds
- [x] Platform retrieves item metadata from ContentDM singleitem endpoint
- [x] Platform stores PDF reference as `file_assets` row (`asset_type="source_file"`, `source_url` set, `storage_path=null`)
- [x] OCR text captured as `text_layers` row (`layer_type="source_ocr"`, `source_method="api_import"`, `status="raw"`)
- [x] Imported record saved with `source_type="nlsa"`, `source_archive="NLSA"`

---

## Known Limitations / Follow-up Notes

- NLSA items with partial or human-formatted dates (common in ContentDM) will fail import with a descriptive error. This is intentional — no date invention. If NLSA items consistently have only year-level dates, a future decision is needed on whether to accept partial dates in a separate raw_date field and defer canonical ref generation.
- PDF references are stored as `source_url` only (`storage_path=null`). Actual download and storage to Supabase bucket is a future step.
- No automated tests exist for malformed ref rejection, partial-date rejection, or translator/reviewer direct-POST rejection. Manual verification required.
- Rollback is multi-step application logic, not a DB transaction. Negative paths remain manual-verification territory.

---

## Known Collections

| Alias | Publication |
|-------|-------------|
| `p21048coll37` | Imvo Zabantsundu |
| `p21048coll77` | Lentsoe la Basotho |
