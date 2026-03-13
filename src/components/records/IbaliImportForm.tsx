"use client";

import { useActionState } from "react";
import Link from "next/link";
import { importFromIbali } from "@/lib/actions/import-ibali";

const initialState = { error: null as string | null, recordId: undefined as string | undefined };

export default function IbaliImportForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(importFromIbali, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />

      <div>
        <label
          htmlFor="ibali_item_id"
          className="block text-xs font-sans uppercase tracking-widest text-desk-muted mb-1"
        >
          Ibali Item ID or URL
        </label>
        <input
          id="ibali_item_id"
          name="ibali_item_id"
          type="text"
          placeholder="180673"
          required
          className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text bg-white focus:outline-none focus:ring-1 focus:ring-desk-text placeholder:text-desk-muted/50"
        />
        <p className="text-xs text-desk-muted font-sans mt-1">
          Enter a numeric item ID or a full Ibali URL (e.g.{" "}
          <span className="font-mono">https://ibali.uct.ac.za/items/180673</span>)
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
