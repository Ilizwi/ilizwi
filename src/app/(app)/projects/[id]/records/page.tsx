import { requireProjectMember } from "@/lib/auth/project-guard";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import RecordSearchFilters from "@/components/records/RecordSearchFilters";

export default async function RecordsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    flagged?: string;
    q?: string;
    source?: string;
    language?: string;
    date_from?: string;
    date_to?: string;
    status?: string;
  }>;
}) {
  const { id } = await params;
  const resolvedSearch = await searchParams;
  const showFlaggedOnly = resolvedSearch?.flagged === "true";
  const q = resolvedSearch?.q?.trim() || undefined;
  const source = resolvedSearch?.source || undefined;
  const language = resolvedSearch?.language || undefined;
  const dateFrom = resolvedSearch?.date_from || undefined;
  const dateTo = resolvedSearch?.date_to || undefined;
  const status = resolvedSearch?.status || undefined;

  const { project, profile } = await requireProjectMember(id);
  const supabase = await createClient();

  // Step 1: fetch text layer record IDs if full-text search is requested
  let textLayerIds: string[] = [];
  if (q) {
    const { data: tlMatches } = await supabase
      .from("text_layers")
      .select("record_id")
      .ilike("content", `%${q}%`);
    textLayerIds = [
      ...new Set((tlMatches ?? []).map((t: { record_id: string }) => t.record_id)),
    ];
  }

  // Step 2: build base query scoped to project
  let recordsQuery = supabase
    .from("source_records")
    .select(
      "id, publication_title, source_archive, language, date_issued, date_issued_raw, record_status, canonical_ref, created_at"
    )
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  // Step 3: apply text search — metadata OR text layer IDs
  if (q) {
    const metaFilter = `publication_title.ilike.%${q}%,source_archive.ilike.%${q}%,canonical_ref.ilike.%${q}%`;
    if (textLayerIds.length > 0) {
      recordsQuery = recordsQuery.or(
        `${metaFilter},id.in.(${textLayerIds.join(",")})`
      );
    } else {
      recordsQuery = recordsQuery.or(metaFilter);
    }
  }

  // Step 4: apply structured filters
  if (source) recordsQuery = recordsQuery.eq("source_type", source);
  if (language) recordsQuery = recordsQuery.eq("language", language);
  if (status) recordsQuery = recordsQuery.eq("record_status", status);
  if (dateFrom) recordsQuery = recordsQuery.gte("date_issued", dateFrom);
  if (dateTo) recordsQuery = recordsQuery.lte("date_issued", dateTo);

  // Step 5: apply flagged filter (same query chain — intersection)
  if (showFlaggedOnly) {
    const { data: flaggedIds } = await supabase
      .from("record_flags")
      .select("record_id")
      .eq("project_id", id);

    const ids = [
      ...new Set(
        (flaggedIds ?? []).map((f: { record_id: string }) => f.record_id)
      ),
    ];

    if (ids.length === 0) {
      recordsQuery = recordsQuery.in("id", [
        "00000000-0000-0000-0000-000000000000",
      ]);
    } else {
      recordsQuery = recordsQuery.in("id", ids);
    }
  }

  const { data: records } = await recordsQuery;

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

  const statusBadge = (s: string) => {
    switch (s) {
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

  const recordCount = records?.length ?? 0;

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
        <div className="flex items-center gap-3">
          <Link
            href={
              showFlaggedOnly
                ? `/projects/${id}/records`
                : `/projects/${id}/records?flagged=true`
            }
            className={`px-4 py-2 text-sm font-sans rounded-[2px] border transition-colors ${
              showFlaggedOnly
                ? "border-amber-400 bg-amber-50 text-amber-700"
                : "border-desk-border text-desk-muted hover:border-desk-text hover:text-desk-text"
            }`}
          >
            {showFlaggedOnly ? "Flagged Only" : "Show Flagged"}
          </Link>
          {canUpload && (
            <Link
              href={`/projects/${id}/upload`}
              className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors"
            >
              Upload Record
            </Link>
          )}
        </div>
      </div>

      <RecordSearchFilters
        projectId={id}
        q={q}
        source={source}
        language={language}
        dateFrom={dateFrom}
        dateTo={dateTo}
        status={status}
        flagged={resolvedSearch?.flagged}
      />

      <p className="text-xs font-sans text-desk-muted mb-4">
        {recordCount} record{recordCount !== 1 ? "s" : ""} found
      </p>

      {recordCount === 0 ? (
        <div className="text-center py-12">
          <p className="text-desk-muted text-sm font-sans">No records found.</p>
          {canUpload && !q && !source && !language && !dateFrom && !dateTo && !status && !showFlaggedOnly && (
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
                  Canonical Ref
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
              {records!.map((r) => (
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
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${id}/records/${r.id}`}
                      className="font-mono text-xs text-desk-text hover:underline underline-offset-2"
                    >
                      {r.canonical_ref ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-desk-muted">{r.language}</td>
                  <td className="px-4 py-3 text-desk-muted">
                    {r.date_issued ?? r.date_issued_raw ?? "—"}
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
