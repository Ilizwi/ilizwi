"use client";

import { useActionState } from "react";
import { addTextLayer } from "@/lib/actions/text-layers";

export default function AddTextLayerForm({
  recordId,
  projectId,
}: {
  recordId: string;
  projectId: string;
}) {
  const [state, formAction] = useActionState(addTextLayer, { error: null });

  return (
    <div className="mt-6">
      <h3 className="font-serif text-lg text-desk-text mb-4">Add Text Layer</h3>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="recordId" value={recordId} />
        <input type="hidden" name="projectId" value={projectId} />

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
            Layer Type
          </label>
          <select
            name="layerType"
            required
            className="border border-desk-border rounded-[2px] px-3 py-2 w-full text-sm font-sans text-desk-text bg-white"
          >
            <option value="source_ocr">Source OCR</option>
            <option value="source_transcription">Source Transcription</option>
            <option value="corrected_transcription">Corrected Transcription</option>
            <option value="normalized_orthography">Normalized Orthography</option>
            <option value="machine_translation">Machine Translation</option>
            <option value="corrected_translation">Corrected Translation</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
            Content
          </label>
          <textarea
            name="content"
            required
            rows={5}
            placeholder="Enter text content..."
            className="border border-desk-border rounded-[2px] px-3 py-2 w-full text-sm font-sans text-desk-text"
          />
        </div>

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
            Language
          </label>
          <input
            type="text"
            name="language"
            placeholder="Leave blank to inherit from record"
            className="border border-desk-border rounded-[2px] px-3 py-2 w-full text-sm font-sans text-desk-text"
          />
        </div>

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
            Source Method
          </label>
          <select
            name="sourceMethod"
            className="border border-desk-border rounded-[2px] px-3 py-2 w-full text-sm font-sans text-desk-text bg-white"
          >
            <option value="manual_entry">Manual Entry</option>
            <option value="api_import">API Import</option>
            <option value="ocr">OCR</option>
            <option value="file_extract">File Extract</option>
          </select>
        </div>

        {state.error && (
          <p className="text-red-600 text-sm font-sans">{state.error}</p>
        )}

        <button
          type="submit"
          className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors"
        >
          Add Layer
        </button>
      </form>
    </div>
  );
}
