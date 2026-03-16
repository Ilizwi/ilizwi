"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FlagType } from "@/types";
import { insertAuditLog } from "@/lib/audit/log";

const VALID_FLAG_TYPES: FlagType[] = [
  "illegible",
  "uncertain",
  "disputed",
  "needs_expert_review",
];

/**
 * Check project membership (any role). No super_admin bypass — flags are membership-only.
 */
async function assertProjectMember(
  supabase: SupabaseClient,
  projectId: string,
  callerId: string
): Promise<string | null> {
  const { data: membership } = await supabase
    .from("project_memberships")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", callerId)
    .single();

  if (!membership) {
    return "Insufficient permissions";
  }
  return null;
}

/**
 * Check that caller is the flag author or a project_admin. No super_admin bypass.
 */
async function assertFlagEditor(
  supabase: SupabaseClient,
  projectId: string,
  callerId: string,
  authorId: string
): Promise<string | null> {
  if (callerId === authorId) {
    // Author still must be a project member
    return assertProjectMember(supabase, projectId, callerId);
  }

  const { data: membership } = await supabase
    .from("project_memberships")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", callerId)
    .single();

  if (!membership || membership.role !== "project_admin") {
    return "Insufficient permissions";
  }
  return null;
}

export async function addRecordFlag(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const record_id = (formData.get("record_id") as string)?.trim();
  const flag_type = formData.get("flag_type") as FlagType;
  const note = (formData.get("note") as string)?.trim() || null;
  const text_layer_id =
    (formData.get("text_layer_id") as string)?.trim() || null;

  if (!record_id || !flag_type) {
    return { error: "record_id and flag_type are required" };
  }

  if (!VALID_FLAG_TYPES.includes(flag_type)) {
    return { error: `Invalid flag_type: ${flag_type}` };
  }

  // Derive project_id server-side — do NOT accept from client
  const { data: record, error: recordError } = await supabase
    .from("source_records")
    .select("project_id")
    .eq("id", record_id)
    .single();

  if (recordError || !record) {
    return { error: "Record not found" };
  }

  const project_id = record.project_id;

  // Verify caller is a project member (any role) — no super_admin bypass
  const permError = await assertProjectMember(supabase, project_id, profile.id);
  if (permError) return { error: permError };

  // If text_layer_id provided, validate it belongs to this record
  if (text_layer_id) {
    const { data: layer } = await supabase
      .from("text_layers")
      .select("id")
      .eq("id", text_layer_id)
      .eq("record_id", record_id)
      .single();

    if (!layer) {
      return { error: "text_layer_id does not belong to this record" };
    }
  }

  const { error: insertError } = await supabase.from("record_flags").insert({
    project_id,
    record_id,
    text_layer_id,
    flag_type,
    note,
    created_by: profile.id,
  });

  if (insertError) {
    // Unique constraint violation — flag already exists
    if (insertError.code === "23505") {
      return { error: "This flag already exists for the selected target" };
    }
    return { error: insertError.message };
  }

  await insertAuditLog({
    projectId: project_id,
    actorId: profile.id,
    actionType: "add_record_flag",
    recordId: record_id,
    metadata: { flagType: flag_type },
  });

  revalidatePath(`/projects/${project_id}/records/${record_id}`);
  return { error: null };
}

export async function updateRecordFlag(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const flag_id = (formData.get("flag_id") as string)?.trim();
  const note = (formData.get("note") as string)?.trim() || null;

  if (!flag_id) {
    return { error: "flag_id is required" };
  }

  // Derive context from flag — do NOT accept project_id/record_id from client
  const { data: flag, error: fetchError } = await supabase
    .from("record_flags")
    .select("id, project_id, record_id, created_by")
    .eq("id", flag_id)
    .single();

  if (fetchError || !flag) {
    return { error: "Flag not found" };
  }

  const permError = await assertFlagEditor(
    supabase,
    flag.project_id,
    profile.id,
    flag.created_by
  );
  if (permError) return { error: permError };

  const { error: updateError } = await supabase
    .from("record_flags")
    .update({ note, updated_at: new Date().toISOString() })
    .eq("id", flag_id);

  if (updateError) {
    return { error: updateError.message };
  }

  await insertAuditLog({
    projectId: flag.project_id,
    actorId: profile.id,
    actionType: "update_record_flag",
    recordId: flag.record_id,
    metadata: { flagId: flag_id },
  });

  revalidatePath(`/projects/${flag.project_id}/records/${flag.record_id}`);
  return { error: null };
}

export async function removeRecordFlag(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const flag_id = (formData.get("flag_id") as string)?.trim();

  if (!flag_id) {
    return { error: "flag_id is required" };
  }

  // Derive context from flag — do NOT accept project_id/record_id from client
  const { data: flag, error: fetchError } = await supabase
    .from("record_flags")
    .select("id, project_id, record_id, created_by")
    .eq("id", flag_id)
    .single();

  if (fetchError || !flag) {
    return { error: "Flag not found" };
  }

  const permError = await assertFlagEditor(
    supabase,
    flag.project_id,
    profile.id,
    flag.created_by
  );
  if (permError) return { error: permError };

  const { error: deleteError } = await supabase
    .from("record_flags")
    .delete()
    .eq("id", flag_id);

  if (deleteError) {
    return { error: deleteError.message };
  }

  await insertAuditLog({
    projectId: flag.project_id,
    actorId: profile.id,
    actionType: "remove_record_flag",
    recordId: flag.record_id,
    metadata: { flagId: flag_id },
  });

  revalidatePath(`/projects/${flag.project_id}/records/${flag.record_id}`);
  revalidatePath(`/projects/${flag.project_id}/records`);
  return { error: null };
}
