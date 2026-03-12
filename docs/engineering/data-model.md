# Data Model Overview

Last updated: 2026-03-12
Status: Planning reference

This is the logical domain model for V1. It is not yet a final SQL schema, but future implementation should align with it unless the planning docs are intentionally updated.

## Core Entities

### User

Represents an authenticated person in the system.

Suggested fields:

- `id`
- `email`
- `display_name`
- `global_role`
- `created_at`
- `updated_at`

### Project

Represents a research workspace managed by a team.

Suggested fields:

- `id`
- `name`
- `slug`
- `description`
- `status`
- `created_by`
- `created_at`
- `updated_at`

### ProjectMembership

Represents a user’s role in a project.

Suggested fields:

- `id`
- `project_id`
- `user_id`
- `role`
- `invited_by`
- `created_at`

### SourceRecord

Represents the canonical internal record for an archive item.

Suggested fields:

- `id`
- `project_id`
- `source_type`
  - `manual_readex`
  - `ibali`
  - `nlsa`
  - `wits`
  - other future source
- `source_archive`
- `source_collection`
- `source_identifier`
- `source_url`
- `title`
- `publication_title`
- `language`
- `date_issued`
- `issue_number`
- `volume_number`
- `page_label`
- `description`
- `rights_notes`
- `provenance_notes`
- `record_status`
- `created_by`
- `created_at`
- `updated_at`

### FileAsset

Represents a stored or linked file associated with a record.

Suggested fields:

- `id`
- `record_id`
- `asset_type`
  - `source_file`
  - `transcription_file`
  - `export`
  - `derived_asset`
- `storage_provider`
- `storage_path`
- `original_filename`
- `mime_type`
- `size_bytes`
- `checksum`
- `source_url`
- `is_immutable`
- `created_at`

### TextLayer

Represents a text-bearing layer attached to a record.

Suggested fields:

- `id`
- `record_id`
- `layer_type`
  - `source_ocr`
  - `source_transcription`
  - `corrected_transcription`
  - `normalized_orthography`
  - `machine_translation`
  - `corrected_translation`
- `content`
- `language`
- `status`
  - `raw`
  - `reviewed`
  - `approved`
  - `uncertain`
  - `needs_expert_review`
- `source_method`
  - `api_import`
  - `ocr`
  - `manual_entry`
  - `file_extract`
- `created_by`
- `supersedes_text_layer_id`
- `created_at`
- `updated_at`

### Annotation

Represents a scholarly note or annotation linked to a record or text layer.

Suggested fields:

- `id`
- `record_id`
- `text_layer_id` nullable
- `annotation_type`
  - `editorial_note`
  - `context_note`
  - `term_note`
  - `translation_note`
  - `dispute_note`
- `content`
- `created_by`
- `created_at`
- `updated_at`

### Flag

Represents uncertainty or dispute status.

Suggested fields:

- `id`
- `record_id`
- `text_layer_id` nullable
- `flag_type`
  - `illegible`
  - `uncertain`
  - `disputed`
  - `needs_expert_review`
- `note`
- `created_by`
- `created_at`

### GlossaryRule

Represents a protected-term or terminology rule.

Suggested fields:

- `id`
- `project_id`
- `term`
- `language`
- `rule_type`
  - `do_not_translate`
  - `approved_translation`
  - `always_flag`
  - `preserve_original`
- `approved_translation`
- `note`
- `active`
- `created_by`
- `created_at`
- `updated_at`

### TranslationMemoryEntry

Represents a reusable translation correction.

Suggested fields:

- `id`
- `project_id`
- `source_language`
- `target_language`
- `source_segment`
- `machine_translation`
- `corrected_translation`
- `created_from_record_id`
- `created_from_text_layer_id`
- `created_by`
- `created_at`

### ActivityLog

Represents an auditable user or system action.

Suggested fields:

- `id`
- `project_id`
- `record_id` nullable
- `user_id` nullable
- `action_type`
- `action_summary`
- `metadata_json`
- `created_at`

## Relationships

- a `Project` has many `ProjectMemberships`
- a `Project` has many `SourceRecords`
- a `SourceRecord` has many `FileAssets`
- a `SourceRecord` has many `TextLayers`
- a `SourceRecord` has many `Annotations`
- a `SourceRecord` has many `Flags`
- a `Project` has many `GlossaryRules`
- a `Project` has many `TranslationMemoryEntries`
- a `Project` has many `ActivityLogs`

## Data Rules

### Rule 1

Never overwrite original source files.

### Rule 2

Never merge different text-layer types into one generic text blob.

### Rule 3

Every imported or uploaded record must preserve provenance.

### Rule 4

Machine translation and corrected translation must remain separately recoverable.

### Rule 5

Wits-derived records should be marked so downstream logic knows they came from a supplementary source.

## Initial Role Model

Suggested global roles:

- `super_admin`
- `user`

Suggested project roles:

- `project_admin`
- `researcher`
- `translator`
- `reviewer`

Role naming can be refined later, but the permission shape should be designed for this hierarchy.
