"use client";

import { useState } from "react";
import type { TextLayer, LayerType, LayerStatus } from "@/types";
import CreateLayerVersionForm from "./CreateLayerVersionForm";
import TranscriptionEditorForm from "./TranscriptionEditorForm";
import TranslationEditorForm from "./TranslationEditorForm";
import UpdateLayerStatusForm from "./UpdateLayerStatusForm";
import { PROVIDER_DISPLAY_LABELS } from "@/lib/translation/translation-constants";

const LAYER_TYPE_LABELS: Record<LayerType, string> = {
  source_ocr: "Source OCR",
  source_transcription: "Source Transcription",
  corrected_transcription: "Corrected Transcription",
  normalized_orthography: "Normalized Orthography",
  machine_translation: "Machine Translation",
  corrected_translation: "Corrected Translation",
};

const LAYER_STATUS_STYLES: Record<LayerStatus, string> = {
  raw: "bg-vault-bg/10 text-desk-muted",
  reviewed: "bg-blue-50 text-blue-700",
  approved: "bg-green-50 text-green-700",
  uncertain: "bg-amber-50 text-amber-700",
  needs_expert_review: "bg-red-50 text-red-700",
};

export default function TextLayerCard({
  layer,
  isSuperseded,
  canAddLayer,
  canCorrectTranslation,
  recordId,
}: {
  layer: TextLayer;
  isSuperseded: boolean;
  canAddLayer: boolean;
  canCorrectTranslation: boolean;
  recordId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showVersionForm, setShowVersionForm] = useState(false);
  const [showTranscribeForm, setShowTranscribeForm] = useState(false);
  const [showTranslationForm, setShowTranslationForm] = useState(false);

  return (
    <div className={`border border-desk-border rounded-[2px] p-4 ${isSuperseded ? "opacity-60" : ""}`}>
      {/* Header row */}
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] bg-vault-bg/10 text-desk-text">
          {LAYER_TYPE_LABELS[layer.layer_type]}
        </span>

        <span className={`inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] ${LAYER_STATUS_STYLES[layer.status]}`}>
          {layer.status.replace(/_/g, " ")}
        </span>

        {isSuperseded && (
          <span className="inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] bg-desk-border text-desk-muted">
            Superseded
          </span>
        )}
      </div>

      {/* Metadata row */}
      <div className="flex gap-4 text-xs font-sans text-desk-muted mb-3">
        <span>Source: {layer.source_method.replace(/_/g, " ")}</span>
        <span>Language: {layer.language ?? "inherited from record"}</span>
        <span>Added: {new Date(layer.created_at).toLocaleDateString()}</span>
        {layer.translation_provider && (
          <span>Provider: {PROVIDER_DISPLAY_LABELS[layer.translation_provider] ?? layer.translation_provider}</span>
        )}
      </div>

      {/* Supersedes reference */}
      {layer.supersedes_layer_id && (
        <p className="text-xs font-sans text-desk-muted mb-2 italic">
          Supersedes a previous version
        </p>
      )}

      {/* Content section */}
      <div className="mt-2">
        <pre className="whitespace-pre-wrap text-sm font-sans text-desk-text bg-desk-bg rounded-[2px] p-3 border border-desk-border">
          {expanded
            ? layer.content
            : layer.content.length > 300
            ? layer.content.slice(0, 300) + "..."
            : layer.content}
        </pre>
        {layer.content.length > 300 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 text-xs font-sans text-desk-muted underline underline-offset-2 hover:text-desk-text transition-colors"
          >
            {expanded ? "Show less" : "Show full content"}
          </button>
        )}
      </div>

      {/* Status update — shown on all active layers if canAddLayer */}
      {canAddLayer && !isSuperseded && (
        <div className="mt-3">
          <UpdateLayerStatusForm
            layerId={layer.id}
            currentStatus={layer.status}
            canUpdate={true}
          />
        </div>
      )}

      {/* Action forms — Edit/Transcribe, Correct Translation, Create New Version */}
      {(canAddLayer || canCorrectTranslation) && !isSuperseded && (
        <div className="mt-4 space-y-2">
          {showTranslationForm ? (
            <TranslationEditorForm
              sourceContent={layer.content}
              sourceLanguage={layer.language}
              sourceLayerId={layer.id}
              onClose={() => setShowTranslationForm(false)}
            />
          ) : showTranscribeForm ? (
            <TranscriptionEditorForm
              recordId={recordId}
              sourceContent={layer.content}
              sourceLanguage={layer.language}
              onClose={() => setShowTranscribeForm(false)}
            />
          ) : showVersionForm ? (
            <CreateLayerVersionForm
              recordId={recordId}
              supersedesLayerId={layer.id}
              defaultLayerType={layer.layer_type}
              defaultLanguage={layer.language}
              onClose={() => setShowVersionForm(false)}
            />
          ) : (
            <div className="flex gap-2 flex-wrap">
              {canAddLayer && (layer.layer_type === "source_ocr" || layer.layer_type === "source_transcription") && (
                <button
                  onClick={() => { setShowTranscribeForm(true); setShowVersionForm(false); setShowTranslationForm(false); }}
                  className="text-xs font-sans px-3 py-1.5 border border-desk-border rounded-[2px] text-desk-muted hover:text-desk-text hover:border-desk-text transition-colors"
                >
                  Edit / Transcribe
                </button>
              )}
              {layer.layer_type === "machine_translation" && canCorrectTranslation && (
                <button
                  onClick={() => { setShowTranslationForm(true); setShowTranscribeForm(false); setShowVersionForm(false); }}
                  className="text-xs font-sans px-3 py-1.5 border border-desk-border rounded-[2px] text-desk-muted hover:text-desk-text hover:border-desk-text transition-colors"
                >
                  Correct Translation
                </button>
              )}
              {canAddLayer && (
                <button
                  onClick={() => { setShowVersionForm(true); setShowTranscribeForm(false); setShowTranslationForm(false); }}
                  className="text-xs font-sans px-3 py-1.5 border border-desk-border rounded-[2px] text-desk-muted hover:text-desk-text hover:border-desk-text transition-colors"
                >
                  Create New Version
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
