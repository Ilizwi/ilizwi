"use client";

import { useState } from "react";
import { getCitationPacket } from "@/lib/actions/citation-export";
import {
  serializeToText,
  serializeToJSON,
  sanitizeCitationFilename,
} from "@/lib/citation/citation-packet";

type Props = {
  recordId: string;
  canonicalRef: string;
};

function triggerDownload(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function CitationExportButton({ recordId, canonicalRef }: Props) {
  const [loadingTxt, setLoadingTxt] = useState(false);
  const [loadingJson, setLoadingJson] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const safeRef = sanitizeCitationFilename(canonicalRef);

  async function handleExportTxt() {
    setLoadingTxt(true);
    setError(null);
    try {
      const result = await getCitationPacket(recordId);
      if (result.error || !result.packet) {
        setError(result.error ?? "Export failed");
        return;
      }
      triggerDownload(serializeToText(result.packet), "text/plain", `${safeRef}-citation.txt`);
    } catch {
      setError("Export failed — please try again");
    } finally {
      setLoadingTxt(false);
    }
  }

  async function handleExportJson() {
    setLoadingJson(true);
    setError(null);
    try {
      const result = await getCitationPacket(recordId);
      if (result.error || !result.packet) {
        setError(result.error ?? "Export failed");
        return;
      }
      triggerDownload(serializeToJSON(result.packet), "application/json", `${safeRef}-citation.json`);
    } catch {
      setError("Export failed — please try again");
    } finally {
      setLoadingJson(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-sans uppercase tracking-widest text-desk-muted">
          Export Citation
        </span>
        <button
          onClick={handleExportTxt}
          disabled={loadingTxt || loadingJson}
          className="inline-flex items-center gap-1 text-sm font-sans px-3 py-1.5 border border-desk-border rounded-[2px] text-desk-text hover:border-historic hover:text-historic transition-colors duration-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingTxt ? "Generating…" : ".txt"}
        </button>
        <button
          onClick={handleExportJson}
          disabled={loadingTxt || loadingJson}
          className="inline-flex items-center gap-1 text-sm font-sans px-3 py-1.5 border border-desk-border rounded-[2px] text-desk-text hover:border-historic hover:text-historic transition-colors duration-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loadingJson ? "Generating…" : ".json"}
        </button>
      </div>
      {error && (
        <p className="text-xs font-sans text-red-600">{error}</p>
      )}
    </div>
  );
}
