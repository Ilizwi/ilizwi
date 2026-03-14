import { requireProjectMember } from "@/lib/auth/project-guard";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import type { AuditLog } from "@/types";

const ACTION_LABELS: Record<string, string> = {
  upload_record: "Uploaded record",
  import_ibali: "Imported from Ibali",
  import_nlsa: "Imported from NLSA",
  import_wits: "Imported from Wits",
  add_text_layer: "Added text layer",
  update_layer_status: "Updated layer status",
  extract_text: "Extracted text",
  generate_translation: "Generated translation",
  save_translation_correction: "Corrected translation",
  add_annotation: "Added annotation",
  update_annotation: "Updated annotation",
  add_record_flag: "Added flag",
  update_record_flag: "Updated flag",
  remove_record_flag: "Removed flag",
};

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ record?: string }>;
}) {
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const recordFilter = resolvedSearch?.record ?? null;

  const { project, profile } = await requireProjectMember(id);
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("project_memberships")
    .select("user_id, role")
    .eq("project_id", id);

  const callerMembership = (memberships ?? []).find(
    (m) => m.user_id === profile.id
  );
  const isAdmin =
    profile.global_role === "super_admin" ||
    callerMembership?.role === "project_admin";

  if (!isAdmin) {
    return (
      <div className="p-8">
        <p className="text-desk-muted font-sans text-sm">
          Access denied — this page is visible to project admins and super admins only.
        </p>
      </div>
    );
  }

  let query = supabase
    .from("audit_logs")
    .select("*, profiles(display_name, email), source_records(canonical_ref)")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (recordFilter) {
    query = query.eq("record_id", recordFilter);
  }

  const { data: logs } = await query;
  const typedLogs = (logs ?? []) as AuditLog[];

  let filterRecord: { id: string; canonical_ref: string } | null = null;
  if (recordFilter) {
    const { data: rec } = await supabase
      .from("source_records")
      .select("id, canonical_ref")
      .eq("id", recordFilter)
      .eq("project_id", id)
      .single();
    filterRecord = rec;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href={`/projects/${id}`}
          className="text-xs font-sans text-desk-muted underline underline-offset-2"
        >
          &larr; {project.name}
        </Link>
        <h1 className="font-serif text-3xl text-desk-text tracking-tight mt-2">
          Activity Trace
        </h1>
        {filterRecord && (
          <div className="mt-2 flex items-center gap-3">
            <span className="text-sm font-sans text-desk-muted">
              Showing activity for record:{" "}
              <span className="text-desk-text font-mono text-xs">
                {filterRecord.canonical_ref}
              </span>
            </span>
            <Link
              href={`/projects/${id}/audit`}
              className="text-xs font-sans text-desk-muted underline underline-offset-2"
            >
              Clear filter
            </Link>
          </div>
        )}
      </div>

      {typedLogs.length === 0 ? (
        <p className="text-desk-muted font-sans text-sm">No activity recorded yet.</p>
      ) : (
        <div className="border border-desk-border rounded-[2px] overflow-hidden">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="bg-vault-bg/5 border-b border-desk-border">
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Timestamp
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  User
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Action
                </th>
                <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                  Record
                </th>
              </tr>
            </thead>
            <tbody>
              {typedLogs.map((log) => {
                const actor = Array.isArray(log.profiles)
                  ? log.profiles[0]
                  : log.profiles;
                const rec = Array.isArray(log.source_records)
                  ? log.source_records[0]
                  : log.source_records;
                return (
                  <tr
                    key={log.id}
                    className="border-b border-desk-border last:border-b-0"
                  >
                    <td className="px-4 py-3 text-desk-muted font-mono text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-desk-text">
                      {actor?.display_name ?? actor?.email ?? log.actor_id}
                    </td>
                    <td className="px-4 py-3 text-desk-text">
                      {ACTION_LABELS[log.action_type] ?? log.action_type}
                    </td>
                    <td className="px-4 py-3">
                      {log.record_id && rec ? (
                        <Link
                          href={`/projects/${id}/records/${log.record_id}`}
                          className="text-desk-text underline underline-offset-2 font-mono text-xs"
                        >
                          {rec.canonical_ref}
                        </Link>
                      ) : (
                        <span className="text-desk-muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
