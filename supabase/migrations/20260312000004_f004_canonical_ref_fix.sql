-- F004 fixup: replace shared 'LEGACY' sentinel with per-row 'LEGACY-{id}'
--
-- The original migration used DEFAULT 'LEGACY' for all rows, which collapses
-- to one value under the unique index — safe only when there is one row.
-- This migration makes each legacy sentinel unique and safe for any row count.
--
-- Idempotent: only touches rows where canonical_ref is exactly 'LEGACY'.

UPDATE source_records
  SET canonical_ref = 'LEGACY-' || id::text
  WHERE canonical_ref = 'LEGACY';
