"use client";

import { useState } from "react";
import Link from "next/link";
import type { SourceRecord, EnrichedFileAsset, TextLayer, LayerType } from "@/types";

const LAYER_TYPE_LABELS: Record<LayerType, string> = {
  source_ocr: "Source OCR",
  source_transcription: "Source Transcription",
  corrected_transcription: "Corrected Transcription",
  normalized_orthography: "Normalized Orthography",
  machine_translation: "Machine Translation",
  corrected_translation: "Corrected Translation",
};

const LAYER_STATUS_STYLES: Record<string, string> = {
  raw: "bg-vault-bg/10 text-desk-muted",
  reviewed: "bg-blue-50 text-blue-700",
  approved: "bg-green-50 text-green-700",
  uncertain: "bg-amber-50 text-amber-700",
  needs_expert_review: "bg-red-50 text-red-700",
};

// Layer selection priority for default active layer
const LAYER_PRIORITY: LayerType[] = [
  "corrected_translation",
  "machine_translation",
  "corrected_transcription",
  "source_transcription",
  "source_ocr",
];

function isSafeUrl(url: string | null): url is string {
  if (!url) return false;
  return url.startsWith("https://") || url.startsWith("http://");
}

const TRUSTED_IFRAME_ORIGINS: string[] = [
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  "https://cdm21048.contentdm.oclc.org",
  "https://ibali.uct.ac.za",
].filter(Boolean) as string[];

function isTrustedOrigin(url: string): boolean {
  return TRUSTED_IFRAME_ORIGINS.some((origin) => url.startsWith(origin));
}

function selectDefaultLayer(layers: TextLayer[]): TextLayer | null {
  for (const layerType of LAYER_PRIORITY) {
    const found = layers.find((l) => l.layer_type === layerType);
    if (found) return found;
  }
  return layers[0] ?? null;
}

export default function ScholarlyReader({
  record,
  fileAssets,
  textLayers,
  projectId,
  projectName,
}: {
  record: SourceRecord;
  fileAssets: EnrichedFileAsset[];
  textLayers: TextLayer[];
  projectId: string;
  projectName: string;
}) {
  const [activeAsset, setActiveAsset] = useState<EnrichedFileAsset | null>(
    fileAssets[0] ?? null
  );
  const [activeLayer, setActiveLayer] = useState<TextLayer | null>(
    selectDefaultLayer(textLayers)
  );

  return (
    <div className="flex flex-col h-screen bg-desk-bg">
      {/* Top strip */}
      <div className="border-b border-desk-border bg-desk-sheet px-6 py-3 flex items-center gap-4 shrink-0">
        <nav className="text-xs font-sans text-desk-muted flex items-center gap-1 shrink-0">
          <Link
            href={`/projects/${projectId}`}
            className="hover:underline underline-offset-2"
          >
            {projectName}
          </Link>
          <span>/</span>
          <Link
            href={`/projects/${projectId}/records`}
            className="hover:underline underline-offset-2"
          >
            Records
          </Link>
          <span>/</span>
          <Link
            href={`/projects/${projectId}/records/${record.id}`}
            className="hover:underline underline-offset-2"
          >
            {record.canonical_ref}
          </Link>
          <span>/</span>
          <span className="text-desk-text">Reader</span>
        </nav>

        <span className="font-serif text-base text-desk-text tracking-tight">
          {record.canonical_ref}
        </span>

        <div className="flex items-center gap-4 text-xs font-sans text-desk-muted ml-auto">
          {record.source_archive && <span>{record.source_archive}</span>}
          {record.language && <span>{record.language}</span>}
          {(record.date_issued ?? record.date_issued_raw) && (
            <span>{record.date_issued ?? record.date_issued_raw}</span>
          )}
        </div>
      </div>

      {/* Main panels */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        {/* Left panel — file viewer */}
        <div className="overflow-y-auto h-full border-r border-desk-border flex flex-col">
          {fileAssets.length === 0 ? (
            <div className="p-6">
              <p className="text-desk-muted text-sm font-sans">No file assets.</p>
            </div>
          ) : (
            <>
              {/* Asset switcher */}
              {fileAssets.length > 1 && (
                <div className="border-b border-desk-border px-4 py-2 flex gap-2 flex-wrap shrink-0 bg-desk-sheet">
                  {fileAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setActiveAsset(asset)}
                      className={`text-xs font-sans px-3 py-1 rounded-[2px] border transition-colors duration-hover ${
                        activeAsset?.id === asset.id
                          ? "border-historic text-historic bg-desk-bg"
                          : "border-desk-border text-desk-muted hover:text-desk-text"
                      }`}
                    >
                      {asset.original_filename}
                    </button>
                  ))}
                </div>
              )}

              {/* Active asset viewer */}
              <div className="flex-1 p-4">
                {activeAsset && (() => {
                  const url = activeAsset.view_url;
                  const safe = isSafeUrl(url);

                  if (!safe) {
                    return (
                      <p className="text-desk-muted text-sm font-sans">
                        Preview unavailable.
                      </p>
                    );
                  }

                  if (
                    activeAsset.mime_type === "application/pdf" &&
                    isTrustedOrigin(url)
                  ) {
                    return (
                      <iframe
                        src={url}
                        className="w-full border-0 min-h-[500px]"
                        style={{ height: "calc(100vh - 160px)" }}
                        title={activeAsset.original_filename}
                      />
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <p className="text-desk-muted text-sm font-sans">
                        Preview unavailable for this file type.
                      </p>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-sans text-historic hover:underline underline-offset-2"
                      >
                        Open in new tab ↗
                      </a>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>

        {/* Right panel — text layers */}
        <div className="overflow-y-auto h-full flex flex-col">
          {textLayers.length === 0 ? (
            <div className="p-6">
              <p className="text-desk-muted text-sm font-sans">No text layers.</p>
            </div>
          ) : (
            <>
              {/* Layer tabs */}
              <div className="border-b border-desk-border px-4 flex gap-1 flex-wrap shrink-0 bg-desk-sheet">
                {textLayers.map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setActiveLayer(layer)}
                    className={`text-xs font-sans px-3 py-2.5 border-b-2 transition-colors duration-hover ${
                      activeLayer?.id === layer.id
                        ? "border-historic text-desk-text"
                        : "border-transparent text-desk-muted hover:text-desk-text"
                    }`}
                  >
                    {LAYER_TYPE_LABELS[layer.layer_type]}
                  </button>
                ))}
              </div>

              {/* Selected layer content */}
              {activeLayer && (
                <div className="flex-1 p-4">
                  {/* Layer metadata */}
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] bg-vault-bg/10 text-desk-text">
                      {LAYER_TYPE_LABELS[activeLayer.layer_type]}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] ${
                        LAYER_STATUS_STYLES[activeLayer.status] ?? "bg-vault-bg/10 text-desk-muted"
                      }`}
                    >
                      {activeLayer.status.replace(/_/g, " ")}
                    </span>
                    {activeLayer.language && (
                      <span className="text-xs font-sans text-desk-muted">
                        {activeLayer.language}
                      </span>
                    )}
                    <span className="text-xs font-sans text-desk-muted ml-auto">
                      {new Date(activeLayer.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Layer content */}
                  <pre className="whitespace-pre-wrap text-sm font-sans text-desk-text leading-relaxed bg-desk-bg rounded-[2px] p-4 border border-desk-border">
                    {activeLayer.content}
                  </pre>
                </div>
              )}

              {/* Annotations strip */}
              <div className="border-t border-desk-border px-4 py-3 shrink-0 bg-desk-sheet">
                <p className="text-xs font-sans uppercase tracking-widest text-desk-muted mb-1">
                  Annotations
                </p>
                <p className="text-sm font-sans text-desk-muted italic">
                  None yet.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
