-- F014: Allow translators to INSERT corrected_translation layers
-- Adds an additional INSERT policy scoped to the translator role
-- and the corrected_translation layer type only.

CREATE POLICY "text_layers_insert_translator_correction"
  ON text_layers FOR INSERT
  WITH CHECK (
    layer_type = 'corrected_translation'
    AND EXISTS (
      SELECT 1 FROM source_records sr
      JOIN project_memberships pm ON pm.project_id = sr.project_id
      WHERE sr.id = text_layers.record_id
        AND pm.user_id = auth.uid()
        AND pm.role = 'translator'
    )
  );
