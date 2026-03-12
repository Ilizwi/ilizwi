"use client";

import { useActionState } from "react";
import { removeMember } from "@/lib/actions/projects";

const initialState = { error: null as string | null };

export default function RemoveMemberForm({
  membershipId,
  projectId,
}: {
  membershipId: string;
  projectId: string;
}) {
  const [state, formAction, isPending] = useActionState(
    removeMember,
    initialState
  );

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="projectId" value={projectId} />
      <button
        type="submit"
        disabled={isPending}
        className="text-xs text-red-600 hover:text-red-800 font-sans transition-colors disabled:opacity-50"
      >
        {isPending ? "Removing..." : "Remove"}
      </button>
      {state.error && (
        <span className="text-red-600 text-xs ml-2">{state.error}</span>
      )}
    </form>
  );
}
