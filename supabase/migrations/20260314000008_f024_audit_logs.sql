CREATE TABLE audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  record_id    UUID REFERENCES source_records(id) ON DELETE SET NULL,
  actor_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  action_type  TEXT NOT NULL,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_logs_project_idx ON audit_logs (project_id, created_at DESC);
CREATE INDEX audit_logs_record_idx  ON audit_logs (record_id, created_at DESC)
  WHERE record_id IS NOT NULL;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: project_admin or super_admin only
CREATE POLICY audit_logs_select ON audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = audit_logs.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'project_admin'
    )
    OR is_super_admin()
  );

-- INSERT: actor must be a project member, record_id (if set) must belong to the same project
CREATE POLICY audit_logs_insert ON audit_logs
  FOR INSERT WITH CHECK (
    actor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = audit_logs.project_id
        AND pm.user_id = auth.uid()
    )
    AND (
      audit_logs.record_id IS NULL
      OR EXISTS (
        SELECT 1 FROM source_records sr
        WHERE sr.id = audit_logs.record_id
          AND sr.project_id = audit_logs.project_id
      )
    )
  );
