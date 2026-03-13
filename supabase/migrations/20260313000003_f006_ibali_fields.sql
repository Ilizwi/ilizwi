-- F006: Ibali source integration schema additions

-- source_records: external source provenance fields
ALTER TABLE source_records
  ADD COLUMN IF NOT EXISTS source_identifier text,
  ADD COLUMN IF NOT EXISTS source_url text;

-- Dedupe invariant: same external item cannot be imported twice into same project
CREATE UNIQUE INDEX IF NOT EXISTS source_records_project_source_dedup_idx
  ON source_records (project_id, source_type, source_identifier)
  WHERE source_identifier IS NOT NULL;

-- file_assets: support external URL references
ALTER TABLE file_assets
  ADD COLUMN IF NOT EXISTS source_url text;

-- Allow null storage_path for external-reference assets
ALTER TABLE file_assets
  ALTER COLUMN storage_path DROP NOT NULL;

-- Location invariant: exactly one of storage_path or source_url must be set
ALTER TABLE file_assets
  ADD CONSTRAINT file_assets_location_check
  CHECK (
    (storage_path IS NOT NULL AND source_url IS NULL)
    OR
    (storage_path IS NULL AND source_url IS NOT NULL)
  );
