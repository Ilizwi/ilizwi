"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GlossaryRuleType } from "@/types";

async function assertProjectAdmin(
  supabase: SupabaseClient,
  projectId: string,
  callerId: string
): Promise<string | null> {
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("global_role")
    .eq("id", callerId)
    .single();

  if (callerProfile?.global_role === "super_admin") {
    return null;
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

export type CreateGlossaryRuleInput = {
  project_id: string;
  term: string;
  language: string;
  rule_type: GlossaryRuleType;
  approved_translation?: string | null;
  note?: string | null;
};

export type UpdateGlossaryRuleInput = {
  rule_type?: GlossaryRuleType;
  approved_translation?: string | null;
  note?: string | null;
  active?: boolean;
};

export async function createGlossaryRule(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const project_id = (formData.get("project_id") as string)?.trim();
  const term = (formData.get("term") as string)?.trim();
  const language = (formData.get("language") as string)?.trim();
  const rule_type = (formData.get("rule_type") as GlossaryRuleType);
  const approved_translation = (formData.get("approved_translation") as string)?.trim() || null;
  const note = (formData.get("note") as string)?.trim() || null;

  if (!project_id || !term || !language || !rule_type) {
    return { error: "term, language, and rule_type are required" };
  }

  if (rule_type === "approved_translation" && !approved_translation) {
    return { error: "approved_translation is required when rule type is 'approved_translation'" };
  }

  const permError = await assertProjectAdmin(supabase, project_id, profile.id);
  if (permError) return { error: permError };

  const { error: insertError } = await supabase.from("glossary_rules").insert({
    project_id,
    term,
    language,
    rule_type,
    approved_translation: rule_type === "approved_translation" ? approved_translation : null,
    note,
    created_by: profile.id,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return { error: `An active rule for "${term}" in "${language}" already exists` };
    }
    return { error: insertError.message };
  }

  revalidatePath(`/projects/${project_id}/glossary`);
  return { error: null };
}

export async function updateGlossaryRule(
  id: string,
  projectId: string,
  updates: UpdateGlossaryRuleInput
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const permError = await assertProjectAdmin(supabase, projectId, profile.id);
  if (permError) return { error: permError };

  if (
    updates.rule_type === "approved_translation" &&
    !updates.approved_translation
  ) {
    return { error: "approved_translation is required when rule type is 'approved_translation'" };
  }

  // Only clear approved_translation if rule_type is explicitly being changed
  // away from 'approved_translation'. Partial updates (e.g. { active: false })
  // must not touch the column at all — omitting it from the payload preserves
  // the existing DB value and avoids a CHECK constraint violation.
  const payload: Record<string, unknown> = {
    ...updates,
    updated_at: new Date().toISOString(),
  };
  if (updates.rule_type !== undefined && updates.rule_type !== "approved_translation") {
    payload.approved_translation = null;
  }

  const { error: updateError } = await supabase
    .from("glossary_rules")
    .update(payload)
    .eq("id", id)
    .eq("project_id", projectId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/projects/${projectId}/glossary`);
  return { error: null };
}
