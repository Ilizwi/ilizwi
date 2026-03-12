-- Enums
CREATE TYPE project_status AS ENUM ('active', 'archived');
CREATE TYPE project_role AS ENUM ('project_admin', 'researcher', 'translator', 'reviewer');

-- projects table
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  status      project_status NOT NULL DEFAULT 'active',
  created_by  UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- project_memberships table
CREATE TABLE project_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        project_role NOT NULL DEFAULT 'researcher',
  invited_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- SECURITY DEFINER helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_memberships
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_project_admin(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_memberships
    WHERE project_id = p_project_id AND user_id = auth.uid() AND role = 'project_admin'
  );
$$;

-- Auto-timestamps
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Creator auto-becomes project_admin
CREATE OR REPLACE FUNCTION handle_new_project_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO project_memberships (project_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'project_admin', NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION handle_new_project_membership();

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select" ON projects FOR SELECT
  USING (is_super_admin() OR is_project_member(id));

CREATE POLICY "projects_insert" ON projects FOR INSERT
  WITH CHECK (auth.uid() = created_by AND auth.uid() IS NOT NULL);

CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (is_super_admin() OR is_project_admin(id))
  WITH CHECK (is_super_admin() OR is_project_admin(id));

CREATE POLICY "memberships_select" ON project_memberships FOR SELECT
  USING (is_super_admin() OR is_project_member(project_id));

CREATE POLICY "memberships_insert" ON project_memberships FOR INSERT
  WITH CHECK (is_super_admin() OR is_project_admin(project_id));

CREATE POLICY "memberships_update" ON project_memberships FOR UPDATE
  USING (is_super_admin() OR is_project_admin(project_id))
  WITH CHECK (is_super_admin() OR is_project_admin(project_id));

CREATE POLICY "memberships_delete" ON project_memberships FOR DELETE
  USING (is_super_admin() OR is_project_admin(project_id));
