# F001 — Authentication and Role-Based Access

**Date:** 2026-03-12
**Branch:** `codex/f001-auth-role-access`
**Status:** Approved — implementing

---

## Context

First feature session for the Panashe Archival Research Platform (ILIZWI). The Next.js 15 app
is bootstrapped with Supabase SSR clients and middleware, but no working authentication yet.
F001 must pass before any other feature can be built on top of it.

The Supabase middleware auth guard is already correct. What's missing: a real login form,
a `profiles` table with `global_role`, server actions for sign in / sign out / promote user,
a role guard utility, and an admin users page.

---

## Acceptance Criteria → Step Mapping

| AC | Description | Covered by |
|----|-------------|-----------|
| AC1 | Sign in as initial super admin | Step 3 (signIn action) + Step 5 (LoginForm) + Step 6 (login page) |
| AC2 | View protected app area inaccessible to unauthenticated users | Step 4 (requireAuth) + middleware (already correct) |
| AC3 | Create or promote another user to admin from admin UI | Step 3 (promoteUser action) + Step 9 (admin users page) — **requires a second user to already exist in `auth.users`; see prerequisite below** |
| AC4 | Sign in as non-admin user, confirm admin actions are hidden/blocked | Step 7 (conditional nav in layout) + Step 4 (requireSuperAdmin blocks /admin/users) — **test this BEFORE promoting the second user** |
| AC5 | Sign out and confirm protected routes redirect to /login | Step 3 (signOut action) + Step 7 (SignOutButton) |

**AC3 prerequisite:** The second user must already exist in Supabase Auth before testing promotion.
Create them manually in the Supabase dashboard (Authentication → Users → Add User) or by
signing up via the login page if a public registration path is added later. F001 does not
include a create-user UI; it is promote-only.

**AC4 test order:** Sign in as the second user (non-admin) first. Verify admin nav is hidden and
`/admin/users` redirects to `/dashboard`. Then sign back in as super_admin and promote them.

**Confirmed:** `/dashboard` exists at `src/app/(app)/dashboard/page.tsx` and is the protected
landing route used by all redirects.

---

## Pre-Implementation: Supabase SQL Migration

Run in the Supabase SQL editor before writing any code.

```sql
-- SECURITY DEFINER helper to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND global_role = 'super_admin'
  );
$$;

-- profiles table
CREATE TABLE public.profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  display_name TEXT,
  global_role  TEXT NOT NULL DEFAULT 'user'
                 CHECK (global_role IN ('super_admin', 'user')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on new auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, global_role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'user'
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS using SECURITY DEFINER helper to prevent recursion
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "super_admin read all"
  ON public.profiles FOR SELECT
  USING (public.is_super_admin());

CREATE POLICY "super_admin update"
  ON public.profiles FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
```

**After migration:** manually set the first super admin:
```sql
UPDATE public.profiles SET global_role = 'super_admin' WHERE email = 'your-admin@example.com';
```

---

## Files to Create or Modify

| # | File | Action |
|---|------|--------|
| 1 | `src/types/index.ts` | Modify — add `Profile` type |
| 2 | `src/lib/actions/auth.ts` | Create — `signIn`, `signOut`, `promoteUser` server actions |
| 3 | `src/lib/auth/role-guard.ts` | Create — `requireAuth()`, `requireSuperAdmin()` utilities |
| 4 | `src/components/auth/LoginForm.tsx` | Create — Client Component form |
| 5 | `src/app/(auth)/login/page.tsx` | Replace — import LoginForm into Vault shell |
| 6 | `src/components/app/SignOutButton.tsx` | Create — Server Component sign-out form button |
| 7 | `src/app/(app)/layout.tsx` | Modify — fetch profile, conditional admin nav, sign-out button |
| 8 | `src/app/(app)/admin/users/page.tsx` | Create — admin user list + promote action |
| — | `src/middleware.ts` | No change — already correct |

---

## Implementation Steps

### 1. Add `Profile` type to `src/types/index.ts`

```ts
export type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  global_role: GlobalRole;
  created_at: string;
  updated_at: string;
};
```

### 2. Create `src/lib/actions/auth.ts`

`"use server"` file with three actions:

- **`signIn(formData)`** — `supabase.auth.signInWithPassword({ email, password })`.
  Return `{ error: string }` on failure. On success, `redirect("/dashboard")`.

- **`signOut()`** — `supabase.auth.signOut()`, then `redirect("/login")`.

- **`promoteUser(formData)`** — extract `targetUserId` from formData; validate it is a
  non-empty UUID string before querying; verify caller is `super_admin` (fetch own profile);
  `UPDATE profiles SET global_role = 'super_admin' WHERE id = targetUserId`; handle
  missing/invalid target by returning `{ error }` rather than throwing; call
  `revalidatePath("/admin/users")` on success.

All three use `createClient()` from `src/lib/supabase/server.ts`.

### 3. Create `src/lib/auth/role-guard.ts`

Two async server utilities called at the top of async Server Components:

- **`requireAuth()`** — `supabase.auth.getUser()`; `redirect("/login")` if no user.
  Fetch profile row. If profile is null (trigger failure or migration gap), log a warning
  to `console.error` with the user id for diagnostics, then `redirect("/login")` — do not
  silently proceed with a null profile. Return `Profile`.

- **`requireSuperAdmin()`** — calls `requireAuth()`; `redirect("/dashboard")` if
  `global_role !== "super_admin"`; returns `Profile`.

### 4. Create `src/components/auth/LoginForm.tsx`

`"use client"` component. Uses `useActionState` (React 19) bound to the `signIn` server action.
Renders email + password inputs and a submit button. Displays `state.error` inline on failure.

ILIZWI styling:
- Container: `bg-vault-surface border border-vault-surface/50 rounded-[4px] p-8 w-full max-w-sm shadow-desk`
- Inputs: `bg-vault-bg border border-vault-surface text-vault-text placeholder:text-vault-muted focus:border-historic focus:outline-none rounded-[2px] px-3 py-2 text-sm font-sans w-full`
- Labels: `text-vault-muted text-xs font-sans uppercase tracking-widest`
- Submit: `bg-historic text-vault-text font-sans text-sm w-full py-2 rounded-[2px] hover:opacity-90 transition-opacity`

### 5. Replace `src/app/(auth)/login/page.tsx`

Keep Vault dark shell (`min-h-screen bg-vault-bg flex items-center justify-center`).
Add ILIZWI brand header (serif "ILIZWI", muted subtitle). Import and render `<LoginForm />`.

### 6. Create `src/components/app/SignOutButton.tsx`

**Server Component** (no `"use client"` needed — wraps a native `<form>` with a server
action, which works without JS). Renders a `<form action={signOut}>` with a `<button>`.
Styled: `text-vault-muted text-xs font-sans hover:text-vault-text transition-colors`.

### 7. Modify `src/app/(app)/layout.tsx`

- Call `requireAuth()` at the top — defense in depth beyond middleware.
- Show `profile.display_name` and role label in sidebar footer.
- Sidebar nav: "Dashboard" link always visible; "Admin" link (`href="/admin/users"`) only
  when `profile.global_role === "super_admin"` (server-rendered conditional, no JS).
- Sidebar footer: display name, role label, `<SignOutButton />`.

### 8. Create `src/app/(app)/admin/users/page.tsx`

- Call `requireSuperAdmin()` at top — non-admins redirected to `/dashboard`.
- Fetch all profiles: `SELECT * FROM profiles ORDER BY created_at ASC`.
- Render table: email, display_name, global_role badge, created_at.
- For each `global_role === "user"` row: promote form with hidden `targetUserId` input.
- ILIZWI desk styling: `font-serif` heading, `bg-desk-sheet border border-desk-border rounded-[4px]`
  table, small-caps column headers, role badges.

---

## Implementation Order

Execute in this sequence (each step compiles before next builds on it):

1. SQL migration + manually set super admin ← manual step, done before code
2. `src/types/index.ts` — add Profile type
3. `src/lib/actions/auth.ts` — all three actions (with promoteUser validation)
4. `src/lib/auth/role-guard.ts` — both guards (with null-profile diagnostic logging)
5. `src/components/auth/LoginForm.tsx`
6. `src/app/(auth)/login/page.tsx` — replace
7. `src/components/app/SignOutButton.tsx` — Server Component
8. `src/app/(app)/layout.tsx` — modify
9. `src/app/(app)/admin/users/page.tsx` — create

Steps 2–4 are independent of steps 5–7 and can be parallelized.
Steps 8–9 depend on steps 3, 4, and 7 completing first.

---

## Verification

```bash
npm run typecheck && npm run build
```

Then test each AC manually:

1. Navigate to `/dashboard` when logged out → lands at `/login` ✓
2. Sign in with super admin credentials → lands at `/dashboard` ✓
3. Navigate to `/admin/users` → see user list with "Admin" link in sidebar nav ✓
4. **Before promoting:** sign in as the second (non-admin) user.
   - Admin nav link absent from sidebar ✓
   - `/admin/users` redirects to `/dashboard` ✓
5. Sign back in as super_admin. Promote second user → role badge updates ✓
6. Click sign out → redirects to `/login`, `/dashboard` inaccessible ✓

---

## Edge Cases

- Login error: Supabase returns one message for both wrong email and wrong password — display verbatim.
- Profile missing after sign-in: `requireAuth()` logs a `console.error` with user id, then redirects to `/login` for clear diagnosis.
- `promoteUser` with empty/missing targetUserId: returns `{ error: "Invalid user ID" }` before querying.
- `promoteUser` on already-`super_admin` user: idempotent UPDATE, no error.
- No demotion in F001 — promote-only prevents accidentally removing the last super admin.
- Second user for AC3/AC4: must exist in Supabase Auth before testing. Create via Supabase dashboard (Authentication → Users → Add User), not from the app UI.

---

## Addendums Applied (from review feedback)

1. **AC-to-step mapping** added above.
2. **Second user prerequisite** explicitly stated: create via Supabase dashboard, no in-app create-user UI in F001.
3. **`/dashboard` confirmed** to exist at `src/app/(app)/dashboard/page.tsx`.
4. **RLS recursion fixed:** `is_super_admin()` SECURITY DEFINER function used in all policies instead of inline subquery on `profiles`.
5. **Null-profile diagnostic path:** `requireAuth()` logs a `console.error` with the user id before redirecting, enabling diagnosis of trigger/migration failures.
6. **`promoteUser` input validation:** validates `targetUserId` before querying; returns `{ error }` for missing/invalid targets.
7. **`SignOutButton` is a Server Component:** `"use client"` not needed — native form + server action works without JS.
