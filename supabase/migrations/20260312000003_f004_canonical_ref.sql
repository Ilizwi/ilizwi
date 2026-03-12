-- F004: canonical ref + structured metadata fields
-- Adds volume, issue_number, article_label, canonical_ref to source_records
-- canonical_ref is NOT NULL with DEFAULT 'LEGACY' to backfill existing F003 rows
-- LEGACY is an intentional sentinel — distinguishable from real refs

ALTER TABLE source_records
  ADD COLUMN volume text,
  ADD COLUMN issue_number text,
  ADD COLUMN article_label text,
  ADD COLUMN canonical_ref text NOT NULL DEFAULT 'LEGACY';

-- Unique index to enforce canonical ref invariant at DB level
-- Collisions handled by server action retry logic (appends -r2, -r3 ... -r9)
CREATE UNIQUE INDEX source_records_canonical_ref_key
  ON source_records (canonical_ref);
