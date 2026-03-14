-- F019: Record Flags

CREATE TYPE flag_type_enum AS ENUM ('illegible', 'uncertain', 'disputed', 'needs_expert_review');

CREATE TABLE record_flags (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  record_id      uuid NOT NULL REFERENCES source_records(id) ON DELETE CASCADE,
  text_layer_id  uuid REFERENCES text_layers(id) ON DELETE SET NULL,
  flag_type      flag_type_enum NOT NULL,
  note           text CHECK (note IS NULL OR char_length(note) > 0),
  created_by     uuid NOT NULL REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one flag per (record, text_layer, flag_type) combination
-- Partial indexes handle the NULL text_layer_id case correctly

CREATE UNIQUE INDEX record_flags_no_duplicate
  ON record_flags (record_id, text_layer_id, flag_type)
  WHERE text_layer_id IS NOT NULL;

CREATE UNIQUE INDEX record_flags_no_duplicate_record_level
  ON record_flags (record_id, flag_type)
  WHERE text_layer_id IS NULL;

CREATE INDEX record_flags_by_record ON record_flags (record_id);
CREATE INDEX record_flags_by_project ON record_flags (project_id);

-- Auto-update timestamp trigger
CREATE TRIGGER set_record_flags_updated_at
  BEFORE UPDATE ON record_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE record_flags ENABLE ROW LEVEL SECURITY;

-- SELECT: any project member OR super_admin
CREATE POLICY "record_flags_select_member"
  ON record_flags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = record_flags.project_id
        AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.global_role = 'super_admin'
    )
  );

-- INSERT: membership-only (no super_admin bypass, matching annotation hardening pattern)
-- Enforces created_by = auth.uid(), project/record consistency, and text_layer/record consistency
CREATE POLICY "record_flags_insert_member"
  ON record_flags FOR INSERT
  WITH CHECK (
    -- Author must be the authenticated user (prevents forged created_by)
    created_by = auth.uid()
    -- project_id must match the record's actual project (prevents cross-project forge)
    AND EXISTS (
      SELECT 1 FROM source_records sr
      WHERE sr.id = record_flags.record_id
        AND sr.project_id = record_flags.project_id
    )
    -- If text_layer_id is provided it must belong to the same record_id
    AND (
      record_flags.text_layer_id IS NULL
      OR EXISTS (
        SELECT 1 FROM text_layers tl
        WHERE tl.id = record_flags.text_layer_id
          AND tl.record_id = record_flags.record_id
      )
    )
    -- Caller must be a project member (any role) — no super_admin bypass
    AND EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = record_flags.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- UPDATE: author OR project_admin — membership-only (for note edits)
CREATE POLICY "record_flags_update_author_or_admin"
  ON record_flags FOR UPDATE
  USING (
    -- Author can edit their own note
    (created_by = auth.uid()
     AND EXISTS (
       SELECT 1 FROM project_memberships pm
       WHERE pm.project_id = record_flags.project_id
         AND pm.user_id = auth.uid()
     ))
    -- OR project_admin member
    OR EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = record_flags.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'project_admin'
    )
  );

-- DELETE: author OR project_admin — membership-only
CREATE POLICY "record_flags_delete_author_or_admin"
  ON record_flags FOR DELETE
  USING (
    -- Author can delete their own flag
    (created_by = auth.uid()
     AND EXISTS (
       SELECT 1 FROM project_memberships pm
       WHERE pm.project_id = record_flags.project_id
         AND pm.user_id = auth.uid()
     ))
    -- OR project_admin member
    OR EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = record_flags.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'project_admin'
    )
  );
