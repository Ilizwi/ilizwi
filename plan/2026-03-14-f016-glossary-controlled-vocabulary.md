# F016 — Protected-Term and Glossary Rules
**Date:** 2026-03-14
**Branch:** `codex/f016-glossary-controlled-vocabulary`
**PR:** #16 (squash merged to main)
**Status:** PASSED

---

## Objective

Allow the team to define protected-term rules for historically significant vocabulary so those terms are preserved, flagged, or translated consistently across the translation workflow.

---

## Approach

Migration → types → server actions → UI page → workflow integration.

Glossary rules live at the project level. The management UI is at `/projects/[id]/glossary/`. Rules are surfaced during translation review on the record detail page (non-blocking, informational panel).

---

## Files Created or Modified

**New:**
- `supabase/migrations/20260314000003_f016_glossary_rules.sql`
- `supabase/migrations/20260314000004_f016_glossary_select_super_admin.sql` — review fix: super_admin added to SELECT policy
- `src/lib/actions/glossary-rules.ts`
- `src/app/(app)/projects/[id]/glossary/page.tsx`
- `plan/2026-03-14-f016-glossary-controlled-vocabulary.md`

**Modified:**
- `src/types/index.ts` — added `GlossaryRule` interface
- `src/app/(app)/projects/[id]/page.tsx` — Glossary nav link
- `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` — Glossary Matches panel

---

## Key Decisions and Addendums Applied

**Access model:** All project members can view the glossary page (read-only). Only `project_admin` and `super_admin` can create, edit, or deactivate rules. This is enforced at the server action layer (assertProjectAdmin), the RLS layer (INSERT/UPDATE policies), and conditionally in the page UI.

**Server-side reads:** Glossary rules are fetched directly in server pages via `createClient()`. No list server action. Only `createGlossaryRule` and `updateGlossaryRule` are server actions.

**Source layer priority for matching:** `corrected_transcription > source_transcription > source_ocr` — same priority as MT generation. Glossary panel only appears when a translation layer also exists.

**`approved_translation` validation:** Required when `rule_type = 'approved_translation'`. Enforced at server action layer (before DB call) and at DB layer via CHECK constraint. `updateGlossaryRule` only clears `approved_translation` when `rule_type` is explicitly being changed away from `approved_translation` — partial updates like `{ active: false }` preserve the existing DB value.

**Case-insensitive uniqueness:** Partial unique index uses `lower(term)` to normalise, so `ubuntu` and `Ubuntu` cannot coexist as active rules for the same project+language.

**Whole-word matching:** Tokenise source layer content by splitting on whitespace, strip leading/trailing punctuation via Unicode-aware regex (`/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu`), then exact token comparison (case-insensitive). Eliminates false positives like "ink" matching "thinking". Multi-word terms are not supported in V1.

**Edit UI:** Uses `?edit=<ruleId>` search param to render an inline edit form with pre-filled values. Edit, create, and deactivate errors are surfaced via redirect with error query params and rendered as banners.

**Deactivate-instead-of-delete:** Setting `active = false` preserves rule history. Inactive rules are still visible in the management table with an "Inactive" status label.

---

## Acceptance Criteria

1. ✅ Can create a protected-term rule with a behavior (do_not_translate, always_flag, approved_translation, preserve_original)
2. ✅ Rule appears in the glossary management page with correct type badge
3. ✅ Opening a record containing that term surfaces the rule in the translation review section
4. ✅ Rule type and approved translation are visible inline during the correction workflow
5. ✅ Rule can be edited (type, note, approved_translation) without touching any text layer on records
6. ✅ Deactivating a rule removes it from future checks without deleting the rule row

---

## Known Limitations / V2 Scope

- Multi-word glossary terms are not supported. The tokeniser splits on whitespace; a term containing spaces (e.g. "amaNgwane territory") will never match.
- Matching is informational only — no automatic enforcement. The translation editor does not block or pre-fill based on glossary rules.
- No pagination on the glossary management table. Suitable for projects with up to ~100 rules.
- Edit UI uses search-param navigation (full page reload) rather than inline state — acceptable for V1 but could be improved with a client component.

---

## Next Feature

**F017: Scholarly Side-by-Side Reader** (P0, Day 4)
