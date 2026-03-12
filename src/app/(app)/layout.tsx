import Link from "next/link";
import { requireAuth } from "@/lib/auth/role-guard";
import SignOutButton from "@/components/app/SignOutButton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireAuth();

  return (
    <div className="flex min-h-screen bg-desk-bg">
      {/* Sidebar — always dark per ILIZWI rules */}
      <aside className="w-64 bg-vault-bg border-r border-vault-surface flex-shrink-0 flex flex-col">
        {/* Brand */}
        <div className="p-6 border-b border-vault-surface">
          <span className="font-serif text-lg text-vault-text tracking-tight">
            ILIZWI
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          <Link
            href="/dashboard"
            className="block px-3 py-2 text-sm font-sans text-vault-muted hover:text-vault-text hover:bg-vault-surface/50 rounded-[2px] transition-colors"
          >
            Dashboard
          </Link>
          {profile.global_role === "super_admin" && (
            <Link
              href="/admin/users"
              className="block px-3 py-2 text-sm font-sans text-vault-muted hover:text-vault-text hover:bg-vault-surface/50 rounded-[2px] transition-colors"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-vault-surface space-y-1">
          <p className="text-vault-text text-xs font-sans truncate">
            {profile.display_name ?? profile.email}
          </p>
          <p className="text-vault-muted text-[10px] font-sans uppercase tracking-widest">
            {profile.global_role === "super_admin" ? "Super Admin" : "User"}
          </p>
          <SignOutButton />
        </div>
      </aside>

      {/* Main workspace */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
