-- F003 fixes: compensating cleanup permissions + super_admin RLS alignment

-- Helper: super_admin check (consistent with is_project_member / is_project_admin)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND global_role = 'super_admin'
  );
$$;

-- Fix: source_records INSERT — include super_admin
DROP POLICY "source_records_insert_contributor" ON source_records;
CREATE POLICY "source_records_insert_contributor"
  ON source_records FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR (
      is_project_member(project_id)
      AND EXISTS (
        SELECT 1 FROM project_memberships
        WHERE project_id = source_records.project_id
          AND user_id = auth.uid()
          AND role IN ('project_admin', 'researcher')
      )
    )
  );

-- Fix: source_records DELETE — compensating cleanup only
-- Scoped to: caller is the creator, record is still raw (never approved/reviewed)
-- Also allows super_admin cleanup
CREATE POLICY "source_records_delete_own_raw"
  ON source_records FOR DELETE
  USING (
    (created_by = auth.uid() AND record_status = 'raw')
    OR is_super_admin()
  );

-- Fix: file_assets INSERT — include super_admin
DROP POLICY "file_assets_insert_contributor" ON file_assets;
CREATE POLICY "file_assets_insert_contributor"
  ON file_assets FOR INSERT
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM source_records sr
      JOIN project_memberships pm ON pm.project_id = sr.project_id
      WHERE sr.id = file_assets.record_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('project_admin', 'researcher')
    )
  );

-- Fix: storage INSERT — include super_admin
DROP POLICY "archive_files_insert_contributor" ON storage.objects;
CREATE POLICY "archive_files_insert_contributor"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'archive-files'
    AND (
      is_super_admin()
      OR EXISTS (
        SELECT 1 FROM project_memberships
        WHERE project_id = (storage.foldername(name))[1]::uuid
          AND user_id = auth.uid()
          AND role IN ('project_admin', 'researcher')
      )
    )
  );

-- Fix: storage DELETE — compensating cleanup (upload rollback paths)
-- Scoped to callers who could have uploaded (project_admin, researcher, super_admin)
CREATE POLICY "archive_files_delete_contributor"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'archive-files'
    AND (
      is_super_admin()
      OR EXISTS (
        SELECT 1 FROM project_memberships
        WHERE project_id = (storage.foldername(name))[1]::uuid
          AND user_id = auth.uid()
          AND role IN ('project_admin', 'researcher')
      )
    )
  );
