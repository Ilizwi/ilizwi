# F017 — Scholarly Side-by-Side Reader
**Date:** 2026-03-14
**Branch:** `codex/f017-scholarly-side-by-side-reader`

---

## Session Status

### Completed last session
F016 (Glossary/Controlled Vocabulary) — Day 3 complete. All 16 features (F001–F016) now pass.

### Progress
16 / 24 features done. Day 4 begins now.

### Temporary sequencing rule
F009, F010, F011 are all complete → fall through to F017.
F017 is the correct next feature.

---

## Context

The record detail page currently displays source files and text layers in a vertical stack. Researchers must scroll to cross-reference source PDFs with transcription/translation text. F017 provides a synchronized side-by-side reading interface so scholars can view source file and text layers simultaneously without losing record context.

---

## Approach

Add a **dedicated reader route** at `/projects/[id]/records/[recordId]/reader`. The existing record page gets an "Open Reader" button. The reader page renders:

- **Left panel** — file asset viewer (PDF iframe for trusted origins, open-in-new-tab fallback matching FileViewerSection behavior)
- **Right panel** — text layer selector + content display (tabs or select to switch between available layer types)
- **Top strip** — canonical_ref, provenance metadata, breadcrumb back to record
- **Bottom strip / sidebar** — annotations placeholder (empty state; F018 will populate)
- **Responsive** — stacks vertically below md breakpoint

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/records/ScholarlyReader.tsx` | Main reader component (layout + logic) |
| `src/app/(app)/projects/[id]/records/[recordId]/reader/page.tsx` | Reader route page |
| `plan/2026-03-14-f017-scholarly-side-by-side-reader.md` | Session plan doc |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` | Add "Open Reader" button linking to `/reader` sub-route |

---

## Steps

1. **Create plan file** in `plan/2026-03-14-f017-scholarly-side-by-side-reader.md`
2. **Create feature branch** `codex/f017-scholarly-side-by-side-reader`
3. **Build `ScholarlyReader.tsx`**
   - Props: `record`, `fileAssets`, `textLayers`
   - Top strip: canonical_ref (Playfair serif), source, date, language metadata
   - Left panel: first file asset rendered as PDF iframe (signed URL if storage_path, direct if source_url); fallback "open in new tab" link matching FileViewerSection behavior; asset switcher if multiple files
   - Right panel: layer type selector (tabs); selected layer's content in readable prose; layer metadata (type badge, status, language, date)
   - Default selected layer: `corrected_translation > machine_translation > corrected_transcription > source_transcription > source_ocr`
   - Annotations strip: "Annotations — none yet" placeholder below right panel
   - Layout: `grid grid-cols-1 md:grid-cols-2 gap-0` with fixed-height panels that scroll independently (`overflow-y-auto`)
   - Styling: use only token-based classes (`desk-*`, `vault-*`, `historic-*`) — never hex literals in component code
4. **Build reader page** at `reader/page.tsx`
   - Server component: fetch record with both `id` AND `project_id` (combined tenancy guard), then assets/layers by `record_id`
   - Reuse exact signed URL generation pattern from record detail page
   - Pass enriched data to `ScholarlyReader` client component
   - Breadcrumb: Projects → [Project] → Records → [Record] → Reader
5. **Add "Open Reader" button** on record detail page
   - Link button in the record header area: "Scholar's Reader →"
   - Only show if record has at least one file asset and one text layer
6. **Verify all 5 PRD test steps pass** (see below)
7. **Update docs**: `claude-progress.txt`, `docs/process/progress.md`, `feature_list.json` (F017 passes: true)

---

## Addendums (approved 2026-03-14)

- **Token-based styling only**: Use `desk-*` / `vault-*` / `historic-*` classes throughout. No hex literals in component code.
- **Default layer priority**: `corrected_translation > machine_translation > corrected_transcription > source_transcription > source_ocr` — makes first render predictable, aligns with existing active-layer behavior.
- **Fallback behavior**: "open in new tab" (not download), matching `FileViewerSection` verbatim. Reuse `isSafeUrl` and `isTrustedOrigin` logic — do not re-implement.
- **Tenancy guard**: Reader page must fetch record with both `id` AND `project_id` (same combined guard as record detail page), then fetch assets/layers by `record_id`.
- **Client state boundary**: `ScholarlyReader.tsx` handles only UI state (active asset, selected layer). All data fetching stays in the server page. Do not duplicate file-viewer or text-layer logic.
- **Vertical space**: Top strip and annotations placeholder must stay compact at 1280×800. Verify panels are usable with content visible in both columns without scrolling initially.
- **Multi-asset / non-PDF verification**: Manual test should include: (a) record with multiple assets — asset switcher works; (b) record with non-PDF asset — "open in new tab" fallback renders.

---

## Reuse

- `isSafeUrl`, `isTrustedOrigin`, `TRUSTED_IFRAME_ORIGINS` logic from `FileViewerSection.tsx` — copy/reuse exactly
- Signed URL generation from record detail page — same `createSignedUrl` pattern
- Data fetch pattern from `src/app/(app)/projects/[id]/records/[recordId]/page.tsx`
- ILIZWI token classes from `globals.css` and `tailwind.config.ts`

---

## Acceptance Criteria (PRD Test Steps)

1. Open a record with source file + transcription + translation → reader loads
2. Source file and text layers visible side by side → layout confirmed
3. User can switch between available text layers → layer selector works
4. Annotations visible in same context → annotations strip present (empty state ok for F017)
5. Reader usable on standard laptop viewport (1280×800) without breaking layout

---

## Verification Commands

```bash
npm run build        # Must pass
npm run typecheck    # Must pass
npm run lint         # Must pass
```

Manual: navigate to `/projects/[id]/records/[recordId]/reader` with a seeded record; confirm 5 test steps above plus multi-asset and non-PDF fallback scenarios.
