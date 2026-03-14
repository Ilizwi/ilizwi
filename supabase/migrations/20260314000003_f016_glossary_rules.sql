-- F016: Glossary Rules

CREATE TABLE glossary_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  term                  text NOT NULL,
  language              text NOT NULL,
  rule_type             text NOT NULL CHECK (rule_type IN ('do_not_translate','approved_translation','always_flag','preserve_original')),
  approved_translation  text,
  note                  text,
  active                boolean NOT NULL DEFAULT true,
  created_by            uuid NOT NULL REFERENCES profiles(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- approved_translation must be provided when rule_type = 'approved_translation'
ALTER TABLE glossary_rules
  ADD CONSTRAINT glossary_rules_approved_translation_required
  CHECK (rule_type != 'approved_translation' OR approved_translation IS NOT NULL);

-- Deduplication: one active rule per term+language per project (case-insensitive)
CREATE UNIQUE INDEX glossary_rules_unique_active_term
  ON glossary_rules (project_id, lower(term), language)
  WHERE active = true;

-- Lookup index
CREATE INDEX glossary_rules_project_language_active_idx
  ON glossary_rules (project_id, language, active);

-- RLS
ALTER TABLE glossary_rules ENABLE ROW LEVEL SECURITY;

-- SELECT: any project member can read glossary rules
CREATE POLICY "glossary_rules_select_member"
  ON glossary_rules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = glossary_rules.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- INSERT: project_admin or super_admin only
CREATE POLICY "glossary_rules_insert_admin"
  ON glossary_rules FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.global_role = 'super_admin'
    )
    OR EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = glossary_rules.project_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'project_admin'
    )
  );

-- UPDATE: project_admin or super_admin only
CREATE POLICY "glossary_rules_update_admin"
  ON glossary_rules FOR UPDATE
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
        AND pm.role = 'project_admin'
    )
  );
