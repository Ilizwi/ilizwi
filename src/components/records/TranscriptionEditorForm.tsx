"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTextLayer } from "@/lib/actions/text-layers";

export default function TranscriptionEditorForm({
  recordId,
  sourceContent,
  sourceLanguage,
  onClose,
}: {
  recordId: string;
  sourceContent: string;
  sourceLanguage: string | null;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(addTextLayer, { error: null });
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && state.error === null) {
      onClose();
    }
  }, [state, onClose]);

  return (
    <div className="border border-desk-border rounded-[2px] p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-serif text-sm text-desk-text">Edit / Transcribe</h4>
        <button type="button" onClick={onClose} className="text-xs font-sans text-desk-muted hover:text-desk-text transition-colors">Cancel</button>
      </div>

      <form action={(fd) => { submitted.current = true; formAction(fd); }} className="space-y-3">
        <input type="hidden" name="recordId" value={recordId} />
        <input type="hidden" name="layerType" value="corrected_transcription" />
        <input type="hidden" name="sourceMethod" value="manual_entry" />

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">Initial Status</label>
          <select name="status" defaultValue="raw"
            className="border border-desk-border rounded-[2px] px-3 py-2 w-full text-sm font-sans text-desk-text">
            <option value="raw">Raw</option>
            <option value="reviewed">Reviewed</option>
            <option value="needs_expert_review">Needs Expert Review</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">Content</label>
          <textarea name="content" required rows={6} defaultValue={sourceContent}
            className="border border-desk-border rounded-[2px] px-3 py-2 w-full text-sm font-sans text-desk-text" />
        </div>

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">Language</label>
          <input type="text" name="language" defaultValue={sourceLanguage ?? ""} placeholder="Leave blank to inherit from record"
            className="border border-desk-border rounded-[2px] px-3 py-2 w-full text-sm font-sans text-desk-text" />
        </div>

        {state.error && <p className="text-red-600 text-sm font-sans">{state.error}</p>}

        <button type="submit" disabled={isPending}
          className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors disabled:opacity-50">
          {isPending ? "Saving…" : "Save Transcription"}
        </button>
      </form>
    </div>
  );
}
