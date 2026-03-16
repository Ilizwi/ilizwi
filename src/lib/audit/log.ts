import { getServiceClient } from "@/lib/supabase/service";

export type AuditActionType =
  | "upload_record"
  | "import_ibali"
  | "import_nlsa"
  | "import_wits"
  | "add_text_layer"
  | "update_layer_status"
  | "extract_text"
  | "generate_translation"
  | "save_translation_correction"
  | "add_annotation"
  | "update_annotation"
  | "add_record_flag"
  | "update_record_flag"
  | "remove_record_flag";

export async function insertAuditLog(entry: {
  projectId: string;
  actorId: string;
  actionType: AuditActionType;
  recordId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  // never throws — audit failure must not break the primary action
  try {
    const supabase = getServiceClient();
    const { error } = await supabase.from("audit_logs").insert({
      project_id: entry.projectId,
      actor_id: entry.actorId,
      action_type: entry.actionType,
      record_id: entry.recordId ?? null,
      metadata: entry.metadata ?? null,
    });
    if (error) {
      console.error("[audit] insert failed", error);
    }
  } catch (e) {
    console.error("[audit] unexpected error", e);
  }
}
