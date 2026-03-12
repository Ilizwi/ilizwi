"use client";

import { useActionState } from "react";
import { updateMemberRole } from "@/lib/actions/projects";
import type { ProjectRole } from "@/types";

const ROLE_OPTIONS: ProjectRole[] = [
  "project_admin",
  "researcher",
  "translator",
  "reviewer",
];

const initialState = { error: null as string | null };

export default function MemberRoleForm({
  membershipId,
  projectId,
  currentRole,
}: {
  membershipId: string;
  projectId: string;
  currentRole: string;
}) {
  const [state, formAction] = useActionState(updateMemberRole, initialState);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="membershipId" value={membershipId} />
      <input type="hidden" name="projectId" value={projectId} />
      <select
        name="newRole"
        defaultValue={currentRole}
        className="text-sm bg-transparent border border-desk-border rounded-[2px] px-2 py-1 text-desk-text"
        onChange={(e) => {
          const form = e.currentTarget.closest("form");
          if (form) form.requestSubmit();
        }}
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r} value={r}>
            {r.replace("_", " ")}
          </option>
        ))}
      </select>
      {state.error && (
        <span className="text-red-600 text-xs ml-2">{state.error}</span>
      )}
    </form>
  );
}
