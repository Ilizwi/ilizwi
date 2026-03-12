"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import type { SupabaseClient } from "@supabase/supabase-js";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function assertProjectAdmin(
  supabase: SupabaseClient,
  projectId: string,
  callerId: string
): Promise<void> {
  // Check if super_admin first
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("global_role")
    .eq("id", callerId)
    .single();

  if (callerProfile?.global_role === "super_admin") {
    return;
  }

  const { data: membership } = await supabase
    .from("project_memberships")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", callerId)
    .single();

  if (!membership || membership.role !== "project_admin") {
    throw new Error("Insufficient permissions");
  }
}

export async function createProject(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const name = (formData.get("name") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;

  if (!name || name.length < 2) {
    return { error: "Project name must be at least 2 characters" };
  }

  const baseSlug = generateSlug(name);
  let slug = baseSlug;
  let project = null;

  for (let attempt = 1; attempt <= 10; attempt++) {
    const { data, error } = await supabase
      .from("projects")
      .insert({ name, slug, description, created_by: profile.id })
      .select("id, slug")
      .single();

    if (!error && data) {
      project = data;
      break;
    }

    // Check for unique constraint violation (code 23505)
    if (error.code === "23505") {
      slug = `${baseSlug}-${attempt + 1}`;
      continue;
    }

    return { error: error.message };
  }

  if (!project) {
    return { error: "Could not generate a unique slug for this project" };
  }

  console.log(
    `[createProject] actor=${profile.id} created project=${project.id} slug=${project.slug}`
  );

  redirect(`/projects/${project.id}`);
}

export async function addMember(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const projectId = formData.get("projectId") as string;
  const email = (formData.get("email") as string)?.trim();
  const role = formData.get("role") as string;

  await assertProjectAdmin(supabase, projectId, profile.id);

  // Look up user by email
  const { data: targetUser } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();

  if (!targetUser) {
    return { error: "No user found with that email" };
  }

  const { error } = await supabase
    .from("project_memberships")
    .insert({
      project_id: projectId,
      user_id: targetUser.id,
      role,
      invited_by: profile.id,
    });

  if (error) {
    if (error.code === "23505") {
      return { error: "User is already a member" };
    }
    return { error: error.message };
  }

  console.log(
    `[addMember] actor=${profile.id} added user=${targetUser.id} as ${role} to project=${projectId}`
  );

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function updateMemberRole(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const projectId = formData.get("projectId") as string;
  const membershipId = formData.get("membershipId") as string;
  const newRole = formData.get("newRole") as string;

  await assertProjectAdmin(supabase, projectId, profile.id);

  // Orphan guard: if demoting from project_admin, ensure at least one remains
  if (newRole !== "project_admin") {
    const { count } = await supabase
      .from("project_memberships")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("role", "project_admin")
      .neq("id", membershipId);

    if (!count || count < 1) {
      return { error: "Cannot demote the last project admin" };
    }
  }

  const { error } = await supabase
    .from("project_memberships")
    .update({ role: newRole })
    .eq("id", membershipId)
    .eq("project_id", projectId);

  if (error) {
    return { error: error.message };
  }

  console.log(
    `[updateMemberRole] actor=${profile.id} changed membership=${membershipId} to ${newRole} in project=${projectId}`
  );

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}

export async function removeMember(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const projectId = formData.get("projectId") as string;
  const membershipId = formData.get("membershipId") as string;

  await assertProjectAdmin(supabase, projectId, profile.id);

  // Fetch membership to check role for orphan guard
  const { data: membership } = await supabase
    .from("project_memberships")
    .select("role")
    .eq("id", membershipId)
    .eq("project_id", projectId)
    .single();

  if (!membership) {
    return { error: "Membership not found" };
  }

  // Orphan guard: cannot remove last project_admin
  if (membership.role === "project_admin") {
    const { count } = await supabase
      .from("project_memberships")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("role", "project_admin");

    if (!count || count <= 1) {
      return { error: "Cannot remove the last project admin" };
    }
  }

  const { error } = await supabase
    .from("project_memberships")
    .delete()
    .eq("id", membershipId)
    .eq("project_id", projectId);

  if (error) {
    return { error: error.message };
  }

  console.log(
    `[removeMember] actor=${profile.id} removed membership=${membershipId} from project=${projectId}`
  );

  revalidatePath(`/projects/${projectId}`);
  return { error: null };
}
