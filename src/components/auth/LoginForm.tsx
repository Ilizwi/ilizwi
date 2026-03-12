"use client";

import { useActionState } from "react";
import { signIn } from "@/lib/actions/auth";

const initialState = { error: null as string | null };

export default function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initialState);

  return (
    <form
      action={action}
      className="bg-vault-surface border border-vault-surface/50 rounded-[4px] p-8 w-full max-w-sm shadow-desk"
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-vault-muted text-xs font-sans uppercase tracking-widest"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="bg-vault-bg border border-vault-surface text-vault-text placeholder:text-vault-muted focus:border-historic focus:outline-none rounded-[2px] px-3 py-2 text-sm font-sans w-full"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-vault-muted text-xs font-sans uppercase tracking-widest"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="bg-vault-bg border border-vault-surface text-vault-text placeholder:text-vault-muted focus:border-historic focus:outline-none rounded-[2px] px-3 py-2 text-sm font-sans w-full"
          />
        </div>

        {state.error && (
          <p className="text-xs font-sans text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-historic text-vault-text font-sans text-sm w-full py-2 rounded-[2px] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {pending ? "Signing in\u2026" : "Sign in"}
        </button>
      </div>
    </form>
  );
}
