// Domain types — mirrors data-model.md
// These are working type stubs to be expanded during feature implementation

export type GlobalRole = "super_admin" | "user";

export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  global_role: GlobalRole;
  created_at: string;
  updated_at: string;
};

export type ProjectRole = "project_admin" | "researcher" | "translator" | "reviewer";

export type ProjectStatus = "active" | "archived";

export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ProjectMembership = {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  invited_by: string | null;
  created_at: string;
  profile?: Pick<Profile, "email" | "display_name">;
};

export type SourceType =
  | "manual_readex"
  | "ibali"
  | "nlsa"
  | "wits";

export type AssetType =
  | "source_file"
  | "transcription_file"
  | "export"
  | "derived_asset";

export type LayerType =
  | "source_ocr"
  | "source_transcription"
  | "corrected_transcription"
  | "normalized_orthography"
  | "machine_translation"
  | "corrected_translation";

export type LayerStatus =
  | "raw"
  | "reviewed"
  | "approved"
  | "uncertain"
  | "needs_expert_review";

export type LayerSourceMethod =
  | "api_import"
  | "ocr"
  | "manual_entry"
  | "file_extract";

export type AnnotationType =
  | "editorial_note"
  | "context_note"
  | "term_note"
  | "translation_note"
  | "dispute_note";

export type FlagType =
  | "illegible"
  | "uncertain"
  | "disputed"
  | "needs_expert_review";

export type GlossaryRuleType =
  | "do_not_translate"
  | "approved_translation"
  | "always_flag"
  | "preserve_original";

export interface GlossaryRule {
  id: string;
  project_id: string;
  term: string;
  language: string;
  rule_type: GlossaryRuleType;
  approved_translation: string | null;
  note: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type RecordStatus = "raw" | "in_review" | "approved";

export type SourceRecord = {
  id: string;
  project_id: string;
  source_type: SourceType;
  source_archive: string;
  publication_title: string;
  language: string;
  date_issued: string | null;
  date_issued_raw: string | null;
  page_label: string | null;
  volume: string | null;
  issue_number: string | null;
  article_label: string | null;
  canonical_ref: string;
  source_identifier: string | null;
  source_url: string | null;
  record_status: RecordStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type FileAsset = {
  id: string;
  record_id: string;
  asset_type: AssetType;
  storage_path: string | null;
  source_url: string | null;
  original_filename: string;
  mime_type: string | null;
  size_bytes: number | null;
  is_original: boolean;
  uploaded_by: string;
  uploaded_at: string;
};

export type EnrichedFileAsset = FileAsset & {
  view_url: string | null;
  view_url_error?: string | null;
};

export type TextLayer = {
  id: string;
  record_id: string;
  layer_type: LayerType;
  content: string;
  language: string | null;
  status: LayerStatus;
  source_method: LayerSourceMethod;
  supersedes_layer_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  source_layer_id: string | null;
  translation_provider: string | null;
};

export type TranslationMemoryEntry = {
  id: string;
  project_id: string;
  source_language: string;
  target_language: string;
  source_segment: string;
  machine_translation: string | null;
  corrected_translation: string;
  created_from_record_id: string;
  created_from_text_layer_id: string;
  created_by: string;
  created_at: string;
  // Joined from source_records for display
  canonical_ref?: string;
};

export interface Annotation {
  id: string;
  project_id: string;
  record_id: string;
  text_layer_id: string | null;
  annotation_type: AnnotationType;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  profiles?: { display_name: string | null; email: string };
}
