"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveTranslationCorrection } from "@/lib/actions/save-translation-correction";
import {
  getTranslationMemorySuggestions,
  type TranslationMemorySuggestion,
} from "@/lib/actions/get-translation-memory-suggestions";

export default function TranslationEditorForm({
  sourceContent,
  sourceLanguage,
  sourceLayerId,
  mtLayerId,
  onClose,
}: {
  sourceContent: string;
  sourceLanguage: string | null;
  sourceLayerId: string;
  mtLayerId: string;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(saveTranslationCorrection, {
    error: null,
  });
  const submitted = useRef(false);

  const [content, setContent] = useState(sourceContent);
  const [suggestions, setSuggestions] = useState<TranslationMemorySuggestion[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Fetch TM suggestions on mount — failure is silently swallowed
  useEffect(() => {
    getTranslationMemorySuggestions({
      mtLayerId,
      targetLanguage: sourceLanguage,
    }).then(setSuggestions).catch(() => {});
  }, [mtLayerId, sourceLanguage]);

  useEffect(() => {
    if (submitted.current && state.error === null) {
      onClose();
    }
  }, [state, onClose]);

  const visibleSuggestions = suggestions.filter((s) => !dismissedIds.has(s.id));

  function dismiss(id: string) {
    setDismissedIds((prev) => new Set([...prev, id]));
  }

  return (
    <div className="border border-desk-border rounded-[2px] p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-serif text-sm text-desk-text">Correct Translation</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-sans text-desk-muted hover:text-desk-text transition-colors"
        >
          Cancel
        </button>
      </div>

      {visibleSuggestions.length > 0 && (
        <div className="mb-4 border border-desk-border rounded-[2px] p-3 bg-desk-surface">
          <p className="text-xs font-sans text-desk-muted uppercase tracking-widest mb-2">
            Translation Memory
          </p>
          <div className="space-y-3">
            {visibleSuggestions.map((s) => (
              <div key={s.id} className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-sans text-desk-text">{s.corrected_translation}</p>
                  <p className="text-xs font-sans text-desk-muted mt-0.5">
                    {s.canonical_ref} &middot; {s.created_at.slice(0, 10)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setContent(s.corrected_translation)}
                    className="text-xs font-sans text-vault-text underline hover:no-underline transition-all"
                  >
                    Use this
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(s.id)}
                    aria-label="Dismiss suggestion"
                    className="text-xs font-sans text-desk-muted hover:text-desk-text transition-colors"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form
        action={(fd) => {
          submitted.current = true;
          formAction(fd);
        }}
        className="space-y-3"
      >
        <input type="hidden" name="sourceLayerId" value={sourceLayerId} />

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
            Language
          </label>
          <p className="text-sm font-sans text-desk-text">
            {sourceLanguage ?? "inherited from record"}
          </p>
        </div>

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
            Content
          </label>
          <textarea
            name="content"
            required
            rows={6}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="border border-desk-border rounded-[2px] px-3 py-2 w-full text-sm font-sans text-desk-text"
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
          {isPending ? "Saving..." : "Save Correction"}
        </button>
      </form>
    </div>
  );
}
