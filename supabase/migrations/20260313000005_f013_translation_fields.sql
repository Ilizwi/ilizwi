-- F013: Add translation provenance fields to text_layers

ALTER TABLE text_layers
  ADD COLUMN source_layer_id UUID REFERENCES text_layers(id),
  ADD COLUMN translation_provider TEXT;

-- Extend immutability trigger to guard the two new provenance fields.
-- Uses same IS DISTINCT FROM pattern as existing immutable fields.
-- source_layer_id uses NO ACTION (default) FK — not ON DELETE SET NULL.
-- This is intentional: provenance is permanent once recorded.
-- Deleting a referenced source layer is restricted, not silently nulled.
CREATE OR REPLACE FUNCTION enforce_text_layers_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    NEW.id                  IS DISTINCT FROM OLD.id                  OR
    NEW.record_id           IS DISTINCT FROM OLD.record_id           OR
    NEW.layer_type          IS DISTINCT FROM OLD.layer_type          OR
    NEW.content             IS DISTINCT FROM OLD.content             OR
    NEW.language            IS DISTINCT FROM OLD.language            OR
    NEW.source_method       IS DISTINCT FROM OLD.source_method       OR
    NEW.supersedes_layer_id IS DISTINCT FROM OLD.supersedes_layer_id OR
    NEW.created_by          IS DISTINCT FROM OLD.created_by          OR
    NEW.created_at          IS DISTINCT FROM OLD.created_at          OR
    NEW.source_layer_id     IS DISTINCT FROM OLD.source_layer_id     OR
    NEW.translation_provider IS DISTINCT FROM OLD.translation_provider
  ) THEN
    RAISE EXCEPTION 'text_layers: immutable fields cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
