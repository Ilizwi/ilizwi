import { requireProjectMember } from "@/lib/auth/project-guard";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function RecordsListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { project, profile } = await requireProjectMember(id);
  const supabase = await createClient();

  const { data: records } = await supabase
    .from("source_records")
    .select("id, publication_title, source_archive, language, date_issued, date_issued_raw, record_status, created_at")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  // Determine caller's role for upload permission
  let canUpload = profile.global_role === "super_admin";
  if (!canUpload) {
    const { data: membership } = await supabase
      .from("project_memberships")
      .select("role")
      .eq("project_id", id)
      .eq("user_id", profile.id)
      .single();

    canUpload =
      membership?.role === "project_admin" ||
      membership?.role === "researcher";
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "raw":
        return "bg-vault-bg/10 text-desk-muted";
      case "in_review":
        return "bg-amber-50 text-amber-700";
      case "approved":
        return "bg-green-50 text-green-700";
      default:
        return "bg-vault-bg/10 text-desk-muted";
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-desk-text tracking-tight">
            Records
          </h1>
          <p className="text-desk-muted text-sm font-sans mt-2">
            {project.name}
          </p>
        </div>
        {canUpload && (
          <Link
            href={`/projects/${id}/upload`}
            className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors"
          >
            Upload Record
          </Link>
        )}
      </div>

      {(!records || records.length === 0) ? (
        <div className="text-center py-12">
          <p className="text-desk-muted text-sm font-sans">No records yet.</p>
          {canUpload && (
            <Link
              href={`/projects/${id}/upload`}
              className="text-sm font-sans text-desk-text underline underline-offset-2 mt-2 inline-block"
            >
              Upload your first record
            </Link>
          )}
        </div>
      ) : (
        <div className="border border-desk-border rounded-[2px] overflow-hidden">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="bg-vault-bg/5 border-b border-desk-border">
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Title
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Archive
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Language
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Date
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Status
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Created
                </th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-desk-border last:border-b-0"
                >
                  <td className="px-4 py-3 text-desk-text">
                    {r.publication_title}
                  </td>
                  <td className="px-4 py-3 text-desk-muted">
                    {r.source_archive}
                  </td>
                  <td className="px-4 py-3 text-desk-muted">
                    {r.language}
                  </td>
                  <td className="px-4 py-3 text-desk-muted">
                    {r.date_issued ?? r.date_issued_raw ?? "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] ${statusBadge(r.record_status)}`}
                    >
                      {r.record_status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-desk-muted">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
