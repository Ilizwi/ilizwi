-- F015: Translation Memory

CREATE TABLE translation_memory_entries (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id                 uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  source_language            text NOT NULL,
  target_language            text NOT NULL,
  source_segment             text NOT NULL,
  machine_translation        text,
  corrected_translation      text NOT NULL,
  created_from_record_id     uuid NOT NULL REFERENCES source_records(id),
  created_from_text_layer_id uuid NOT NULL UNIQUE REFERENCES text_layers(id),
  created_by                 uuid NOT NULL REFERENCES profiles(id),
  created_at                 timestamptz NOT NULL DEFAULT now()
);

-- Suggestion-query index: project + target language + source segment
CREATE INDEX tm_entries_lookup_idx
  ON translation_memory_entries (project_id, target_language, source_segment);

-- Browse index: project + language pair
CREATE INDEX tm_entries_browse_idx
  ON translation_memory_entries (project_id, source_language, target_language);

-- RLS
ALTER TABLE translation_memory_entries ENABLE ROW LEVEL SECURITY;

-- SELECT: any project member can read TM entries
CREATE POLICY "tm_entries_select_member"
  ON translation_memory_entries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = translation_memory_entries.project_id
        AND pm.user_id = auth.uid()
    )
  );

-- INSERT: project_admin, researcher, or translator
CREATE POLICY "tm_entries_insert_contributor"
  ON translation_memory_entries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = translation_memory_entries.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('project_admin', 'researcher', 'translator')
    )
  );

-- No UPDATE or DELETE policies — append-only in V1
