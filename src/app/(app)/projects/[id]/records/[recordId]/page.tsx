import { requireProjectMember } from "@/lib/auth/project-guard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AddTextLayerForm from "@/components/records/AddTextLayerForm";
import type { SourceRecord, FileAsset, TextLayer, EnrichedFileAsset, Annotation, RecordFlag } from "@/types";
import FileViewerSection from "@/components/records/FileViewerSection";
import ExtractTextSection from "@/components/records/ExtractTextSection";
import TextLayerCard from "@/components/records/TextLayerCard";
import GenerateTranslationSection from "@/components/records/GenerateTranslationSection";
import AnnotationsPanel from "@/components/records/AnnotationsPanel";
import { addAnnotation, updateAnnotation } from "@/lib/actions/annotations";
import RecordFlagsPanel from "@/components/records/RecordFlagsPanel";
import { addRecordFlag, updateRecordFlag, removeRecordFlag } from "@/lib/actions/record-flags";

export default async function RecordDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; recordId: string }>;
  searchParams?: Promise<{
    editAnnotation?: string;
    addAnnotationError?: string;
    editAnnotationError?: string;
    editFlag?: string;
    addFlagError?: string;
    removeFlagError?: string;
    updateFlagNoteError?: string;
  }>;
}) {
  const { id, recordId } = await params;
  const resolvedSearch = await searchParams;
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

  const canOpenReader = typedAssets.length > 0 && typedLayers.length > 0;

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

  // Glossary matching — find source layer by priority
  const SOURCE_LAYER_PRIORITY = ['corrected_transcription', 'source_transcription', 'source_ocr'] as const;
  const hasTranslationLayer = activeLayers.some(
    (l) => l.layer_type === 'machine_translation' || l.layer_type === 'corrected_translation'
  );
  let sourceLayerContent: string | null = null;
  if (hasTranslationLayer) {
    for (const layerType of SOURCE_LAYER_PRIORITY) {
      const found = activeLayers.find((l) => l.layer_type === layerType);
      if (found) {
        sourceLayerContent = found.content;
        break;
      }
    }
  }

  // Whole-word, case-insensitive term matching.
  // Strategy: tokenise content by splitting on whitespace and stripping leading/trailing
  // punctuation from each token (Unicode-aware). This avoids false positives like
  // matching "ink" inside "thinking" while correctly handling historical punctuation.
  function matchesWholeWord(content: string, term: string): boolean {
    const termNorm = term.toLowerCase().trim();
    const tokens = content
      .split(/\s+/)
      .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase());
    return tokens.includes(termNorm);
  }

  let matchedRules: { id: string; term: string; rule_type: string; approved_translation: string | null; note: string | null }[] = [];
  if (sourceLayerContent) {
    const { data: glossaryRules } = await supabase
      .from("glossary_rules")
      .select("*")
      .eq("project_id", id)
      .eq("language", typedRecord.language)
      .eq("active", true)
      .order("term", { ascending: true });

    matchedRules = (glossaryRules ?? []).filter((rule: { term: string }) =>
      matchesWholeWord(sourceLayerContent!, rule.term)
    );
  }

  // Annotations — fetched with profiles join for author attribution
  const { data: annotationsData } = await supabase
    .from("annotations")
    .select("*, profiles(display_name, email)")
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });

  const annotations = (annotationsData ?? []) as Annotation[];

  // Record flags — fetched with profiles join for author attribution
  const { data: flagsData } = await supabase
    .from("record_flags")
    .select("*, profiles(display_name, email)")
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });

  const recordFlags = (flagsData ?? []) as RecordFlag[];

  // Permission: can add text layer?
  // canCorrectTranslation is membership-only (no super_admin bypass) —
  // the saveTranslationCorrection action is membership-only and the
  // text_layers SELECT policy is also membership-only. Initialising from
  // super_admin would create a read/write boundary mismatch (same issue
  // removed in F012/F013).
  let canAddLayer = profile.global_role === "super_admin";
  // canEditAllAnnotations: project_admin or super_admin can edit any annotation.
  // Researchers can only edit their own (handled by annotation.created_by check in panel).
  // Do NOT reuse canAddLayer here — researchers can add layers but not edit others' annotations.
  let canEditAllAnnotations = profile.global_role === "super_admin";
  let canCorrectTranslation = false;
  // Flags are membership-only — no super_admin bypass (matches record-flags.ts actions).
  // A super_admin who is not a project member cannot mutate flags; initialising from
  // super_admin would expose Edit/Remove affordances that always fail on submit.
  let canManageFlags = false;
  let canEditAllFlags = false;
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
    canEditAllAnnotations = canEditAllAnnotations ||
      membership?.role === "project_admin";
    canCorrectTranslation =
      membership?.role === "project_admin" ||
      membership?.role === "researcher" ||
      membership?.role === "translator";
    // Any project member can add/remove their own flags; project_admin can edit any.
    canManageFlags = !!membership;
    canEditAllFlags = membership?.role === "project_admin";
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

  const ruleTypeBadgeClass = (ruleType: string): string => {
    switch (ruleType) {
      case "do_not_translate": return "bg-red-50 text-red-700";
      case "always_flag": return "bg-amber-50 text-amber-700";
      case "approved_translation": return "bg-green-50 text-green-700";
      case "preserve_original": return "bg-blue-50 text-blue-700";
      default: return "bg-vault-bg/10 text-desk-muted";
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

  // Server action wrappers — handle redirects; underlying actions return { error }
  async function handleAddAnnotation(formData: FormData) {
    "use server";
    const result = await addAnnotation({ error: null }, formData);
    if (result.error) {
      redirect(
        `/projects/${id}/records/${recordId}?addAnnotationError=${encodeURIComponent(result.error)}`
      );
    }
  }

  async function handleUpdateAnnotation(formData: FormData) {
    "use server";
    const annotationId = formData.get("annotation_id") as string;
    const result = await updateAnnotation({ error: null }, formData);
    if (result.error) {
      redirect(
        `/projects/${id}/records/${recordId}?editAnnotationError=${encodeURIComponent(result.error)}&editAnnotation=${annotationId}`
      );
    } else {
      redirect(`/projects/${id}/records/${recordId}`);
    }
  }

  async function handleAddFlag(formData: FormData) {
    "use server";
    const result = await addRecordFlag({ error: null }, formData);
    if (result.error) {
      redirect(
        `/projects/${id}/records/${recordId}?addFlagError=${encodeURIComponent(result.error)}`
      );
    }
  }

  async function handleUpdateFlagNote(formData: FormData) {
    "use server";
    const flagId = formData.get("flag_id") as string;
    const result = await updateRecordFlag({ error: null }, formData);
    if (result.error) {
      redirect(
        `/projects/${id}/records/${recordId}?updateFlagNoteError=${encodeURIComponent(result.error)}&editFlag=${flagId}`
      );
    } else {
      redirect(`/projects/${id}/records/${recordId}`);
    }
  }

  async function handleRemoveFlag(formData: FormData) {
    "use server";
    const result = await removeRecordFlag({ error: null }, formData);
    if (result.error) {
      redirect(
        `/projects/${id}/records/${recordId}?removeFlagError=${encodeURIComponent(result.error)}`
      );
    }
  }

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

      {canOpenReader && (
        <div className="mb-8">
          <Link
            href={`/projects/${id}/records/${recordId}/reader`}
            className="inline-flex items-center gap-1.5 text-sm font-sans px-4 py-2 border border-desk-border rounded-[2px] text-desk-text hover:border-historic hover:text-historic transition-colors duration-hover"
          >
            Scholar&rsquo;s Reader
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      )}

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

        {matchedRules.length > 0 && (
          <div className="mb-4 border border-desk-border rounded-[2px] overflow-hidden">
            <div className="bg-vault-bg/5 border-b border-desk-border px-4 py-2 flex items-center justify-between">
              <span className="text-xs font-sans uppercase tracking-widest text-desk-muted">
                Glossary Matches ({matchedRules.length})
              </span>
              <span className="text-xs font-sans text-desk-muted italic">informational only</span>
            </div>
            <div className="divide-y divide-desk-border">
              {matchedRules.map((rule) => (
                <div key={rule.id} className="px-4 py-3 flex items-start gap-4">
                  <span className="font-sans text-sm font-medium text-desk-text min-w-[120px]">{rule.term}</span>
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] ${ruleTypeBadgeClass(rule.rule_type)}`}>
                    {rule.rule_type.replace(/_/g, " ")}
                  </span>
                  {rule.approved_translation && (
                    <span className="text-sm font-sans text-desk-text">&rarr; {rule.approved_translation}</span>
                  )}
                  {rule.note && (
                    <span className="text-sm font-sans text-desk-muted italic">{rule.note}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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

      {/* Annotations */}
      <section className="mb-8">
        <h2 className="font-serif text-xl text-desk-text mb-4">Annotations</h2>
        <AnnotationsPanel
          annotations={annotations}
          textLayers={typedLayers}
          projectId={id}
          recordId={recordId}
          currentUserId={profile.id}
          canEditAll={canEditAllAnnotations}
          editAnnotationId={resolvedSearch?.editAnnotation}
          addAction={handleAddAnnotation}
          editAction={handleUpdateAnnotation}
          addError={resolvedSearch?.addAnnotationError}
          editError={resolvedSearch?.editAnnotationError}
        />
      </section>

      {/* Flags */}
      <section className="mb-8">
        <h2 className="font-serif text-xl text-desk-text mb-4">Flags</h2>
        <RecordFlagsPanel
          flags={recordFlags}
          textLayers={typedLayers}
          projectId={id}
          recordId={recordId}
          currentUserId={profile.id}
          canManageFlags={canManageFlags}
          canEditAll={canEditAllFlags}
          editFlagId={resolvedSearch?.editFlag}
          addAction={handleAddFlag}
          removeAction={handleRemoveFlag}
          updateNoteAction={handleUpdateFlagNote}
          addError={resolvedSearch?.addFlagError}
          removeError={resolvedSearch?.removeFlagError}
          updateNoteError={resolvedSearch?.updateFlagNoteError}
        />
      </section>
    </div>
  );
}
