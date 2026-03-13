"use client";

import { useActionState } from "react";
import { generateMachineTranslation } from "@/lib/actions/generate-translation";
import { TARGET_LANGUAGE_ALLOWLIST } from "@/lib/translation/translation-constants";

type Props = {
  recordId: string;
  canGenerate: boolean;
  hasEligibleLayer: boolean;
  hasActiveMtLayer: boolean;
};

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  af: "Afrikaans",
  fr: "French",
  de: "German",
  pt: "Portuguese",
};

type ActionResult = { data: { layerId: string } } | { error: string } | null;

export default function GenerateTranslationSection({
  recordId,
  canGenerate,
  hasEligibleLayer,
  hasActiveMtLayer,
}: Props) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    generateMachineTranslation,
    null
  );

  // Role gate is silent — non-authorized users see nothing
  if (!canGenerate) return null;

  if (!hasEligibleLayer) {
    return (
      <div className="border border-desk-border rounded-[2px] p-4 mt-4">
        <p className="text-xs font-sans text-desk-muted">
          No eligible text layer found. Add a transcription layer before generating a translation.
        </p>
      </div>
    );
  }

  if (hasActiveMtLayer) {
    return (
      <div className="border border-desk-border rounded-[2px] p-4 mt-4">
        <p className="text-xs font-sans text-desk-muted">
          A machine translation draft already exists for this record.
        </p>
      </div>
    );
  }

  const isSuccess = state && "data" in state;
  const isError = state && "error" in state;

  return (
    <div className="border border-desk-border rounded-[2px] p-4 mt-4">
      <h3 className="font-sans text-xs uppercase tracking-widest text-desk-muted mb-3">
        Generate Machine Translation
      </h3>

      {isSuccess && (
        <p className="text-xs font-sans text-green-700 mb-3">
          Machine translation draft created. Layer ID:{" "}
          <span className="font-mono">{state.data.layerId}</span>
        </p>
      )}

      {isError && (
        <p className="text-xs font-sans text-red-600 mb-3">{state.error}</p>
      )}

      {!isSuccess && (
        <form action={formAction} className="flex items-end gap-3">
          <input type="hidden" name="recordId" value={recordId} />

          <div className="flex flex-col gap-1">
            <label
              htmlFor="targetLanguage"
              className="text-[10px] font-sans uppercase tracking-widest text-desk-muted"
            >
              Target Language
            </label>
            <select
              id="targetLanguage"
              name="targetLanguage"
              defaultValue="en"
              disabled={isPending}
              className="text-sm font-sans border border-desk-border rounded-[2px] px-2 py-1.5 bg-white text-desk-text focus:outline-none focus:border-desk-text"
            >
              {TARGET_LANGUAGE_ALLOWLIST.map((code) => (
                <option key={code} value={code}>
                  {LANGUAGE_LABELS[code] ?? code}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="text-xs font-sans px-3 py-1.5 border border-desk-border rounded-[2px] text-desk-muted hover:text-desk-text hover:border-desk-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? "Generating…" : "Generate Machine Translation"}
          </button>
        </form>
      )}
    </div>
  );
}
