export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-desk-bg">
      {/* Sidebar — always dark per ILIZWI rules */}
      <aside className="w-64 bg-vault-bg border-r border-vault-surface flex-shrink-0">
        <div className="p-6">
          <span className="font-serif text-lg text-vault-text tracking-tight">
            ILIZWI
          </span>
        </div>
      </aside>

      {/* Main workspace */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
