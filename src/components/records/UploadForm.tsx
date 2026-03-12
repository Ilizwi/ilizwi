"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { uploadRecord } from "@/lib/actions/records";
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
          defaultValue="manual_readex"
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
          Date Issued
        </label>
        <input
          id="date_issued"
          name="date_issued"
          type="date"
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
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        />
      </div>

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
