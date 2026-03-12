"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setError(error.message);
      setPending(false);
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-vault-surface border border-vault-surface/50 rounded-[4px] p-8 w-full max-w-sm shadow-desk"
    >
      <div className="space-y-5">
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-vault-muted text-xs font-sans uppercase tracking-widest"
          >
            New Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="bg-vault-bg border border-vault-surface text-vault-text placeholder:text-vault-muted focus:border-historic focus:outline-none rounded-[2px] px-3 py-2 text-sm font-sans w-full"
          />
        </div>

        {error && (
          <p className="text-xs font-sans text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="bg-historic text-vault-text font-sans text-sm w-full py-2 rounded-[2px] hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {pending ? "Saving…" : "Set password"}
        </button>
      </div>
    </form>
  );
}
