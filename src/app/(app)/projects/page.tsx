import { requireAuth } from "@/lib/auth/role-guard";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function ProjectsPage() {
  const profile = await requireAuth();
  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, slug, status, created_at")
    .order("created_at", { ascending: false });

  // Fetch member counts per project
  const projectIds = (projects ?? []).map((p) => p.id);
  const { data: memberships } = projectIds.length
    ? await supabase
        .from("project_memberships")
        .select("project_id")
        .in("project_id", projectIds)
    : { data: [] };

  const memberCounts: Record<string, number> = {};
  for (const m of memberships ?? []) {
    memberCounts[m.project_id] = (memberCounts[m.project_id] ?? 0) + 1;
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-3xl text-desk-text tracking-tight">
          Projects
        </h1>
        <Link
          href="/projects/new"
          className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors"
        >
          New Project
        </Link>
      </div>

      {(!projects || projects.length === 0) && (
        <p className="text-desk-muted text-sm font-sans">
          No projects yet. Create one to get started.
        </p>
      )}

      <div className="space-y-3">
        {(projects ?? []).map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="block border border-desk-border rounded-[2px] p-4 hover:bg-desk-bg/80 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-lg text-desk-text">
                  {project.name}
                </h2>
                <p className="text-desk-muted text-xs font-sans mt-1">
                  {project.slug}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-desk-muted text-xs font-sans">
                  {memberCounts[project.id] ?? 0} member
                  {(memberCounts[project.id] ?? 0) !== 1 ? "s" : ""}
                </span>
                <span className="inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest bg-vault-surface/10 text-desk-muted rounded-[2px]">
                  {project.status}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
