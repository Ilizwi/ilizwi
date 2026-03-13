-- F005: Text Layers

-- Idempotent enum creation
DO $$ BEGIN
  CREATE TYPE layer_type AS ENUM (
    'source_ocr',
    'source_transcription',
    'corrected_transcription',
    'normalized_orthography',
    'machine_translation',
    'corrected_translation'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE layer_status AS ENUM (
    'raw',
    'reviewed',
    'approved',
    'uncertain',
    'needs_expert_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE layer_source_method AS ENUM (
    'api_import',
    'ocr',
    'manual_entry',
    'file_extract'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- text_layers: one row per text layer attached to a source record
CREATE TABLE text_layers (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id             uuid NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  layer_type            layer_type NOT NULL,
  content               text NOT NULL,
  language              text,
  status                layer_status NOT NULL DEFAULT 'raw',
  source_method         layer_source_method NOT NULL DEFAULT 'manual_entry',
  supersedes_layer_id   uuid REFERENCES text_layers(id),
  created_by            uuid NOT NULL REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Auto-update timestamp trigger
CREATE TRIGGER set_text_layers_updated_at
  BEFORE UPDATE ON text_layers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE text_layers ENABLE ROW LEVEL SECURITY;

-- SELECT: any project member can read layers via the parent record
CREATE POLICY "text_layers_select_member"
  ON text_layers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM source_records sr
      WHERE sr.id = text_layers.record_id
        AND is_project_member(sr.project_id)
    )
  );

-- INSERT: super_admin OR project_admin/researcher on the parent record's project
CREATE POLICY "text_layers_insert_contributor"
  ON text_layers FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM source_records sr
      JOIN project_memberships pm ON pm.project_id = sr.project_id
      WHERE sr.id = text_layers.record_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('project_admin', 'researcher')
    )
  );

-- No UPDATE policy for F005. Text layer content is immutable — new versions
-- are created as new rows using supersedes_layer_id. A status-only UPDATE
-- policy should be added in a later feature with DB-level column enforcement
-- and a current-project-membership check.
