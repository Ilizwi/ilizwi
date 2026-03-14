import { requireProjectMember } from "@/lib/auth/project-guard";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ScholarlyReader from "@/components/records/ScholarlyReader";
import type { SourceRecord, FileAsset, TextLayer, EnrichedFileAsset } from "@/types";

export default async function ReaderPage({
  params,
}: {
  params: Promise<{ id: string; recordId: string }>;
}) {
  const { id, recordId } = await params;
  const { project } = await requireProjectMember(id);
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
  // - source_url assets: use the URL directly
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

  // Text layers — fetch all, then derive active-only view (mirrors record detail page)
  const { data: textLayers } = await supabase
    .from("text_layers")
    .select("*")
    .eq("record_id", recordId)
    .order("created_at", { ascending: true });

  const typedLayers = (textLayers ?? []) as TextLayer[];

  // Active layers only: exclude any layer that is referenced by another layer's
  // supersedes_layer_id. This mirrors the exact logic on the record detail page
  // and ensures the reader never surfaces obsolete/superseded versions.
  const supersededIds = new Set(
    typedLayers
      .map((l) => l.supersedes_layer_id)
      .filter(Boolean) as string[]
  );
  const activeLayers = typedLayers.filter((l) => !supersededIds.has(l.id));

  return (
    <ScholarlyReader
      record={typedRecord}
      fileAssets={enrichedAssets}
      textLayers={activeLayers}
      projectId={id}
      projectName={project.name}
    />
  );
}
