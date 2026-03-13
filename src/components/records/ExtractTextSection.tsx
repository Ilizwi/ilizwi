"use client";

import { useActionState } from "react";
import { extractTextFromRecord } from "@/lib/actions/extract-text";

type Props = {
  recordId: string;
  hasPdfAsset: boolean;
  hasExistingSourceOcr: boolean;
  canExtract: boolean;
};

const initialState = { error: null as string | null, layerId: undefined as string | undefined };

export default function ExtractTextSection({
  recordId,
  hasPdfAsset,
  hasExistingSourceOcr,
  canExtract,
}: Props) {
  const [state, formAction, isPending] = useActionState(extractTextFromRecord, initialState);

  if (!hasPdfAsset) {
    return (
      <div className="mt-6 border border-desk-border rounded-[2px] px-4 py-4">
        <p className="text-xs font-sans uppercase tracking-widest text-desk-muted mb-1">
          Text Extraction
        </p>
        <p className="text-sm font-sans text-desk-muted">
          OCR for image files is not supported in V1 — add text manually using the form below.
        </p>
      </div>
    );
  }

  if (!canExtract) return null;

  return (
    <div className="mt-6 border border-desk-border rounded-[2px] px-4 py-4">
      <p className="text-xs font-sans uppercase tracking-widest text-desk-muted mb-3">
        Text Extraction
      </p>

      {hasExistingSourceOcr && !state.layerId && (
        <p className="text-xs font-sans text-desk-muted mb-3">
          A source text layer already exists. Extracting again will create a new layer superseding
          the previous one, unless the content is unchanged.
        </p>
      )}

      {state.layerId ? (
        <p className="text-sm font-sans text-desk-text">
          Source text layer saved.{" "}
          <span className="text-desk-muted font-mono text-xs">{state.layerId}</span>
        </p>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="recordId" value={recordId} />
          {state.error && (
            <p className="text-sm font-sans text-red-600 mb-3">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors disabled:opacity-50"
          >
            {isPending ? "Extracting\u2026" : "Extract Text from PDF"}
          </button>
        </form>
      )}
    </div>
  );
}
