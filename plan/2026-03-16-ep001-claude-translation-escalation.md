# EP001 — Claude Translation Escalation Path

**Date:** 2026-03-16
**Branch:** `codex/ep001-claude-translation-escalation`
**Status:** APPROVED WITH ADDENDUMS

---

## Context

All 24 MVP features are complete and on main. EP001 is the first post-stage enhancement, intended to ship before the Dr Panashe client demo.

The platform uses Google Cloud Translation for bulk machine translation (F013). EP001 adds Claude (Anthropic) as a manually triggered, high-cost escalation path for difficult historical passages where Google produces a poor draft. The user explicitly triggers "Retry with Claude" — no silent replacement occurs.

---

## Current State

- `generate-translation.ts` blocks if any active `machine_translation` layer exists
- `GenerateTranslationSection.tsx` shows a static message when `hasActiveMtLayer=true`
- No Claude API integration exists — no SDK, no env var, no wrapper
- `translation_provider` and `source_layer_id` fields already exist on `TextLayer` type and DB columns
- `TextLayerCard.tsx` already renders provider label, date, content, and "Correct Translation" for any `machine_translation` layer

**No database migration needed.**

---

## Addendums (from plan review)

### A1 — Simplified UI (Addendum)
The original plan proposed a heavy comparison panel in `RetryWithClaudeSection`. Per review addendum:
- **Do not** create a parallel comparison surface
- A slim trigger UI is sufficient: show "Retry with Claude" button when eligible, show a settled state message when Claude MT already exists
- Both MT layers (Google + Claude) appear naturally in the existing Text Layers section via `TextLayerCard`, which already shows provider labels and "Correct Translation" per layer

### A2 — Audit minimal (Addendum)
Reuse existing `generate_translation` audit action type. Distinguish Claude via `metadata.provider = "claude_anthropic"`. No new audit taxonomy.

### A3 — Server-only explicit (Addendum)
`claude-translate.ts` must import `server-only` at the top (already a project dependency). Non-throwing pattern: always return `{ ok: true | false }` — never throw.

### A4 — Provider-specific flags replace generic MT check (Risk Flag)
The current `hasActiveMtLayer` concept is generic. After EP001, two MT layers can coexist. The plan must explicitly:
- Replace `hasActiveMtLayer` with `hasGoogleMtLayer` for the `GenerateTranslationSection` guard (Google MT is still one-shot)
- Introduce `hasClaudeMtLayer` for the `RetryWithClaudeSection` idempotency guard
- Update `GenerateTranslationSection` prop name from `hasActiveMtLayer` → `hasGoogleMtLayer`

### A5 — No duplicate correction UX (Risk Flag)
`TranslationEditorForm` already handles "start from an MT layer". The `RetryWithClaudeSection` must not introduce a parallel correction path. After Claude MT is stored, `TextLayerCard` handles it via the existing "Correct Translation" button.

---

## Implementation Plan

### Step 1 — Create feature branch
```
git checkout -b codex/ep001-claude-translation-escalation
```

### Step 2 — Install Claude SDK
```
npm install @anthropic-ai/sdk
```
Add to `.env.example`:
```
ANTHROPIC_API_KEY=
```

### Step 3 — Update `translation-constants.ts`
Add Claude to provider display labels:
```ts
export const PROVIDER_DISPLAY_LABELS: Record<string, string> = {
  google_cloud_translation: "Google Translate",
  claude_anthropic: "Claude (Anthropic)",
};
export const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
```

### Step 4 — Create `claude-translate.ts` (server-only)
File: `src/lib/translation/claude-translate.ts`
- Import `server-only`
- Accept `(text: string, sourceLang: string | null, targetLang: string)`
- Scholarly system prompt preserving historical orthography and proper nouns
- Return `{ ok: true, translation: string } | { ok: false, error: string }` — never throw
- Validate `ANTHROPIC_API_KEY` before calling

### Step 5 — Create `generate-claude-translation.ts` server action
File: `src/lib/actions/generate-claude-translation.ts`
- Mirror `generate-translation.ts` structure exactly
- Block if Claude MT layer already exists (idempotency guard)
- Does NOT block if Google MT layer exists (escalation path)
- Same source layer priority: corrected_transcription > source_transcription > source_ocr
- Infer `targetLanguage` from existing Google MT layer (no user input)
- Same permission check (project_admin or researcher)
- Reuse `generate_translation` audit action type, `metadata.provider = "claude_anthropic"`

### Step 6 — Create `RetryWithClaudeSection.tsx` (slim trigger UI)
File: `src/components/records/RetryWithClaudeSection.tsx`
- Hidden if `!canEscalate || !hasGoogleMtLayer || !hasEligibleLayer`
- If `!hasClaudeMtLayer`: show "Retry with Claude" button (trigger the action)
- If `hasClaudeMtLayer`: show settled state — "Claude draft generated. See Text Layers above."
- No comparison panel — `TextLayerCard` handles display per layer
- No duplicate correction path — "Correct Translation" on Claude's TextLayerCard handles that

### Step 7 — Update record detail page
File: `src/app/(app)/projects/[id]/records/[recordId]/page.tsx`
- Replace generic `hasActiveMtLayer` with provider-specific flags:
  ```ts
  const googleMtLayer = activeLayers.find(
    (l) => l.layer_type === "machine_translation" && l.translation_provider === "google_cloud_translation"
  );
  const claudeMtLayer = activeLayers.find(
    (l) => l.layer_type === "machine_translation" && l.translation_provider === "claude_anthropic"
  );
  const hasGoogleMtLayer = !!googleMtLayer;
  const hasClaudeMtLayer = !!claudeMtLayer;
  ```
- Update `GenerateTranslationSection` prop `hasActiveMtLayer` → `hasGoogleMtLayer`
- Import and render `RetryWithClaudeSection` below `GenerateTranslationSection`
- `RetryWithClaudeSection` is visible to `canCorrectTranslation` users (not only `canAddLayer`)

### Step 8 — Update `GenerateTranslationSection`
- Rename prop `hasActiveMtLayer` → `hasGoogleMtLayer`
- Update static message to be Google-specific: "A Google Translate draft already exists..."

---

## Files to Create / Modify

| Action | File |
|--------|------|
| Modify | `package.json` (install SDK) |
| Modify | `.env.example` |
| Modify | `src/lib/translation/translation-constants.ts` |
| Create | `src/lib/translation/claude-translate.ts` |
| Create | `src/lib/actions/generate-claude-translation.ts` |
| Create | `src/components/records/RetryWithClaudeSection.tsx` |
| Modify | `src/components/records/GenerateTranslationSection.tsx` |
| Modify | `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` |

---

## Acceptance Criteria

1. A record with a Google MT draft shows "Retry with Claude" button (for eligible users)
2. Clicking it generates a Claude draft stored as a second `machine_translation` layer with `translation_provider = "claude_anthropic"`
3. Both drafts appear in Text Layers section with clear provider labels via existing `TextLayerCard`
4. Neither draft is silently discarded — both persist on reload
5. "Retry with Claude" disappears after Claude draft exists (idempotent)
6. `GenerateTranslationSection` now guards only against Google MT (not all MT)
7. `npm run build`, `npm run typecheck`, `npm run lint` all pass

---

## Scope Boundaries (do not implement)

- No automatic quality scoring or fallback
- No new comparison panel (addendum A1)
- No new audit action type (addendum A2)
- No database migration
- No changes to F013/F014/F015 existing workflows
