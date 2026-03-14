-- F018: Annotations

CREATE TYPE annotation_type_enum AS ENUM (
  'editorial_note',
  'context_note',
  'term_note',
  'translation_note',
  'dispute_note'
);

CREATE TABLE annotations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  record_id        uuid NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  text_layer_id    uuid REFERENCES text_layers(id) ON DELETE SET NULL,
  annotation_type  annotation_type_enum NOT NULL,
  content          text NOT NULL CHECK (char_length(content) > 0),
  created_by       uuid NOT NULL REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX annotations_record_id_idx ON annotations (record_id);
CREATE INDEX annotations_project_id_idx ON annotations (project_id);

-- Auto-update timestamp trigger
CREATE TRIGGER set_annotations_updated_at
  BEFORE UPDATE ON annotations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;

-- SELECT: any project member or super_admin
CREATE POLICY "annotations_select_member"
  ON annotations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = annotations.project_id
        AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.global_role = 'super_admin'
    )
  );

-- INSERT: any project member (any role) or super_admin
CREATE POLICY "annotations_insert_member"
  ON annotations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.global_role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = annotations.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- UPDATE: author, project_admin, or super_admin
CREATE POLICY "annotations_update_author_or_admin"
  ON annotations FOR UPDATE
  USING (
    -- Author can edit their own
    created_by = auth.uid()
    -- OR super_admin
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.global_role = 'super_admin'
    )
    -- OR project_admin member
    OR EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = annotations.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'project_admin'
    )
  );
