# F011 — Text Layer Management

**Date:** 2026-03-13
**Branch:** `codex/f011-text-layer-management`

---

## Context

F010 established OCR extraction and initial layer creation infrastructure. F011 makes the text layer system usable for scholars: viewing full content, managing multiple layers per record, and demonstrating immutable versioning. Without this, F012 (Transcription Editor), F013 (Machine Translation), F014 (Translation Correction), and F017 (Side-by-Side Reader) all have no functional foundation.

---

## What Already Exists (Reuse)

- `text_layers` table — full schema including `supersedes_layer_id` (migration exists)
- `TextLayer` type — `src/types/index.ts`
- `addTextLayer()` server action — `src/lib/actions/text-layers.ts`, already accepts `supersedes_layer_id`
- `AddTextLayerForm.tsx` — creates independent new layers
- `ExtractTextSection.tsx` — PDF extraction
- Record detail page — basic table with Layer Type, Status, Language, Source, Preview (200 chars)

---

## What's Missing for F011 to Pass

1. **Full content viewing** — table truncates to 200 chars; scholars need full text
2. **Supersession visibility** — no UI shows that one layer supersedes another
3. **New-version flow** — no dedicated path to create a versioned replacement of a specific layer
4. **Richer provenance display** — labels, status, and source_method need to be co-located per card

---

## Approach

Replace the flat table of text layers on the record detail page with card-based components that show all metadata in one place and support content expansion and versioning.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/records/TextLayerCard.tsx` | Single layer display: type badge, status badge, source method (provenance), language, created_by date, expandable full content, "Create New Version" button |
| `src/components/records/CreateLayerVersionForm.tsx` | Versioning form: pre-fills layer_type from parent, carries supersedes_layer_id, collects new content and optional language override |

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` | Replace layer table with `TextLayerCard` list; compute superseded IDs set for visual grouping; group active vs superseded |
| `src/lib/actions/text-layers.ts` | Add validation: if `supersedes_layer_id` is provided, confirm it belongs to the same `record_id` before inserting |

---

## Implementation Steps

### Step 1: Update `addTextLayer()` action

- Extract `supersedes_layer_id` from formData
- If provided:
  - Query `text_layers` by `id = supersedes_layer_id`
  - Return error if not found OR if `record_id` does not match the `recordId` from the form — prevents cross-record supersession
- Pass `supersedes_layer_id` (or `null`) into the insert payload
- **Negative test coverage**: submitting a bad or cross-record `supersedes_layer_id` must return a descriptive error, not a silent DB failure

### Step 2: Create `TextLayerCard.tsx`

**Props:** `layer: TextLayer`, `isSuperseded: boolean`, `canAddLayer: boolean`, `recordId: string`, `projectId: string`

**Display rules:**
- **Type badge** — use a dedicated `LAYER_TYPE_LABELS` map (not the record status helper). Map:
  - `source_ocr` → `Source OCR`
  - `source_transcription` → `Source Transcription`
  - `corrected_transcription` → `Corrected Transcription`
  - `normalized_orthography` → `Normalized Orthography`
  - `machine_translation` → `Machine Translation`
  - `corrected_translation` → `Corrected Translation`
- **Status badge** — use a dedicated `LAYER_STATUS_STYLES` map (different from record statuses). Text-layer statuses: `raw`, `reviewed`, `approved`, `uncertain`, `needs_expert_review`
- **Provenance:** source_method label (human-readable), language, created_at date
- **Superseded indicator:** If `isSuperseded=true`, show a muted "Superseded" badge on the card header; collapse content by default and dim the card visually
- **Supersedes reference:** If `layer.supersedes_layer_id` is set, show "Supersedes version from [date of parent — not available without join; omit date, just show 'a previous version']"
- **Collapse/expand toggle:** Show first 300 chars collapsed; full content on expand
- **"Create New Version" button:** Only shown if `canAddLayer && !isSuperseded` — opens inline `CreateLayerVersionForm`
- **One form open at a time:** `CreateLayerVersionForm` is controlled by local `useState`; each card tracks its own `showVersionForm` state. The page does not enforce a global one-open rule — acceptable because each card is independent.

### Step 3: Create `CreateLayerVersionForm.tsx`

**Props:** `recordId: string`, `supersedesLayerId: string`, `defaultLayerType: LayerType`, `defaultLanguage: string | null`, `onClose: () => void`

- layer_type shown as read-only text (not editable — versioning must match parent type)
- Content textarea required
- Language optional (pre-filled from `defaultLanguage`, editable)
- Source method defaults to `manual_entry` (not shown; user is always creating a corrected version manually)
- Hidden inputs: `recordId`, `supersedesLayerId`, `layerType`, `sourceMethod`
- Calls existing `addTextLayer()` action
- On success (`state.error === null`): call `onClose()` (server revalidation causes re-render automatically)
- On error: show error inline

### Step 4: Update record detail page

**Derive version state:**
- After fetching `typedLayers`, build a `Set<string>` of superseded IDs:
  ```ts
  const supersededIds = new Set(
    typedLayers
      .map(l => l.supersedes_layer_id)
      .filter(Boolean) as string[]
  );
  ```
- A layer is active if its `id` is NOT in `supersededIds`
- A layer is superseded if its `id` IS in `supersededIds`

**Rendering:**
- Order layers by `created_at` descending
- Render active layers first (those not in `supersededIds`), then superseded layers in a collapsible "Superseded versions" section (or just visually dimmed below)
- Replace `<table>` with `<TextLayerCard>` per layer, passing `isSuperseded` and `canAddLayer`
- Keep `ExtractTextSection` and `AddTextLayerForm` in a separate "Add Layer" section below

**Remove:** The `statusBadge` helper that maps `raw/in_review/approved` — this is only used for record status in the Provenance section. Keep it there (scoped), do not use it for text layer cards.

---

## Acceptance Criteria

1. Open a record with a `source_ocr` layer — card shows type, status, source_method, full content expandable ✓
2. Use `AddTextLayerForm` to add a `corrected_transcription` layer — both cards visible with distinct provenance ✓
3. Both cards show distinct type labels, provenance, and status — no overlap, no shared badge helper ✓
4. Create a new version of the `corrected_transcription` layer — new card appears, old card shows "Superseded" badge, old content still visible ✓
5. No UPDATE path — action only INSERTs; immutability preserved ✓
6. Submit bad `supersedes_layer_id` — action returns descriptive error (not silent) ✓

---

## Verification Commands

```bash
pnpm build
pnpm typecheck
pnpm lint
```

Manual: Load a record, add a `corrected_transcription`, create a new version, confirm all cards are visible with correct labels. Then attempt to POST a bad `supersedes_layer_id` and confirm the action returns an error.
