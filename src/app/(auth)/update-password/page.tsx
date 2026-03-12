import UpdatePasswordForm from "@/components/auth/UpdatePasswordForm";

export default function UpdatePasswordPage() {
  return (
    <main className="min-h-screen bg-vault-bg flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="font-serif text-4xl text-vault-text tracking-tight mb-2">
          ILIZWI
        </h1>
        <p className="text-vault-muted text-sm font-sans">
          Set your password
        </p>
      </div>
      <UpdatePasswordForm />
    </main>
  );
}
