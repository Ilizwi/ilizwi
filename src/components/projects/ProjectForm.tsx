"use client";

import { useActionState } from "react";
import { createProject } from "@/lib/actions/projects";

const initialState = { error: null as string | null };

export default function ProjectForm() {
  const [state, formAction, isPending] = useActionState(
    createProject,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Name
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={2}
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface"
        />
      </div>

      <div>
        <label
          htmlFor="description"
          className="block text-sm font-sans text-desk-text mb-1"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="w-full px-3 py-2 text-sm font-sans border border-desk-border rounded-[2px] bg-transparent text-desk-text focus:outline-none focus:border-vault-surface resize-none"
        />
      </div>

      {state.error && (
        <p className="text-red-600 text-sm font-sans">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create Project"}
      </button>
    </form>
  );
}
