"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importFromNlsa } from "@/lib/actions/import-nlsa";

const initialState = { error: null as string | null, recordId: undefined as string | undefined };

export default function NlsaImportForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(importFromNlsa, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />

      <div>
        <label
          htmlFor="nlsa_ref"
          className="block text-xs font-sans uppercase tracking-widest text-desk-muted mb-1"
        >
          NLSA Reference
        </label>
        <input
          id="nlsa_ref"
          name="nlsa_ref"
          type="text"
          placeholder="p21048coll37/1"
          required
          className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text bg-white focus:outline-none focus:ring-1 focus:ring-desk-text placeholder:text-desk-muted/50"
        />
        <p className="text-xs text-desk-muted font-sans mt-1">
          Enter{" "}
          <span className="font-mono">{"{alias}/{id}"}</span> or a full ContentDM URL.
          Known collections:{" "}
          <span className="font-mono">p21048coll37</span> (Imvo Zabantsundu),{" "}
          <span className="font-mono">p21048coll77</span> (Lentsoe la Basotho).
        </p>
      </div>

      {state.error && (
        <p className="text-sm font-sans text-red-600">{state.error}</p>
      )}

      {!state.error && state.recordId && (
        <p className="text-sm font-sans text-desk-text">
          Record imported.{" "}
          <Link
            href={`/projects/${projectId}/records/${state.recordId}`}
            className="underline underline-offset-2"
          >
            View record &rarr;
          </Link>
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm font-sans bg-desk-text text-white rounded-[2px] disabled:opacity-50"
      >
        {isPending ? "Importing\u2026" : "Import"}
      </button>
    </form>
  );
}
