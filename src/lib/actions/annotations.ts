"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AnnotationType } from "@/types";

const VALID_ANNOTATION_TYPES: AnnotationType[] = [
  "editorial_note",
  "context_note",
  "term_note",
  "translation_note",
  "dispute_note",
];

/**
 * Check project membership (any role). Returns error string or null.
 * Super admins bypass the check.
 */
async function assertProjectMember(
  supabase: SupabaseClient,
  projectId: string,
  callerId: string,
  callerGlobalRole: string | null
): Promise<string | null> {
  if (callerGlobalRole === "super_admin") {
    return null;
  }

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
 * Check that caller is the annotation author, a project admin, or super_admin.
 */
async function assertAnnotationEditor(
  supabase: SupabaseClient,
  projectId: string,
  callerId: string,
  callerGlobalRole: string | null,
  authorId: string
): Promise<string | null> {
  if (callerId === authorId) return null;
  if (callerGlobalRole === "super_admin") return null;

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

export async function addAnnotation(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const record_id = (formData.get("record_id") as string)?.trim();
  const annotation_type = formData.get("annotation_type") as AnnotationType;
  const content = (formData.get("content") as string)?.trim();
  const text_layer_id =
    (formData.get("text_layer_id") as string)?.trim() || null;

  if (!record_id || !annotation_type || !content) {
    return { error: "record_id, annotation_type, and content are required" };
  }

  if (!VALID_ANNOTATION_TYPES.includes(annotation_type)) {
    return { error: `Invalid annotation_type: ${annotation_type}` };
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

  // Verify caller is a project member (any role) or super_admin
  const permError = await assertProjectMember(
    supabase,
    project_id,
    profile.id,
    profile.global_role
  );
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

  const { error: insertError } = await supabase.from("annotations").insert({
    project_id,
    record_id,
    text_layer_id,
    annotation_type,
    content,
    created_by: profile.id,
  });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath(`/projects/${project_id}/records/${record_id}`);
  return { error: null };
}

export async function updateAnnotation(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const annotation_id = (formData.get("annotation_id") as string)?.trim();
  const content = (formData.get("content") as string)?.trim();

  if (!annotation_id || !content) {
    return { error: "annotation_id and content are required" };
  }

  // Derive context from annotation — do NOT accept project_id/record_id from client
  const { data: annotation, error: fetchError } = await supabase
    .from("annotations")
    .select("id, project_id, record_id, created_by")
    .eq("id", annotation_id)
    .single();

  if (fetchError || !annotation) {
    return { error: "Annotation not found" };
  }

  // Validate caller: author OR project_admin OR super_admin
  const permError = await assertAnnotationEditor(
    supabase,
    annotation.project_id,
    profile.id,
    profile.global_role,
    annotation.created_by
  );
  if (permError) return { error: permError };

  const { error: updateError } = await supabase
    .from("annotations")
    .update({ content, updated_at: new Date().toISOString() })
    .eq("id", annotation_id);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath(
    `/projects/${annotation.project_id}/records/${annotation.record_id}`
  );
  return { error: null };
}
