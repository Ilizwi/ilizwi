import { requireProjectMember } from "@/lib/auth/project-guard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AddTextLayerForm from "@/components/records/AddTextLayerForm";
import type { SourceRecord, FileAsset, TextLayer, EnrichedFileAsset } from "@/types";
import FileViewerSection from "@/components/records/FileViewerSection";

export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;
  const { project, profile } = await requireProjectMember(id);
  const supabase = await createClient();

  // Combined tenancy guard — validates record belongs to project
  const { data: record } = await supabase
    .from("source_records")
    .select("*")
    .eq("id", recordId)
    .eq("project_id", id)
    .single();

  if (!record) redirect(`/projects/${id}/records`);

  const typedRecord = record as SourceRecord;

  // File assets
  const { data: fileAssets } = await supabase
    .from("file_assets")
    .select("*")
    .eq("record_id", recordId)
    .order("uploaded_at", { ascending: true });

  const typedAssets = (fileAssets ?? []) as FileAsset[];

  // Enrich assets with view URLs
  // - storage_path assets: generate 1-hour signed URL from Supabase storage
  // - source_url assets: use the URL directly (validated as http/https by the viewer component)
  // Note: signed URLs expire after 1 hour. If the page stays open past expiry,
  // the iframe will show a broken/auth-error state — acceptable tradeoff for simplicity.
  const enrichedAssets: EnrichedFileAsset[] = await Promise.all(
    typedAssets.map(async (asset) => {
      if (asset.storage_path) {
        const { data, error } = await supabase.storage
          .from("archive-files")
          .createSignedUrl(asset.storage_path, 3600);
        return {
          ...asset,
          view_url: data?.signedUrl ?? null,
          view_url_error: error ? "Preview unavailable" : null,
        };
      }
      if (asset.source_url) {
        return { ...asset, view_url: asset.source_url, view_url_error: null };
      }
      return { ...asset, view_url: null, view_url_error: null };
    })
  );

  // Text layers
  const { data: textLayers } = await supabase
    .from("text_layers")
    .select("*")
    .eq("record_id", recordId)
    .order("created_at", { ascending: true });

  const typedLayers = (textLayers ?? []) as TextLayer[];

  // Permission: can add text layer?
  let canAddLayer = profile.global_role === "super_admin";
  if (!canAddLayer) {
    const { data: membership } = await supabase
      .from("project_memberships")
      .select("role")
      .eq("project_id", id)
      .eq("user_id", profile.id)
      .single();
    canAddLayer =
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

  const provenanceFields: { label: string; value: string | null }[] = [
    { label: "Source Archive", value: typedRecord.source_archive },
    { label: "Source Type", value: typedRecord.source_type },
    { label: "Publication Title", value: typedRecord.publication_title },
    { label: "Language", value: typedRecord.language },
    { label: "Date Issued", value: typedRecord.date_issued ?? typedRecord.date_issued_raw },
    { label: "Volume", value: typedRecord.volume },
    { label: "Issue Number", value: typedRecord.issue_number },
    { label: "Article Label", value: typedRecord.article_label },
    { label: "Canonical Ref", value: typedRecord.canonical_ref },
    { label: "Status", value: typedRecord.record_status },
    { label: "Created", value: new Date(typedRecord.created_at).toLocaleDateString() },
  ];

  return (
    <div className="p-8">
      {/* Breadcrumb */}
      <nav className="text-xs font-sans text-desk-muted mb-6">
        <Link href={`/projects/${id}`} className="hover:underline underline-offset-2">
          {project.name}
        </Link>
        <span className="mx-1">/</span>
        <Link href={`/projects/${id}/records`} className="hover:underline underline-offset-2">
          Records
        </Link>
        <span className="mx-1">/</span>
        <span className="text-desk-text">{typedRecord.canonical_ref}</span>
      </nav>

      <h1 className="font-serif text-3xl text-desk-text tracking-tight mb-8">
        {typedRecord.canonical_ref}
      </h1>

      {/* Provenance */}
      <section className="mb-8">
        <h2 className="font-serif text-xl text-desk-text mb-4">Provenance</h2>
        <div className="border border-desk-border rounded-[2px] overflow-hidden">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-desk-border">
            {provenanceFields.map((f) => (
              <div key={f.label} className="bg-white px-4 py-3">
                <dt className="text-[10px] font-sans uppercase tracking-widest text-desk-muted mb-1">
                  {f.label}
                </dt>
                <dd className="text-sm font-sans text-desk-text">
                  {f.label === "Status" ? (
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] ${statusBadge(f.value ?? "")}`}
                    >
                      {(f.value ?? "").replace("_", " ")}
                    </span>
                  ) : (
                    f.value ?? "—"
                  )}
                </dd>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* File Assets */}
      <section className="mb-8">
        <h2 className="font-serif text-xl text-desk-text mb-4">File Assets</h2>
        <FileViewerSection assets={enrichedAssets} />
      </section>

      {/* Text Layers */}
      <section className="mb-8">
        <h2 className="font-serif text-xl text-desk-text mb-4">Text Layers</h2>
        {typedLayers.length === 0 ? (
          <p className="text-desk-muted text-sm font-sans">No text layers yet.</p>
        ) : (
          <div className="border border-desk-border rounded-[2px] overflow-hidden">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="bg-vault-bg/5 border-b border-desk-border">
                  <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                    Layer Type
                  </th>
                  <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                    Status
                  </th>
                  <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                    Language
                  </th>
                  <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                    Source
                  </th>
                  <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                    Preview
                  </th>
                  <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {typedLayers.map((l) => (
                  <tr key={l.id} className="border-b border-desk-border last:border-b-0">
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] bg-vault-bg/10 text-desk-text">
                        {l.layer_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] ${statusBadge(l.status)}`}
                      >
                        {l.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-desk-muted">
                      {l.language ?? "— inherited from record"}
                    </td>
                    <td className="px-4 py-3 text-desk-muted">
                      {l.source_method.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-desk-text max-w-xs truncate">
                      {l.content.length > 200
                        ? l.content.slice(0, 200) + "..."
                        : l.content}
                    </td>
                    <td className="px-4 py-3 text-desk-muted">
                      {new Date(l.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canAddLayer && <AddTextLayerForm recordId={recordId} projectId={id} />}
      </section>
    </div>
  );
}
