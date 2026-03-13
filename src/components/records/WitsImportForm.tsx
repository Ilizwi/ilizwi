"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importFromWits } from "@/lib/actions/import-wits";

const initialState = { error: null as string | null, recordId: undefined as string | undefined };

export default function WitsImportForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(importFromWits, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />

      <div>
        <label
          htmlFor="witsRef"
          className="block text-xs font-sans uppercase tracking-widest text-desk-muted mb-1"
        >
          Wits OAI Identifier
        </label>
        <input
          id="witsRef"
          name="witsRef"
          type="text"
          placeholder="oai:researcharchives.wits.ac.za:historic_100002"
          required
          className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text bg-white focus:outline-none focus:ring-1 focus:ring-desk-text placeholder:text-desk-muted/50"
        />
        <p className="text-xs text-desk-muted font-sans mt-1">
          Accepted formats:{" "}
          <span className="font-mono">oai:researcharchives.wits.ac.za:&#123;id&#125;</span>
          {" "}or{" "}
          <span className="font-mono">oai:researcharchives.wits.ac.za:443:&#123;id&#125;</span>.{" "}
          Both forms resolve to the same record.
          Records without a parseable year in the date field will be rejected.
          Files are only linked if directly accessible from OAI metadata —
          most imports are metadata-only.
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
