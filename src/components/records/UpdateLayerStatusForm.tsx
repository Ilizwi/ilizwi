"use client";

import { useActionState } from "react";
import { updateLayerStatus } from "@/lib/actions/text-layers";
import type { LayerStatus } from "@/types";

export default function UpdateLayerStatusForm({
  layerId,
  currentStatus,
  canUpdate,
}: {
  layerId: string;
  currentStatus: LayerStatus;
  canUpdate: boolean;
}) {
  const [state, formAction, isPending] = useActionState(updateLayerStatus, { error: null });

  if (!canUpdate) return null;

  return (
    <form action={formAction}>
      <input type="hidden" name="layerId" value={layerId} />
      <div className="flex items-center gap-2">
        <select
          name="newStatus"
          defaultValue={currentStatus}
          className="text-sm font-sans border border-desk-border rounded-[2px] px-3 py-1.5 text-desk-muted bg-transparent"
        >
          <option value="raw">Raw</option>
          <option value="reviewed">Reviewed</option>
          <option value="approved">Approved</option>
          <option value="uncertain">Uncertain</option>
          <option value="needs_expert_review">Needs Expert Review</option>
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="px-3 py-1.5 text-sm font-sans border border-desk-border rounded-[2px] text-desk-muted hover:text-desk-text hover:border-desk-text transition-colors disabled:opacity-50"
        >
          Update Status
        </button>
      </div>
      {state.error && (
        <p className="mt-1 text-red-600 text-xs font-sans">{state.error}</p>
      )}
    </form>
  );
}
