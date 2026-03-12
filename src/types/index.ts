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
