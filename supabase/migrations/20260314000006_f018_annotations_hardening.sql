-- F018 hardening: tighten annotations INSERT policy and fix profile attribution
--
-- Review findings addressed:
-- [P0] INSERT policy did not enforce created_by = auth.uid(), project_id / record_id
--      consistency, or text_layer_id / record_id consistency at the DB layer.
-- [P1] profiles RLS blocked project members from reading each other's display_name /
--      email, so annotation author attribution fell through to "Unknown".

-- ── 1. Tighten annotations INSERT policy ────────────────────────────────────

DROP POLICY IF EXISTS "annotations_insert_member" ON annotations;

CREATE POLICY "annotations_insert_member"
  ON annotations FOR INSERT
  WITH CHECK (
    -- Author must be the authenticated user (prevents forged created_by)
    created_by = auth.uid()
    -- project_id must match the record's actual project (prevents cross-project forge)
    AND EXISTS (
      SELECT 1 FROM source_records sr
      WHERE sr.id = annotations.record_id
        AND sr.project_id = annotations.project_id
    )
    -- If text_layer_id is provided it must belong to the same record_id
    AND (
      annotations.text_layer_id IS NULL
      OR EXISTS (
        SELECT 1 FROM text_layers tl
        WHERE tl.id = annotations.text_layer_id
          AND tl.record_id = annotations.record_id
      )
    )
    -- Caller must be a project member (any role) or super_admin
    AND (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.global_role = 'super_admin'
      )
      OR EXISTS (
        SELECT 1 FROM project_memberships pm
        WHERE pm.project_id = annotations.project_id
          AND pm.user_id = auth.uid()
      )
    )
  );

-- ── 2. Allow project members to read profiles of fellow project members ─────
--
-- Scope: only profiles of users who share at least one project with the viewer.
-- This is the minimum visibility needed for annotation author attribution.
-- It does not expose profiles of users outside shared projects.

CREATE POLICY "profiles_select_project_peers"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM project_memberships pm1
      JOIN project_memberships pm2 ON pm1.project_id = pm2.project_id
      WHERE pm1.user_id = auth.uid()
        AND pm2.user_id = profiles.id
    )
  );
