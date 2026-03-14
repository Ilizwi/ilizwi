-- F015 fix: tighten translation_memory_entries INSERT policy to enforce
-- project-consistent provenance. The original policy only checked project
-- membership on project_id. This revision also verifies:
--   1. The referenced record belongs to the same project.
--   2. The referenced text layer belongs to the referenced record.
-- This prevents cross-project provenance grafting and UUID-guessing attacks.

DROP POLICY IF EXISTS "tm_entries_insert_contributor" ON translation_memory_entries;

CREATE POLICY "tm_entries_insert_contributor"
  ON translation_memory_entries FOR INSERT
  WITH CHECK (
    -- Caller must be a project member with write role
    EXISTS (
      SELECT 1 FROM project_memberships pm
      WHERE pm.project_id = translation_memory_entries.project_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('project_admin', 'researcher', 'translator')
    )
    -- Referenced record must belong to the same project
    AND EXISTS (
      SELECT 1 FROM source_records sr
      WHERE sr.id = translation_memory_entries.created_from_record_id
        AND sr.project_id = translation_memory_entries.project_id
    )
    -- Referenced text layer must belong to the referenced record
    AND EXISTS (
      SELECT 1 FROM text_layers tl
      WHERE tl.id = translation_memory_entries.created_from_text_layer_id
        AND tl.record_id = translation_memory_entries.created_from_record_id
    )
  );
