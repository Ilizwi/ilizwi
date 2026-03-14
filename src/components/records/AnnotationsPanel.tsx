import Link from "next/link";
import type { Annotation, TextLayer } from "@/types";

const LAYER_TYPE_LABELS: Record<string, string> = {
  source_ocr: "Source OCR",
  source_transcription: "Source Transcription",
  corrected_transcription: "Corrected Transcription",
  normalized_orthography: "Normalized Orthography",
  machine_translation: "Machine Translation",
  corrected_translation: "Corrected Translation",
};

const ANNOTATION_TYPE_BADGES: Record<string, string> = {
  editorial_note: "bg-vault-bg/10 text-desk-muted",
  context_note: "bg-blue-50 text-blue-700",
  term_note: "bg-amber-50 text-amber-700",
  translation_note: "bg-green-50 text-green-700",
  dispute_note: "bg-red-50 text-red-700",
};

type Props = {
  annotations: Annotation[];
  textLayers: TextLayer[];
  projectId: string;
  recordId: string;
  currentUserId: string;
  canEditAll: boolean;
  editAnnotationId: string | undefined;
  addAction: (formData: FormData) => Promise<void>;
  editAction: (formData: FormData) => Promise<void>;
  addError?: string | null;
  editError?: string | null;
};

export default function AnnotationsPanel({
  annotations,
  textLayers,
  projectId,
  recordId,
  currentUserId,
  canEditAll,
  editAnnotationId,
  addAction,
  editAction,
  addError,
  editError,
}: Props) {
  const layerMap = new Map(textLayers.map((l) => [l.id, l]));

  return (
    <div className="space-y-6">
      {/* List */}
      {annotations.length === 0 ? (
        <p className="text-desk-muted text-sm font-sans">No annotations yet.</p>
      ) : (
        <div className="space-y-3">
          {annotations.map((annotation) => {
            const isEditing = editAnnotationId === annotation.id;
            const canEdit =
              canEditAll || annotation.created_by === currentUserId;
            const linkedLayer = annotation.text_layer_id
              ? layerMap.get(annotation.text_layer_id)
              : null;
            const authorName =
              annotation.profiles?.display_name ||
              annotation.profiles?.email ||
              "Unknown";

            return (
              <div
                key={annotation.id}
                className="border-l-2 border-historic pl-4 py-2"
              >
                {/* Header row */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className={`inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] ${ANNOTATION_TYPE_BADGES[annotation.annotation_type] ?? "bg-vault-bg/10 text-desk-muted"}`}
                  >
                    {annotation.annotation_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs font-sans text-desk-muted">
                    {authorName}
                  </span>
                  <span className="text-xs font-sans text-desk-muted">
                    {new Date(annotation.created_at).toLocaleDateString()}
                  </span>
                  {linkedLayer && (
                    <span className="text-xs font-sans text-desk-muted italic">
                      &rarr;{" "}
                      {LAYER_TYPE_LABELS[linkedLayer.layer_type] ??
                        linkedLayer.layer_type}
                    </span>
                  )}
                  {canEdit && !isEditing && (
                    <Link
                      href={`/projects/${projectId}/records/${recordId}?editAnnotation=${annotation.id}`}
                      className="text-xs font-sans text-desk-muted underline underline-offset-2 ml-auto"
                    >
                      Edit
                    </Link>
                  )}
                </div>

                {/* Content */}
                {!isEditing && (
                  <p className="text-sm font-sans text-desk-text">
                    {annotation.content}
                  </p>
                )}

                {/* Edit form — inline */}
                {isEditing && (
                  <div className="mt-2">
                    {editError && (
                      <div className="mb-2 px-3 py-2 border border-red-200 bg-red-50 rounded-[2px] text-xs font-sans text-red-700">
                        {editError}
                      </div>
                    )}
                    <form action={editAction} className="space-y-3">
                      <input
                        type="hidden"
                        name="annotation_id"
                        value={annotation.id}
                      />
                      <textarea
                        name="content"
                        defaultValue={annotation.content}
                        rows={3}
                        required
                        className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          className="px-4 py-2 text-sm font-sans bg-desk-text text-white rounded-[2px]"
                        >
                          Save
                        </button>
                        <Link
                          href={`/projects/${projectId}/records/${recordId}`}
                          className="text-sm font-sans text-desk-muted underline underline-offset-2"
                        >
                          Cancel
                        </Link>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      <div className="border border-desk-border rounded-[2px] p-4 bg-white">
        <h3 className="font-sans text-xs uppercase tracking-widest text-desk-muted mb-3">
          Add Annotation
        </h3>
        {addError && (
          <div className="mb-3 px-3 py-2 border border-red-200 bg-red-50 rounded-[2px] text-xs font-sans text-red-700">
            {addError}
          </div>
        )}
        <form action={addAction} className="space-y-3">
          <input type="hidden" name="record_id" value={recordId} />

          <div>
            <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
              Type
            </label>
            <select
              name="annotation_type"
              required
              className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text bg-white"
            >
              <option value="">Select type</option>
              <option value="editorial_note">Editorial Note</option>
              <option value="context_note">Context Note</option>
              <option value="term_note">Term Note</option>
              <option value="translation_note">Translation Note</option>
              <option value="dispute_note">Dispute Note</option>
            </select>
          </div>

          {textLayers.length > 0 && (
            <div>
              <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
                Link to Text Layer (optional)
              </label>
              <select
                name="text_layer_id"
                className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text bg-white"
              >
                <option value="">None</option>
                {textLayers.map((layer) => (
                  <option key={layer.id} value={layer.id}>
                    {LAYER_TYPE_LABELS[layer.layer_type] ?? layer.layer_type}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
              Content
            </label>
            <textarea
              name="content"
              required
              rows={3}
              className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 text-sm font-sans bg-desk-text text-white rounded-[2px]"
          >
            Add Annotation
          </button>
        </form>
      </div>
    </div>
  );
}
