-- F016 fix: extend glossary_rules SELECT policy to include super_admin.
-- The app layer already treats super_admin as a full admin via requireProjectMember's
-- bypass, so RLS must match or super_admins see empty results on the glossary page.
DROP POLICY "glossary_rules_select_member" ON glossary_rules;

CREATE POLICY "glossary_rules_select_member_or_super_admin"
  ON glossary_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.global_role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = glossary_rules.project_id
        AND pm.user_id = auth.uid()
    )
  );
