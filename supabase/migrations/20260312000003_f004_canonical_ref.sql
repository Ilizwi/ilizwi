-- F004: canonical ref + structured metadata fields
-- Adds volume, issue_number, article_label, canonical_ref to source_records
--
-- Two-phase backfill for canonical_ref:
--   1. Add as nullable (no DEFAULT) — avoids assigning the same sentinel to all rows
--   2. Backfill existing rows with 'LEGACY-{id}' — unique per row, visibly a sentinel
--   3. Set NOT NULL constraint
--   4. Add unique index
--
-- This is safe with any number of existing F003 rows.

ALTER TABLE source_records
  ADD COLUMN volume text,
  ADD COLUMN issue_number text,
  ADD COLUMN article_label text,
  ADD COLUMN canonical_ref text;

-- Backfill: each legacy row gets a distinct sentinel derived from its UUID
UPDATE source_records
  SET canonical_ref = 'LEGACY-' || id::text
  WHERE canonical_ref IS NULL;

-- Now enforce NOT NULL — all rows are populated
ALTER TABLE source_records
  ALTER COLUMN canonical_ref SET NOT NULL;

-- Unique index to enforce canonical ref invariant at DB level
-- Collisions handled by server action retry logic (appends -r2 … -r9)
CREATE UNIQUE INDEX source_records_canonical_ref_key
  ON source_records (canonical_ref);
