"use client";

import { useActionState } from "react";
import { generateClaudeTranslation } from "@/lib/actions/generate-claude-translation";

type Props = {
  recordId: string;
  canEscalate: boolean;
  hasEligibleLayer: boolean;
  hasGoogleMtLayer: boolean;
  hasClaudeMtLayer: boolean;
};

type ActionResult = { data: { layerId: string } } | { error: string } | null;

export default function RetryWithClaudeSection({
  recordId,
  canEscalate,
  hasEligibleLayer,
  hasGoogleMtLayer,
  hasClaudeMtLayer,
}: Props) {
  const [state, formAction, isPending] = useActionState<ActionResult, FormData>(
    generateClaudeTranslation,
    null
  );

  // Only show after a Google MT draft exists and user is eligible
  if (!canEscalate || !hasGoogleMtLayer || !hasEligibleLayer) return null;

  const isError = state && "error" in state;

  // Settled state — Claude draft already exists
  if (hasClaudeMtLayer) {
    return (
      <div className="border border-desk-border rounded-[2px] p-4 mt-2">
        <p className="text-xs font-sans text-desk-muted">
          Claude (Anthropic) draft generated. Compare both drafts in Text Layers above,
          then use &ldquo;Correct Translation&rdquo; on whichever you prefer as your starting point.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-desk-border rounded-[2px] p-4 mt-2">
      <h3 className="font-sans text-xs uppercase tracking-widest text-desk-muted mb-1">
        Escalate to Claude
      </h3>
      <p className="text-xs font-sans text-desk-muted mb-3">
        If the Google draft is insufficient for this historical passage, request a
        scholarly re-translation using Claude (Anthropic). Both drafts will be preserved.
      </p>

      {isError && (
        <p className="text-xs font-sans text-red-600 mb-3">{state.error}</p>
      )}

      <form action={formAction}>
        <input type="hidden" name="recordId" value={recordId} />
        <button
          type="submit"
          disabled={isPending}
          className="text-xs font-sans px-3 py-1.5 border border-desk-border rounded-[2px] text-desk-muted hover:text-desk-text hover:border-desk-text transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Generating…" : "Retry with Claude"}
        </button>
      </form>
    </div>
  );
}
