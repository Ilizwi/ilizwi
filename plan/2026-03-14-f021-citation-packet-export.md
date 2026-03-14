# F021 — Citation Packet Export

**Date:** 2026-03-14
**Branch:** `codex/f021-citation-packet-export`
**Status:** In progress

---

## Objective

Let researchers export a structured citation packet for any record — source metadata, provenance, selected text layers, and annotations — in both a human-readable plain-text format (for quoting, sharing, printing) and a machine-readable JSON format (for reuse and integration).

No PDF/DOCX in scope for V1.

---

## Approach

Build one canonical `CitationPacket` payload assembled server-side, then serialize it to `.txt` and `.json` on the client via blob download. Two download buttons on the record detail page.

Server/client boundary is explicit:
- **`src/lib/citation/citation-packet.ts`** — shared module (no `"use server"`). Contains `CitationPacket` type and pure serializer functions (`serializeToText`, `serializeToJSON`). Safe to import from both server and client.
- **`src/lib/actions/citation-export.ts`** — server action (`"use server"`). Queries DB, assembles `CitationPacket`, returns it. Imports serializers from `citation-packet.ts` only if needed server-side (but does not do file I/O itself).
- **`src/components/records/CitationExportButton.tsx`** — client component. Calls server action, imports serializers from `citation-packet.ts`, triggers blob downloads.

---

## Addendums (from code review)

1. **Server/client boundary**: Serializers live in `src/lib/citation/citation-packet.ts` (no `"use server"`). Not co-located in the server action file. Client component imports serializers from there.
2. **Real field names**: Use `source_identifier` (not `archive_id`) and `source_url` (not `external_url`) — matches `SourceRecord` type in `src/types/index.ts`.
3. **Authorization in the action**: `requireAuth()` → query record by `id` (no `project_id` in args) → extract `project_id` from record → verify project membership. No separate `project_id` param required from caller.
4. **Sanitize download filename**: `canonical_ref` can contain `/`, `:`, spaces — strip to safe chars (mirrors existing `sanitizeFilename` pattern in `records.ts`).
5. **Stable JSON shape**: Always include `annotations: []` and `text_layers: []` — never omit sections.
6. **Error UI**: No new toast library. Show inline error text near the buttons.
7. **Author attribution**: Reuse `profiles(display_name, email)` join already used in `annotations.ts` and the record detail page.

---

## Files

### Create

| File | Purpose |
|------|---------|
| `src/lib/citation/citation-packet.ts` | `CitationPacket` type + `serializeToText` + `serializeToJSON` (pure, no DB) |
| `src/lib/actions/citation-export.ts` | Server action: auth, DB queries, assemble `CitationPacket` |
| `src/components/records/CitationExportButton.tsx` | Client component: two download buttons, blob download |

### Modify

| File | Change |
|------|--------|
| `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` | Import and render `CitationExportButton` in header area |

---

## Steps

1. Create `src/lib/citation/citation-packet.ts`
   - `CitationPacket` type with `record`, `text_layers`, `annotations`, `generated_at`, `platform`
   - `serializeToText(packet): string` — plain-text format
   - `serializeToJSON(packet): string` — `JSON.stringify` with indentation
   - `sanitizeCitationFilename(ref: string): string` — safe filename from canonical_ref

2. Create `src/lib/actions/citation-export.ts` (`"use server"`)
   - `requireAuth()` → get `profile`
   - Query `source_records` by `id` only → get record, extract `project_id`
   - Return `{ error: "Not found" }` if missing
   - Membership check: super_admin bypasses; otherwise verify `project_memberships`
   - Query `text_layers` for the record (all, ordered by `created_at` asc)
   - Query `annotations` with `profiles(display_name, email)` join
   - Assemble and return `CitationPacket`

3. Create `src/components/records/CitationExportButton.tsx` (`"use client"`)
   - Props: `recordId: string`, `canonicalRef: string`
   - Two buttons: "Export .txt" and "Export .json"
   - On click: call server action → serialize → `URL.createObjectURL(blob)` → programmatic anchor click → revoke URL
   - Per-button loading state (boolean)
   - Inline error state shown below buttons

4. Add `CitationExportButton` to record detail page
   - Import component
   - Render below the Scholar's Reader link / in the record header area
   - Pass `recordId` and `canonicalRef={typedRecord.canonical_ref}`

---

## Plain-text format

```
CITATION PACKET
===============
Title:           ...
Canonical Ref:   ...
Source Type:     ...
Publication:     ...
Date:            ...
Language:        ...
Status:          ...
Source Identifier: ...
Source URL:      ...

TEXT LAYERS
-----------
[corrected_transcription / reviewed / zu]
...content...

NOTES & ANNOTATIONS
--------------------
[editorial_note] researcher@uni.ac.za — 2026-03-14
...content...

---
Generated: 2026-03-14T12:00:00Z
Platform: Panashe Archival Research Platform
```

## JSON format

```json
{
  "generated_at": "...",
  "platform": "Panashe Archival Research Platform",
  "record": {
    "canonical_ref": "...",
    "source_type": "...",
    "source_archive": "...",
    "publication_title": "...",
    "date_issued": "...",
    "date_issued_raw": "...",
    "language": "...",
    "record_status": "...",
    "source_identifier": "...",
    "source_url": "..."
  },
  "text_layers": [
    { "layer_type": "...", "content": "...", "language": "...", "status": "...", "source_method": "...", "created_at": "..." }
  ],
  "annotations": [
    { "annotation_type": "...", "content": "...", "author": "...", "created_at": "..." }
  ]
}
```

---

## Acceptance Criteria

1. Open a record with source metadata, transcription, and translation → present
2. Trigger citation packet generation → two download buttons visible
3. Export includes source details, publication, date, record metadata → in both files
4. Export includes relevant text layers and/or notes → in both files
5. Export downloads successfully → `.txt` and `.json` both download with correct filenames

---

## Verification

1. `npm run build` — must pass
2. `npm run typecheck` — must pass
3. `npm run lint` — must pass
4. Manual: open record with at least one text layer and one annotation
5. Click "Export .txt" → file downloads, confirm all sections present
6. Click "Export .json" → file downloads, confirm valid JSON with all fields
7. Test on record with no annotations → packet still generates, `annotations: []`
