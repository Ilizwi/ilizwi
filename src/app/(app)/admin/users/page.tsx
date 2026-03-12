import { requireSuperAdmin } from "@/lib/auth/role-guard";
import { promoteUser } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types";

export default async function AdminUsersPage() {
  await requireSuperAdmin();

  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  const users = (profiles ?? []) as Profile[];

  return (
    <div className="p-8">
      <h1 className="font-serif text-3xl text-desk-text tracking-tight mb-6">
        Users
      </h1>

      <div className="bg-desk-sheet border border-desk-border rounded-[4px] overflow-hidden">
        <table className="w-full text-sm font-sans">
          <thead>
            <tr className="border-b border-desk-border">
              <th className="text-left px-4 py-3 text-desk-text/50 text-[10px] uppercase tracking-widest font-normal">
                Email
              </th>
              <th className="text-left px-4 py-3 text-desk-text/50 text-[10px] uppercase tracking-widest font-normal">
                Display Name
              </th>
              <th className="text-left px-4 py-3 text-desk-text/50 text-[10px] uppercase tracking-widest font-normal">
                Role
              </th>
              <th className="text-left px-4 py-3 text-desk-text/50 text-[10px] uppercase tracking-widest font-normal">
                Joined
              </th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-desk-border last:border-0"
              >
                <td className="px-4 py-3 text-desk-text">{user.email}</td>
                <td className="px-4 py-3 text-desk-text/70">
                  {user.display_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  {user.global_role === "super_admin" ? (
                    <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-widest font-sans bg-historic/20 text-historic rounded-[2px]">
                      Super Admin
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-widest font-sans bg-vault-surface text-vault-muted rounded-[2px]">
                      User
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-desk-text/50 text-xs">
                  {new Date(user.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td className="px-4 py-3">
                  {user.global_role === "user" && (
                    <form action={promoteUser}>
                      <input
                        type="hidden"
                        name="targetUserId"
                        value={user.id}
                      />
                      <button
                        type="submit"
                        className="text-xs font-sans text-vault-muted hover:text-vault-text transition-colors"
                      >
                        Promote to Admin
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-desk-text/40 text-sm font-sans"
                >
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
