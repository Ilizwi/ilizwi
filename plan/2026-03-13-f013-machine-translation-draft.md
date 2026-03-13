# F013 — Machine Translation Draft Generation

Date: 2026-03-13
Revised: 2026-03-13 (addendums applied, risk flags resolved)

## Context

Day 3 P0 feature. F012 passed last session; F013 is the next unblocked P0.
The system can transcribe and review text layers but cannot yet produce machine translation drafts.
This feature adds the ability to generate a `machine_translation` layer from an eligible transcription layer,
using Google Cloud Translation as the default provider behind a narrow, replaceable function.

**Provider decision:** Google Cloud Translation (REST v2, API key auth).
Abstracted as a single `translateWithGoogle()` function — no interface file in F013 since no second provider
is introduced here. Future Claude-escalation path replicates the same function signature.

**Eligible source layers (priority order):** `corrected_transcription` > `source_transcription` > `source_ocr`.
Action is authoritative for source selection. UI only receives `hasEligibleLayer` + `hasActiveMtLayer` flags.

**Tie-breaker within a type:** if multiple active layers share the same highest-priority type,
select the most recently created (`created_at DESC`).

**Regeneration:** blocked entirely in F013. If any active (non-superseded) `machine_translation` layer already
exists — whether auto-generated (with provenance) or manually created (null provenance) — the action and UI
both block. This includes manual MT rows with null `source_layer_id`/`translation_provider`. A dedicated
regenerate flow is a future enhancement.

**Provenance scope:** `source_layer_id` and `translation_provider` are set only on generated drafts.
Manual MT creation via `AddTextLayerForm` remains valid but does not require these fields.
A manually created MT layer will still block generation (same "any active MT layer" rule).

**Tenancy boundary:** membership-only check — no super_admin bypass.
Matches the existing `text_layers` SELECT policy (F010/F012 established this boundary).

**Source language normalization:** when `sourceLayer.language` is not in `SUPPORTED_SOURCE_LANGS`,
the request omits the `source` parameter entirely and relies on the API's auto-detect. The translation
must still succeed in this case — absence of a recognized source language is not an error.

**Display label canonicalization:** `google_cloud_translation` maps to the display label "Google Translate"
in one place only: a `PROVIDER_DISPLAY_LABELS` map exported from `google-translate.ts`. Both
`TextLayerCard` and any future UI import from there — no inline string literals scattered across components.

**FK behavior for `source_layer_id`:** `NO ACTION` (restrict), not `ON DELETE SET NULL`.
The immutability trigger guards `source_layer_id` as an immutable field. Since the trigger fires before
ON DELETE SET NULL could occur, using ON DELETE SET NULL would create a conflict: Postgres would attempt
to null out `source_layer_id` and the trigger would reject that update. Therefore the FK uses the default
`NO ACTION` behavior, which prevents deletion of a source layer that is referenced by any MT layer.
This is the correct semantic: provenance is permanent once recorded.

---

## Approach

1. DB migration: add `source_layer_id` + `translation_provider` to `text_layers`; update immutability trigger
2. TypeScript types: extend `TextLayer` with two nullable fields
3. Translation module: single `translateWithGoogle()` function with language code normalization + display label map
4. Server action: `generateMachineTranslation` — source selection, API call, insert, audit
5. UI: `GenerateTranslationSection` component wired into record detail page
6. Minor: show `translation_provider` display label in `TextLayerCard` metadata row

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/20260313000005_f013_translation_fields.sql` | Add `source_layer_id`, `translation_provider`; update immutability trigger |
| `src/lib/translation/google-translate.ts` | `translateWithGoogle()` + `SUPPORTED_SOURCE_LANGS` allowlist + `PROVIDER_DISPLAY_LABELS` |
| `src/lib/actions/generate-translation.ts` | `generateMachineTranslation` server action |
| `src/components/records/GenerateTranslationSection.tsx` | "Generate translation" UI (client component) |

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `source_layer_id: string \| null`, `translation_provider: string \| null` to `TextLayer` |
| `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` | Compute flags; render `GenerateTranslationSection` |
| `src/components/records/TextLayerCard.tsx` | Show `translation_provider` display label in metadata row when present |

---

## Steps

### Step 1 — Migration

`supabase/migrations/20260313000005_f013_translation_fields.sql`:

```sql
ALTER TABLE text_layers
  ADD COLUMN source_layer_id UUID REFERENCES text_layers(id),  -- NO ACTION (default), not ON DELETE SET NULL
  ADD COLUMN translation_provider TEXT;

-- Extend immutability trigger to guard the two new fields
-- Uses same IS DISTINCT FROM pattern as existing immutable fields
-- Replace via CREATE OR REPLACE FUNCTION enforce_text_layers_immutability()
```

No RLS changes. New columns inherit existing table policies (nullable, no constraint beyond FK).
`source_layer_id` FK: NO ACTION (default restrict) — deleting a referenced source layer is blocked,
not silently nulled. This is intentional: provenance is permanent once recorded.

### Step 2 — TypeScript Types

`src/types/index.ts` — extend `TextLayer`:

```ts
source_layer_id: string | null;
translation_provider: string | null;
```

Both nullable. Existing rows default to NULL; no migration data backfill needed.

### Step 3 — Translation Module

`src/lib/translation/google-translate.ts`:

```ts
// No directive — server-only via action import
export type TranslateResult =
  | { ok: true; translation: string; provider: string }
  | { ok: false; error: string };

export const PROVIDER_NAME = 'google_cloud_translation';

// Canonical display label map — import from here, never inline in components
export const PROVIDER_DISPLAY_LABELS: Record<string, string> = {
  google_cloud_translation: 'Google Translate',
};

// Allowlist of Google Translate API language codes relevant to this corpus
// Source: https://cloud.google.com/translate/docs/languages
const SUPPORTED_SOURCE_LANGS = new Set([
  'af', 'zu', 'xh', 'st', 'sn', 'sw',   // African languages
  'nl', 'en', 'fr', 'de', 'pt', 'la',    // European/colonial languages likely in corpus
]);

// Target language allowlist for V1
export const TARGET_LANGUAGE_ALLOWLIST = ['en', 'af', 'fr', 'de', 'pt'] as const;
export type TargetLanguage = typeof TARGET_LANGUAGE_ALLOWLIST[number];

export async function translateWithGoogle(
  text: string,
  sourceLang: string | null,  // raw value from text_layers.language
  targetLang: TargetLanguage
): Promise<TranslateResult> {
  // 1. Resolve API key (throw at call time if not configured)
  // 2. Map sourceLang → Google code only if in SUPPORTED_SOURCE_LANGS; else OMIT source param
  //    (API will auto-detect — absence of recognized source language is not an error)
  // 3. POST to translation.googleapis.com/language/translate/v2 with AbortSignal.timeout(15_000)
  // 4. Map response to TranslateResult — never throws, all errors mapped to { ok: false, error }
}
```

**Source language normalization behavior:** if `sourceLang` is null or not in `SUPPORTED_SOURCE_LANGS`,
the `source` parameter is omitted from the API request. Google Translate auto-detects the language.
This is the correct behavior — not an error path.

### Step 4 — Server Action

`src/lib/actions/generate-translation.ts` — `"use server"`:

```
Input: FormData { recordId, targetLanguage (default 'en') }

1. Parse + validate inputs:
   - recordId: required, trim
   - targetLanguage: must be in TARGET_LANGUAGE_ALLOWLIST; default 'en'

2. Resolve project_id — fetch source_record by recordId (server-derived, no client trust)
   - If not found → { error: "Record not found." }

3. Permission check — membership-only (no super_admin bypass):
   - Fetch project_membership for (user_id, project_id) where role IN ('project_admin', 'researcher')
   - If no row found → { error: "Permission denied." }
   (Note: matches text_layers SELECT/UPDATE policy boundary from F010/F012)

4. Fetch all text_layers for record, ordered by created_at DESC

5. Compute supersededIds (Set of supersedes_layer_id values)

6. Check for existing active machine_translation layer:
   - ANY active (non-superseded) machine_translation layer blocks generation
   - This includes manually created MT rows (null source_layer_id / null translation_provider)
   - → { error: "A machine translation draft already exists. To regenerate, create a new version from the existing layer manually." }

7. Select source layer (priority: corrected_transcription > source_transcription > source_ocr):
   - Within each type: most recent active layer (created_at DESC, not in supersededIds)
   - If none found → { error: "No eligible text layer available for translation." }

8. Validate API key present — if GOOGLE_TRANSLATE_API_KEY is absent → { error: "Translation service is not configured." }

9. Call translateWithGoogle(sourceLayer.content, sourceLayer.language, targetLanguage)
   - sourceLayer.language may be null or an unrecognized code — module handles both (auto-detect path)
   - If result.ok === false → { error: result.error }

10. Insert text_layers row:
    - record_id: recordId
    - layer_type: 'machine_translation'
    - content: result.translation
    - language: targetLanguage
    - source_method: 'api_import'
    - status: 'raw'
    - source_layer_id: sourceLayer.id
    - translation_provider: result.provider  // = PROVIDER_NAME
    - created_by: auth user id

11. Audit log: { actor, new_layer_id, source_layer_id, translation_provider, record_id, project_id }

12. revalidatePath /projects/[id]/records/[recordId]

13. Return { data: { layerId: newLayer.id } }
```

### Step 5 — UI Component

`src/components/records/GenerateTranslationSection.tsx` — `"use client"`:

Props:
```ts
{
  recordId: string;
  canGenerate: boolean;
  hasEligibleLayer: boolean;
  hasActiveMtLayer: boolean;
}
```

Render logic:
- `canGenerate === false` → render nothing (hidden, not blocked message — role gate is silent)
- `hasEligibleLayer === false` → info notice: "No eligible text layer found. Add a transcription layer before generating a translation."
- `hasActiveMtLayer === true` → info notice: "A machine translation draft already exists for this record."
- Otherwise:
  - Target language select (`<select>` with TARGET_LANGUAGE_ALLOWLIST options, default 'en')
  - "Generate Machine Translation" button
  - useActionState on `generateMachineTranslation`
  - `disabled={isPending}`
  - On success: show "Machine translation draft created." + layer ID
  - On error: show inline error message

### Step 6 — Record Detail Page

`src/app/(app)/projects/[id]/records/[recordId]/page.tsx`:

Add two derived flags (server-side, minimal — page is NOT authoritative for source selection):

```ts
const ELIGIBLE_LAYER_TYPES = ['corrected_transcription', 'source_transcription', 'source_ocr'];

const hasEligibleLayer = layers.some(
  l => ELIGIBLE_LAYER_TYPES.includes(l.layer_type) && !supersededIds.has(l.id)
);
const hasActiveMtLayer = layers.some(
  l => l.layer_type === 'machine_translation' && !supersededIds.has(l.id)
);
```

Render `<GenerateTranslationSection>` above the layers list, inside the existing `canAddLayer` gate.

### Step 7 — TextLayerCard

`src/components/records/TextLayerCard.tsx`:

In the existing metadata row (source method / language / date), add:
- If `layer.translation_provider` is non-null → show display label from `PROVIDER_DISPLAY_LABELS`
  (import from `src/lib/translation/google-translate.ts` — no inline string literals)

---

## Environment Variable

Add to `.env.example`:
```
GOOGLE_TRANSLATE_API_KEY=
```

---

## Acceptance Criteria (PRD F013 test steps)

1. Record with eligible transcription layer → "Generate Machine Translation" section visible
2. Click generate → API called, spinner shown, result stored
3. New `machine_translation` layer visible on record: labeled "Machine Translation", status "Raw", provider = "Google Translate"
4. Layer clearly labeled as draft (status = `raw`, type = `machine_translation`)
5. MT layer is separate from transcription and other annotation layers; original layers unchanged

**Additional invariants:**
- Attempting to generate when MT draft already exists (auto-generated or manually created) → clear error, no new layer created
- Attempting to generate with no eligible layer → clear error, no API call made
- Source layer ID stored on MT layer matches the transcription layer used
- If `GOOGLE_TRANSLATE_API_KEY` is not set → clear error, no crash
- When `sourceLayer.language` is null or not in SUPPORTED_SOURCE_LANGS → request omits `source` param, API auto-detects, translation succeeds
- `translation_provider` display label ("Google Translate") sourced from `PROVIDER_DISPLAY_LABELS` map in `google-translate.ts`, not hardcoded in components

---

## Branch

`codex/f013-machine-translation-draft`

## Verification Commands

```bash
pnpm build
pnpm typecheck
pnpm lint
```
