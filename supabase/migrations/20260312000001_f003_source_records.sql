-- F003: Source Records and File Assets

-- Enums for constrained values
CREATE TYPE source_type AS ENUM ('manual_readex', 'ibali', 'nlsa', 'wits');
CREATE TYPE record_status AS ENUM ('raw', 'in_review', 'approved');
CREATE TYPE asset_type AS ENUM ('source_file', 'transcription_file', 'export', 'derived_asset');

-- source_records: one row per archival item
-- NOTE: id has no DEFAULT — app code generates the UUID before upload
CREATE TABLE source_records (
  id                uuid PRIMARY KEY,
  project_id        uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_type       source_type NOT NULL DEFAULT 'manual_readex',
  source_archive    text NOT NULL,
  publication_title text NOT NULL,
  language          text NOT NULL,
  date_issued       date,
  date_issued_raw   text,
  page_label        text,
  record_status     record_status NOT NULL DEFAULT 'raw',
  created_by        uuid NOT NULL REFERENCES profiles(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- file_assets: files attached to records
CREATE TABLE file_assets (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id         uuid NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  asset_type        asset_type NOT NULL DEFAULT 'source_file',
  storage_path      text NOT NULL,
  original_filename text NOT NULL,
  mime_type         text,
  size_bytes        bigint,
  is_original       boolean NOT NULL DEFAULT true,
  uploaded_by       uuid NOT NULL REFERENCES profiles(id),
  uploaded_at       timestamptz NOT NULL DEFAULT now()
);

-- Storage bucket (private, no public access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'archive-files',
  'archive-files',
  false,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Auto-update timestamp trigger on source_records
CREATE TRIGGER set_source_records_updated_at
  BEFORE UPDATE ON source_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS: source_records
ALTER TABLE source_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "source_records_select_member"
  ON source_records FOR SELECT
  USING (is_project_member(project_id));

CREATE POLICY "source_records_insert_contributor"
  ON source_records FOR INSERT
  WITH CHECK (
    is_project_member(project_id)
    AND EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_id = source_records.project_id
        AND user_id = auth.uid()
        AND role IN ('project_admin', 'researcher')
    )
  );

-- RLS: file_assets
ALTER TABLE file_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "file_assets_select_member"
  ON file_assets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM source_records sr
      WHERE sr.id = file_assets.record_id
        AND is_project_member(sr.project_id)
    )
  );

CREATE POLICY "file_assets_insert_contributor"
  ON file_assets FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM source_records sr
      JOIN project_memberships pm ON pm.project_id = sr.project_id
      WHERE sr.id = file_assets.record_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('project_admin', 'researcher')
    )
  );

-- Storage RLS: archive-files bucket
CREATE POLICY "archive_files_select_member"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'archive-files'
    AND is_project_member((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY "archive_files_insert_contributor"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'archive-files'
    AND EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_id = (storage.foldername(name))[1]::uuid
        AND user_id = auth.uid()
        AND role IN ('project_admin', 'researcher')
    )
  );
