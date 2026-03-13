-- F005 fix: remove over-broad UPDATE policy on text_layers.
-- Text layer content is immutable — new versions are created as new rows using
-- supersedes_layer_id. If status-only updates are needed in a later feature,
-- add a constrained path that also checks current project membership.
DROP POLICY IF EXISTS "text_layers_update_owner" ON text_layers;
