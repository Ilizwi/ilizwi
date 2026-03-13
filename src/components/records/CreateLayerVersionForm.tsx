"use client";

import { useActionState, useEffect, useRef } from "react";
import { addTextLayer } from "@/lib/actions/text-layers";
import type { LayerType } from "@/types";

const LAYER_TYPE_LABELS: Record<LayerType, string> = {
  source_ocr: "Source OCR",
  source_transcription: "Source Transcription",
  corrected_transcription: "Corrected Transcription",
  normalized_orthography: "Normalized Orthography",
  machine_translation: "Machine Translation",
  corrected_translation: "Corrected Translation",
};

export default function CreateLayerVersionForm({
  recordId,
  supersedesLayerId,
  defaultLayerType,
  defaultLanguage,
  onClose,
}: {
  recordId: string;
  supersedesLayerId: string;
  defaultLayerType: LayerType;
  defaultLanguage: string | null;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(addTextLayer, { error: null });
  const submitted = useRef(false);

  useEffect(() => {
    if (submitted.current && state.error === null) {
      onClose();
    }
  }, [state, onClose]);

  return (
    <div className="border border-desk-border rounded-[2px] p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-serif text-sm text-desk-text">Create New Version</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-sans text-desk-muted hover:text-desk-text transition-colors"
        >
          Cancel
        </button>
      </div>

      <form
        action={(fd) => {
          submitted.current = true;
          formAction(fd);
        }}
        className="space-y-3"
      >
        <input type="hidden" name="recordId" value={recordId} />
        <input type="hidden" name="supersedes_layer_id" value={supersedesLayerId} />
        <input type="hidden" name="layerType" value={defaultLayerType} />
        <input type="hidden" name="sourceMethod" value="manual_entry" />

        <div>
          <span className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
            Layer Type
          </span>
          <span className="text-sm font-sans text-desk-text">
            {LAYER_TYPE_LABELS[defaultLayerType]}
          </span>
        </div>

        <div>
          <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
            Content
          </label>
          <textarea
            name="content"
            required
            rows={6}
            placeholder="Enter corrected content..."
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
            defaultValue={defaultLanguage ?? ""}
            placeholder="Leave blank to inherit from record"
            className="border border-desk-border rounded-[2px] px-3 py-2 w-full text-sm font-sans text-desk-text"
          />
        </div>

        {state.error && (
          <p className="text-red-600 text-sm font-sans">{state.error}</p>
        )}

        <button
          type="submit"
          className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors"
        >
          Save New Version
        </button>
      </form>
    </div>
  );
}
