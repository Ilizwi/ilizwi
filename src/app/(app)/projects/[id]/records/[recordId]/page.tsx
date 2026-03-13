import { requireProjectMember } from "@/lib/auth/project-guard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AddTextLayerForm from "@/components/records/AddTextLayerForm";
import type { SourceRecord, FileAsset, TextLayer, EnrichedFileAsset } from "@/types";
import FileViewerSection from "@/components/records/FileViewerSection";
import ExtractTextSection from "@/components/records/ExtractTextSection";
import TextLayerCard from "@/components/records/TextLayerCard";
import GenerateTranslationSection from "@/components/records/GenerateTranslationSection";

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

  // PDF extraction eligibility — only for records with a locally-stored PDF
  const hasPdfAsset = typedAssets.some(
    (a) => a.mime_type === "application/pdf" && a.storage_path !== null
  );

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

  const supersededIds = new Set(
    typedLayers
      .map((l) => l.supersedes_layer_id)
      .filter(Boolean) as string[]
  );

  const sortedLayers = [...typedLayers].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const activeLayers = sortedLayers.filter((l) => !supersededIds.has(l.id));
  const supersededLayers = sortedLayers.filter((l) => supersededIds.has(l.id));

  // Idempotency hint — does a file_extract source_ocr layer already exist?
  const hasExistingSourceOcr = typedLayers.some(
    (l) => l.layer_type === "source_ocr" && l.source_method === "file_extract"
  );

  // Machine translation eligibility flags
  const ELIGIBLE_LAYER_TYPES_FOR_MT = ['corrected_transcription', 'source_transcription', 'source_ocr'];
  const hasEligibleLayer = typedLayers.some(
    (l) => ELIGIBLE_LAYER_TYPES_FOR_MT.includes(l.layer_type) && !supersededIds.has(l.id)
  );
  const hasActiveMtLayer = typedLayers.some(
    (l) => l.layer_type === 'machine_translation' && !supersededIds.has(l.id)
  );

  // Permission: can add text layer?
  // canCorrectTranslation is membership-only (no super_admin bypass) —
  // the saveTranslationCorrection action is membership-only and the
  // text_layers SELECT policy is also membership-only. Initialising from
  // super_admin would create a read/write boundary mismatch (same issue
  // removed in F012/F013).
  let canAddLayer = profile.global_role === "super_admin";
  let canCorrectTranslation = false;
  if (!canAddLayer || !canCorrectTranslation) {
    const { data: membership } = await supabase
      .from("project_memberships")
      .select("role")
      .eq("project_id", id)
      .eq("user_id", profile.id)
      .single();
    canAddLayer = canAddLayer ||
      membership?.role === "project_admin" ||
      membership?.role === "researcher";
    canCorrectTranslation =
      membership?.role === "project_admin" ||
      membership?.role === "researcher" ||
      membership?.role === "translator";
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
          <>
            <div className="space-y-3">
              {activeLayers.map((l) => (
                <TextLayerCard
                  key={l.id}
                  layer={l}
                  isSuperseded={false}
                  canAddLayer={canAddLayer}
                  canCorrectTranslation={canCorrectTranslation}
                  recordId={recordId}
                />
              ))}
            </div>

            {supersededLayers.length > 0 && (
              <div className="mt-6">
                <h3 className="font-sans text-xs uppercase tracking-widest text-desk-muted mb-3">
                  Superseded Versions
                </h3>
                <div className="space-y-3">
                  {supersededLayers.map((l) => (
                    <TextLayerCard
                      key={l.id}
                      layer={l}
                      isSuperseded={true}
                      canAddLayer={canAddLayer}
                      canCorrectTranslation={canCorrectTranslation}
                      recordId={recordId}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {canAddLayer && (
          <ExtractTextSection
            recordId={recordId}
            hasPdfAsset={hasPdfAsset}
            hasExistingSourceOcr={hasExistingSourceOcr}
            canExtract={canAddLayer}
          />
        )}
        {canAddLayer && (
          <GenerateTranslationSection
            recordId={recordId}
            canGenerate={canAddLayer}
            hasEligibleLayer={hasEligibleLayer}
            hasActiveMtLayer={hasActiveMtLayer}
          />
        )}
        {canAddLayer && <AddTextLayerForm recordId={recordId} projectId={id} />}
      </section>
    </div>
  );
}
