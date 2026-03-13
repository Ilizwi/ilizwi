-- F012: Text layer immutability trigger and UPDATE (status-only) RLS policy

-- 1. Immutability enforcement function
--    Blocks changes to all core fields; only `status` and `updated_at` may change.
CREATE OR REPLACE FUNCTION enforce_text_layers_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    NEW.record_id           IS DISTINCT FROM OLD.record_id           OR
    NEW.layer_type          IS DISTINCT FROM OLD.layer_type          OR
    NEW.content             IS DISTINCT FROM OLD.content             OR
    NEW.language            IS DISTINCT FROM OLD.language            OR
    NEW.source_method       IS DISTINCT FROM OLD.source_method       OR
    NEW.supersedes_layer_id IS DISTINCT FROM OLD.supersedes_layer_id OR
    NEW.created_by          IS DISTINCT FROM OLD.created_by          OR
    NEW.created_at          IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'text_layers: immutable fields cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. BEFORE UPDATE trigger
CREATE TRIGGER check_text_layers_immutability
  BEFORE UPDATE ON text_layers
  FOR EACH ROW EXECUTE FUNCTION enforce_text_layers_immutability();

-- 3. UPDATE RLS policy — allows project_admin / researcher to update status
CREATE POLICY "text_layers_update_status"
  ON text_layers FOR UPDATE
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM source_records sr
      JOIN project_memberships pm ON pm.project_id = sr.project_id
      WHERE sr.id = text_layers.record_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('project_admin', 'researcher')
    )
  )
  WITH CHECK (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM source_records sr
      JOIN project_memberships pm ON pm.project_id = sr.project_id
      WHERE sr.id = text_layers.record_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('project_admin', 'researcher')
    )
  );
