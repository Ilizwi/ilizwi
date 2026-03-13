"use client";

import { useState } from "react";
import type { EnrichedFileAsset } from "@/types";

function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isSafeUrl(url: string | null): url is string {
  if (!url) return false;
  return url.startsWith("https://") || url.startsWith("http://");
}

// Only embed PDFs from known, controlled asset origins.
// Non-allowlisted URLs render as open-link fallback instead of iframe.
const TRUSTED_IFRAME_ORIGINS: string[] = [
  process.env.NEXT_PUBLIC_SUPABASE_URL, // Supabase storage signed URLs
  "https://cdm21048.contentdm.oclc.org", // NLSA ContentDM
  "https://ibali.uct.ac.za",             // Ibali
].filter(Boolean) as string[];

function isTrustedOrigin(url: string): boolean {
  return TRUSTED_IFRAME_ORIGINS.some((origin) => url.startsWith(origin));
}

export default function FileViewerSection({
  assets,
}: {
  assets: EnrichedFileAsset[];
}) {
  const [activeAsset, setActiveAsset] = useState<EnrichedFileAsset | null>(
    null,
  );

  if (assets.length === 0) {
    return <p className="text-desk-muted text-sm font-sans">No file assets.</p>;
  }

  return (
    <div>
      <div className="border border-desk-border rounded-[2px] overflow-x-auto">
        <table className="w-full text-sm font-sans">
          <thead>
            <tr className="bg-vault-bg/5 text-xs uppercase tracking-widest font-normal text-desk-text">
              <th className="text-left px-4 py-2">Filename</th>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Size</th>
              <th className="text-left px-4 py-2">Asset Type</th>
              <th className="text-left px-4 py-2">Uploaded</th>
              <th className="text-left px-4 py-2">View</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => {
              const safeUrl = isSafeUrl(asset.view_url);
              const canView = safeUrl && !asset.view_url_error;

              return (
                <tr
                  key={asset.id}
                  className="bg-white border-t border-desk-border text-desk-text"
                >
                  <td className="px-4 py-2">{asset.original_filename}</td>
                  <td className="px-4 py-2">{asset.mime_type ?? "—"}</td>
                  <td className="px-4 py-2">{formatBytes(asset.size_bytes)}</td>
                  <td className="px-4 py-2">
                    <span className="inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] bg-vault-bg/10 text-desk-text">
                      {asset.asset_type}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {new Date(asset.uploaded_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2">
                    {canView ? (
                      <button
                        type="button"
                        onClick={() => setActiveAsset(asset)}
                        className="text-xs font-sans text-historic-green hover:underline underline-offset-2"
                      >
                        View
                      </button>
                    ) : (
                      <span
                        title="Preview unavailable"
                        className="text-xs font-sans text-desk-muted cursor-not-allowed opacity-50"
                      >
                        View
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {activeAsset && (
        <div className="mt-0 border border-desk-border rounded-[2px] border-t-0">
          <div className="bg-vault-bg/5 border-b border-desk-border px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-sans text-desk-text">
                {activeAsset.original_filename}
              </span>
              <span className="inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] bg-vault-bg/10 text-desk-text">
                {activeAsset.asset_type}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveAsset(null)}
              className="text-desk-muted hover:text-desk-text text-sm font-sans"
            >
              Close
            </button>
          </div>

          <div className="p-4">
            {(() => {
              const url = activeAsset.view_url;
              const safe = isSafeUrl(url);

              if (!safe) {
                return (
                  <p className="text-desk-muted text-sm font-sans">
                    Preview unavailable.
                  </p>
                );
              }

              if (activeAsset.mime_type === "application/pdf" && isTrustedOrigin(url)) {
                // Note: Signed URLs expire after ~1 hour. If the viewer stays open
                // past expiry, the iframe shows a broken/auth-error state.
                // This is an acceptable tradeoff — no auto-refresh logic needed.
                return (
                  <iframe
                    src={url}
                    className="h-[600px] w-full border-0"
                    title={activeAsset.original_filename}
                  />
                );
              }

              return (
                <p className="text-desk-muted text-sm font-sans">
                  Preview unavailable for this file type.{" "}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-historic-green hover:underline underline-offset-2"
                  >
                    Open in new tab
                  </a>
                </p>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
