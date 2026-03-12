import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import type { Project, Profile } from "@/types";

export async function requireProjectMember(
  projectId: string
): Promise<{ project: Project; profile: Profile }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) {
    redirect("/projects");
  }

  // Super admins bypass membership check
  if (profile.global_role === "super_admin") {
    return { project: project as Project, profile };
  }

  const { data: membership } = await supabase
    .from("project_memberships")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", profile.id)
    .single();

  if (!membership) {
    redirect("/projects");
  }

  return { project: project as Project, profile };
}

export async function requireProjectAdmin(
  projectId: string
): Promise<{ project: Project; profile: Profile }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) {
    redirect("/projects");
  }

  // Super admins bypass membership check
  if (profile.global_role === "super_admin") {
    return { project: project as Project, profile };
  }

  const { data: membership } = await supabase
    .from("project_memberships")
    .select("id, role")
    .eq("project_id", projectId)
    .eq("user_id", profile.id)
    .single();

  if (!membership || membership.role !== "project_admin") {
    redirect("/projects");
  }

  return { project: project as Project, profile };
}
