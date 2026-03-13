# F009 — Source File Viewer

Date: 2026-03-13
Branch: `codex/f009-source-file-viewer`
PR: #8 (squash merged to main)
Status: PASSED

---

## Objective

Add an inline file viewer panel to the record detail page so researchers can open and inspect source files without downloading them first.

## Approach

Extended the existing server-component record detail page to generate Supabase signed URLs (1h) for `storage_path` assets at render time. Remote `source_url` assets are passed through directly. Both are collected into an `EnrichedFileAsset[]` list passed to a new client component `FileViewerSection`.

`FileViewerSection` renders the file assets table with a "View" action column. Clicking View expands an inline panel below the table with a PDF iframe for trusted-origin PDFs, or a fallback open-in-new-tab link for non-PDF and untrusted-origin assets.

No DB migration required. No new server action required.

## Files Created or Modified

| File | Action | Notes |
|------|--------|-------|
| `src/types/index.ts` | Modified | Added `EnrichedFileAsset` type |
| `src/components/records/FileViewerSection.tsx` | Created | Client component: table + viewer panel |
| `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` | Modified | Signed URL enrichment; replace static table with FileViewerSection |

## Addendums Applied

- **Non-PDF fallback**: `.docx` and other non-PDF assets show "Preview unavailable for this file type" + open-in-new-tab link; no iframe attempt
- **Error sanitization**: `createSignedUrl` failure serializes as `"Preview unavailable"` (not raw provider message); view button disabled
- **URL safety**: `isSafeUrl()` rejects any non-http/https scheme before rendering iframe or links
- **Trusted-origin allowlist**: `TRUSTED_IFRAME_ORIGINS` = Supabase storage, NLSA (`cdm21048.contentdm.oclc.org`), Ibali (`ibali.uct.ac.za`). PDFs from untrusted origins fall through to the open-link fallback.
- **Signed URL expiry**: 1-hour expiry acknowledged; broken iframe on expiry is acceptable — no auto-refresh logic implemented.

## Acceptance Criteria — All Satisfied

1. Record with file asset opens ✓ (existing guard unchanged)
2. File viewable inline without download ✓ (iframe for trusted PDF, open-link otherwise)
3. Navigate back using Close button or breadcrumb ✓
4. Provenance panel remains above viewer at all times ✓
5. Works for uploaded file (signed URL) and imported remote file (source_url) ✓

## Verification

```
npm run typecheck  ✓
npm run lint       ✓
npm run build      ✓
```

## Known Limitations / Assumptions

- Supabase signed URLs expire after 1 hour. If the viewer is left open past expiry, the iframe shows a broken/auth-error state. No auto-refresh.
- Ibali `.docx` media assets (non-PDF) correctly fall through to the open-link fallback — this is expected behaviour.
- Trusted-origin allowlist is hardcoded to the three known import sources. Any future source integration must add its origin to `TRUSTED_IFRAME_ORIGINS` in `FileViewerSection.tsx`.
- Tenancy invariant preserved: existing `requireProjectMember` guard covers the viewer; no change to authorization.
