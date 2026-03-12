import { signOut } from "@/lib/actions/auth";

export default function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="text-vault-muted text-xs font-sans hover:text-vault-text transition-colors"
      >
        Sign out
      </button>
    </form>
  );
}
