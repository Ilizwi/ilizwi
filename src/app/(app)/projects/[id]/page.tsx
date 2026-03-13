import { requireProjectMember } from "@/lib/auth/project-guard";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import AddMemberForm from "@/components/projects/AddMemberForm";
import MemberRoleForm from "@/components/projects/MemberRoleForm";
import RemoveMemberForm from "@/components/projects/RemoveMemberForm";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { project, profile } = await requireProjectMember(id);
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("project_memberships")
    .select("id, user_id, role, profiles!project_memberships_user_id_fkey(id, email, display_name)")
    .eq("project_id", id);

  const { count: recordCount } = await supabase
    .from("source_records")
    .select("*", { count: "exact", head: true })
    .eq("project_id", id);

  const callerMembership = (memberships ?? []).find(
    (m) => m.user_id === profile.id
  );
  const isAdmin =
    profile.global_role === "super_admin" ||
    callerMembership?.role === "project_admin";

  return (
    <div className="p-8">
      {/* Project info */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-desk-text tracking-tight">
          {project.name}
        </h1>
        {project.description && (
          <p className="text-desk-muted text-sm font-sans mt-2">
            {project.description}
          </p>
        )}
        <div className="flex items-center gap-4 mt-3">
          <span className="inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest bg-vault-surface/10 text-desk-muted rounded-[2px]">
            {project.status}
          </span>
          <span className="text-desk-muted text-xs font-sans">
            Created {new Date(project.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      {/* Records */}
      <div className="mb-8">
        <h2 className="font-serif text-xl text-desk-text tracking-tight mb-4">
          Records
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-desk-muted text-sm font-sans">
            {recordCount === 0 ? "No records yet" : `${recordCount} record${recordCount === 1 ? "" : "s"}`}
          </span>
          <Link
            href={`/projects/${id}/records`}
            className="text-sm font-sans text-desk-text underline underline-offset-2"
          >
            View records &rarr;
          </Link>
          {(isAdmin || callerMembership?.role === "researcher") && (
            <Link
              href={`/projects/${id}/upload`}
              className="text-sm font-sans text-desk-text underline underline-offset-2"
            >
              Upload &rarr;
            </Link>
          )}
          {(isAdmin || callerMembership?.role === "researcher") && (
            <Link
              href={`/projects/${id}/import/ibali`}
              className="text-sm font-sans text-desk-text underline underline-offset-2"
            >
              Import from Ibali &rarr;
            </Link>
          )}
          {(isAdmin || callerMembership?.role === "researcher") && (
            <Link
              href={`/projects/${id}/import/nlsa`}
              className="text-sm font-sans text-desk-text underline underline-offset-2"
            >
              Import from NLSA &rarr;
            </Link>
          )}
        </div>
      </div>

      {/* Team roster */}
      <div>
        <h2 className="font-serif text-xl text-desk-text tracking-tight mb-4">
          Team
        </h2>

        <div className="border border-desk-border rounded-[2px] overflow-hidden">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="bg-vault-bg/5 border-b border-desk-border">
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Member
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Role
                </th>
                {isAdmin && (
                  <th className="text-right px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {(memberships ?? []).map((m) => {
                const memberProfile = Array.isArray(m.profiles)
                  ? m.profiles[0]
                  : m.profiles;
                return (
                  <tr
                    key={m.id}
                    className="border-b border-desk-border last:border-b-0"
                  >
                    <td className="px-4 py-3 text-desk-text">
                      {memberProfile?.display_name ??
                        memberProfile?.email ??
                        "Unknown"}
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin && m.user_id !== profile.id ? (
                        <MemberRoleForm
                          membershipId={m.id}
                          projectId={id}
                          currentRole={m.role}
                        />
                      ) : (
                        <span className="text-desk-muted">
                          {m.role.replace("_", " ")}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        {m.user_id !== profile.id && (
                          <RemoveMemberForm
                            membershipId={m.id}
                            projectId={id}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isAdmin && (
          <div className="mt-6">
            <h3 className="font-serif text-lg text-desk-text tracking-tight mb-3">
              Add Member
            </h3>
            <AddMemberForm projectId={id} />
          </div>
        )}
      </div>
    </div>
  );
}
