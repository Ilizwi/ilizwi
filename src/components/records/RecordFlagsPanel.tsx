import type { RecordFlag, TextLayer } from "@/types";
import Link from "next/link";

const LAYER_TYPE_LABELS: Record<string, string> = {
  source_ocr: "Source OCR",
  source_transcription: "Source Transcription",
  corrected_transcription: "Corrected Transcription",
  normalized_orthography: "Normalized Orthography",
  machine_translation: "Machine Translation",
  corrected_translation: "Corrected Translation",
};

const FLAG_TYPE_BADGES: Record<string, string> = {
  illegible: "bg-vault-bg/10 text-desk-muted",
  uncertain: "bg-amber-50 text-amber-700",
  disputed: "bg-red-50 text-red-700",
  needs_expert_review: "bg-blue-50 text-blue-700",
};

const FLAG_TYPE_LABELS: Record<string, string> = {
  illegible: "Illegible",
  uncertain: "Uncertain",
  disputed: "Disputed",
  needs_expert_review: "Needs Expert Review",
};

type Props = {
  flags: RecordFlag[];
  textLayers: TextLayer[];
  projectId: string;
  recordId: string;
  currentUserId: string;
  canEditAll: boolean;
  editFlagId?: string;
  addAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
  updateNoteAction: (formData: FormData) => Promise<void>;
  addError?: string | null;
  removeError?: string | null;
  updateNoteError?: string | null;
};

export default function RecordFlagsPanel({
  flags,
  textLayers,
  projectId,
  recordId,
  currentUserId,
  canEditAll,
  editFlagId,
  addAction,
  removeAction,
  updateNoteAction,
  addError,
  removeError,
  updateNoteError,
}: Props) {
  const layerMap = new Map(textLayers.map((l) => [l.id, l]));

  return (
    <div className="space-y-6">
      {/* Flag list */}
      {flags.length === 0 ? (
        <p className="text-desk-muted text-sm font-sans">No flags set.</p>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => {
            const isEditingNote = editFlagId === flag.id;
            const canRemove =
              canEditAll || flag.created_by === currentUserId;
            const linkedLayer = flag.text_layer_id
              ? layerMap.get(flag.text_layer_id)
              : null;
            const authorName =
              flag.profiles?.display_name ||
              flag.profiles?.email ||
              "Unknown";

            return (
              <div
                key={flag.id}
                className="border-l-2 border-amber-400 pl-4 py-2"
              >
                {/* Header row */}
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span
                    className={`inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] ${FLAG_TYPE_BADGES[flag.flag_type] ?? "bg-vault-bg/10 text-desk-muted"}`}
                  >
                    {FLAG_TYPE_LABELS[flag.flag_type] ?? flag.flag_type}
                  </span>
                  <span className="text-xs font-sans text-desk-muted">
                    {authorName}
                  </span>
                  <span className="text-xs font-sans text-desk-muted">
                    {new Date(flag.created_at).toLocaleDateString()}
                  </span>
                  {linkedLayer ? (
                    <span className="text-xs font-sans text-desk-muted italic">
                      &rarr;{" "}
                      {LAYER_TYPE_LABELS[linkedLayer.layer_type] ??
                        linkedLayer.layer_type}
                    </span>
                  ) : (
                    <span className="text-xs font-sans text-desk-muted italic">
                      record-level
                    </span>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    {canRemove && !isEditingNote && (
                      <Link
                        href={`/projects/${projectId}/records/${recordId}?editFlag=${flag.id}`}
                        className="text-xs font-sans text-desk-muted underline underline-offset-2"
                      >
                        Edit note
                      </Link>
                    )}
                    {canRemove && (
                      <form action={removeAction}>
                        <input type="hidden" name="flag_id" value={flag.id} />
                        <button
                          type="submit"
                          className="text-xs font-sans text-red-600 underline underline-offset-2"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Optional note */}
                {!isEditingNote && flag.note && (
                  <p className="text-sm font-sans text-desk-text mt-1">
                    {flag.note}
                  </p>
                )}

                {/* Edit note inline form */}
                {isEditingNote && (
                  <div className="mt-2">
                    {updateNoteError && (
                      <div className="mb-2 px-3 py-2 border border-red-200 bg-red-50 rounded-[2px] text-xs font-sans text-red-700">
                        {updateNoteError}
                      </div>
                    )}
                    <form action={updateNoteAction} className="space-y-2">
                      <input type="hidden" name="flag_id" value={flag.id} />
                      <textarea
                        name="note"
                        defaultValue={flag.note ?? ""}
                        rows={2}
                        placeholder="Optional note…"
                        className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text"
                      />
                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          className="px-4 py-2 text-sm font-sans bg-desk-text text-white rounded-[2px]"
                        >
                          Save Note
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

      {removeError && (
        <div className="px-3 py-2 border border-red-200 bg-red-50 rounded-[2px] text-xs font-sans text-red-700">
          {removeError}
        </div>
      )}

      {/* Add flag form — available to all project members */}
      <div className="border border-desk-border rounded-[2px] p-4 bg-white">
        <h3 className="font-sans text-xs uppercase tracking-widest text-desk-muted mb-3">
          Add Flag
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
              Flag Type
            </label>
            <select
              name="flag_type"
              required
              className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text bg-white"
            >
              <option value="">Select type</option>
              <option value="illegible">Illegible</option>
              <option value="uncertain">Uncertain</option>
              <option value="disputed">Disputed</option>
              <option value="needs_expert_review">Needs Expert Review</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
              Target
            </label>
            <select
              name="text_layer_id"
              className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text bg-white"
            >
              <option value="">Record-level</option>
              {textLayers.map((layer) => (
                <option key={layer.id} value={layer.id}>
                  {LAYER_TYPE_LABELS[layer.layer_type] ?? layer.layer_type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-sans text-desk-muted uppercase tracking-widest mb-1">
              Note (optional)
            </label>
            <textarea
              name="note"
              rows={2}
              placeholder="Describe the issue…"
              className="w-full border border-desk-border rounded-[2px] px-3 py-2 text-sm font-sans text-desk-text"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-2 text-sm font-sans bg-desk-text text-white rounded-[2px]"
          >
            Add Flag
          </button>
        </form>
      </div>
    </div>
  );
}
