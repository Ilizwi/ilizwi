"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadRecord } from "@/lib/actions/records";
import { generateCanonicalRef } from "@/lib/records/canonical-ref";
import type { SourceType } from "@/types";

const SOURCE_TYPE_OPTIONS: SourceType[] = [
  "manual_readex",
  "ibali",
  "nlsa",
  "wits",
];

const initialState = { error: null as string | null, recordId: undefined as string | undefined };

export default function UploadForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(
    uploadRecord,
    initialState
  );
  const router = useRouter();

  // Controlled state for live canonical ref preview
  const [sourceType, setSourceType] = useState<string>("manual_readex");
  const [publicationTitle, setPublicationTitle] = useState("");
  const [dateIssued, setDateIssued] = useState("");
  const [pageLabel, setPageLabel] = useState("");
  const [volume, setVolume] = useState("");
  const [issueNumber, setIssueNumber] = useState("");
  const [articleLabel, setArticleLabel] = useState("");

  const previewRef =
    publicationTitle && dateIssued
      ? generateCanonicalRef({
          source_type: sourceType,
          publication_title: publicationTitle,
          date_issued: dateIssued,
          page_label: pageLabel || null,
          volume: volume || null,
          issue_number: issueNumber || null,
          article_label: articleLabel || null,
        })
      : null;

  useEffect(() => {
    if (state.recordId) {
      router.push(`/projects/${projectId}/records`);
    }
  }, [state.recordId, projectId, router]);

  return (
    <form action={formAction} className="space-y-4 max-w-lg">
      <input type="hidden" name="projectId" value={projectId} />

      <div>
        <label
          htmlFor="file"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          File
        </label>
        <input
          id="file"
          name="file"
          type="file"
          required
          accept=".pdf,image/*"
          className="w-full text-sm font-sans text-desk-text file:mr-3 file:px-3 file:py-2 file:text-sm file:font-sans file:border file:border-desk-border file:rounded-[2px] file:bg-transparent file:text-desk-text file:cursor-pointer"
        />
      </div>

      <div>
        <label
          htmlFor="source_type"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Source Type
        </label>
        <select
          id="source_type"
          name="source_type"
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        >
          {SOURCE_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="source_archive"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Source Archive
        </label>
        <input
          id="source_archive"
          name="source_archive"
          required
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        />
      </div>

      <div>
        <label
          htmlFor="publication_title"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Publication Title
        </label>
        <input
          id="publication_title"
          name="publication_title"
          required
          value={publicationTitle}
          onChange={(e) => setPublicationTitle(e.target.value)}
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        />
      </div>

      <div>
        <label
          htmlFor="language"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Language
        </label>
        <input
          id="language"
          name="language"
          required
          placeholder="e.g. Zulu, Ndebele, Shona"
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        />
      </div>

      <div>
        <label
          htmlFor="date_issued"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Date Issued <span className="text-red-600">*</span>
        </label>
        <input
          id="date_issued"
          name="date_issued"
          type="date"
          required
          value={dateIssued}
          onChange={(e) => setDateIssued(e.target.value)}
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        />
      </div>

      <div>
        <label
          htmlFor="page_label"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Page Label
        </label>
        <input
          id="page_label"
          name="page_label"
          value={pageLabel}
          onChange={(e) => setPageLabel(e.target.value)}
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        />
      </div>

      <div>
        <label
          htmlFor="volume"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Volume <span className="text-desk-muted">(optional)</span>
        </label>
        <input
          id="volume"
          name="volume"
          value={volume}
          onChange={(e) => setVolume(e.target.value)}
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        />
      </div>

      <div>
        <label
          htmlFor="issue_number"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Issue Number <span className="text-desk-muted">(optional)</span>
        </label>
        <input
          id="issue_number"
          name="issue_number"
          value={issueNumber}
          onChange={(e) => setIssueNumber(e.target.value)}
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        />
      </div>

      <div>
        <label
          htmlFor="article_label"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Article Label <span className="text-desk-muted">(optional)</span>
        </label>
        <input
          id="article_label"
          name="article_label"
          value={articleLabel}
          onChange={(e) => setArticleLabel(e.target.value)}
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        />
      </div>

      {previewRef && (
        <div className="border border-desk-border rounded-[2px] px-3 py-2 bg-vault-bg/5">
          <p className="text-xs font-sans text-desk-muted mb-1 uppercase tracking-widest">
            Canonical Ref Preview
          </p>
          <p className="text-sm font-mono text-desk-text">{previewRef}</p>
        </div>
      )}

      {state.error && (
        <p className="text-red-600 text-sm font-sans">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors disabled:opacity-50"
      >
        {isPending ? "Uploading..." : "Upload Record"}
      </button>
    </form>
  );
}
