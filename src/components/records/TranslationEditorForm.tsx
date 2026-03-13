"use client";

import { useActionState, useEffect, useRef } from "react";
import { saveTranslationCorrection } from "@/lib/actions/save-translation-correction";

export default function TranslationEditorForm({
  sourceContent,
  sourceLanguage,
  sourceLayerId,
  onClose,
}: {
  sourceContent: string;
  sourceLanguage: string | null;
  sourceLayerId: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(saveTranslationCorrection, { error: null });
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && state.error === null) {
      onClose();
    }
  }, [state, onClose]);

  return (
    <div className="border border-desk-border rounded-[2px] p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-serif text-sm text-desk-text">Correct Translation</h4>
        <button type="button" onClick={onClose} className="text-xs font-sans text-desk-muted hover:text-desk-text transition-colors">Cancel</button>
      </div>

      <form action={(fd) => { submitted.current = true; formAction(fd); }} className="space-y-3">
        <input type="hidden" name="sourceLayerId" value={sourceLayerId} />

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">Language</label>
          <p className="text-sm font-sans text-desk-text">{sourceLanguage ?? "inherited from record"}</p>
        </div>

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">Content</label>
          <textarea name="content" required rows={6} defaultValue={sourceContent}
            className="border border-desk-border rounded-[2px] px-3 py-2 w-full text-sm font-sans text-desk-text" />
        </div>

        {state.error && <p className="text-red-600 text-sm font-sans">{state.error}</p>}

        <button type="submit" disabled={isPending}
          className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors disabled:opacity-50">
          {isPending ? "Saving…" : "Save Correction"}
        </button>
      </form>
    </div>
  );
}
