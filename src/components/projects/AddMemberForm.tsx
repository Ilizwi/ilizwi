"use client";

import { useActionState } from "react";
import { addMember } from "@/lib/actions/projects";
import type { ProjectRole } from "@/types";

const ROLE_OPTIONS: ProjectRole[] = [
  "project_admin",
  "researcher",
  "translator",
  "reviewer",
];

const initialState = { error: null as string | null };

export default function AddMemberForm({ projectId }: { projectId: string }) {
  const [state, formAction, isPending] = useActionState(
    addMember,
    initialState
  );

  return (
    <form action={formAction} className="flex items-end gap-3">
      <input type="hidden" name="projectId" value={projectId} />

      <div className="flex-1">
        <label
          htmlFor="email"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="user@example.com"
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        />
      </div>

      <div>
        <label
          htmlFor="role"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Role
        </label>
        <select
          id="role"
          name="role"
          defaultValue="researcher"
          className="px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        >
          {ROLE_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add"}
      </button>

      {state.error && (
        <p className="text-red-600 text-sm font-sans self-center">
          {state.error}
        </p>
      )}
    </form>
  );
}
