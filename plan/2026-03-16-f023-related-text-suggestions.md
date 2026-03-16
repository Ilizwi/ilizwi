# F023 — Related Text Suggestions

**Date:** 2026-03-16
**Branch:** `codex/f023-related-text-suggestions`
**Status:** Complete

---

## Objective

Add a Related Records section to the record detail page so researchers can discover nearby archival material — records from the same issue, same publication run, or same language/time period.

## Approach

Pure SQL-based similarity using existing `source_records` metadata. No ML/vector embeddings. Three ranked signals evaluated in priority order, with results deduplicated up to 5 total.

Data flow: `getRelatedRecords()` is called from the record detail page, results passed as props to `RelatedRecordsSection` (presentational only). Section is hidden entirely when no results.

## Query Rules

1. **Same Issue** — `publication_title` + `volume` + `issue_number` match; only runs when both `volume` AND `issue_number` are present
2. **Same Publication** — `publication_title` + `language` match, different record; deduplication prevents overlap with signal 1
3. **Same Language / Period** — `language` + `date_issued` within ±1 year; only runs when both `language` AND `date_issued` exist

## Files Created or Modified

| Action | File |
|--------|------|
| Created | `src/lib/records/related.ts` |
| Created | `src/components/records/RelatedRecordsSection.tsx` |
| Modified | `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` |
| Created | `plan/2026-03-16-f023-related-text-suggestions.md` |
| Modified | `docs/process/progress.md` |
| Modified | `feature_list.json` |
| Modified | `claude-progress.txt` |

## Acceptance Criteria

- Related Records section appears on record detail page when related records exist
- Section is hidden entirely when no related records are found
- Each result shows canonical_ref (linked), publication title, date, and relationship reason badge
- Clicking a result navigates to that record
- No new database schema required
