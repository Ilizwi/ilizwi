# Plan: F002 — Project and Team Management
**Date:** 2026-03-12
**Branch:** `codex/f002-project-team-management`

---

## Context

F001 (auth, role guards, Supabase patterns) is complete and merged. F002 is the next P0/Day-1
feature. It establishes the core workspace unit — the research project — and lets admins build
teams inside it. Without projects, no other feature (upload, source viewer, reader) has a home.
Every subsequent feature is scoped to a project.

---

## Approach

SQL-first: create `projects` and `project_memberships` tables with RLS, auto-timestamp trigger,
and a creator-becomes-admin trigger. Build server actions for all mutations. Add three pages under
`/projects`. Keep all team management on the project detail page (no separate `/team` route).
Use existing patterns exactly: createClient(), requireAuth(), server actions in lib/actions/,
ILIZWI tokens in all UI.

**Slug handling:** Generate slug server-side only from the project name (no client-side slugify,
no editable slug field in the form). Route pages by `id` instead of slug to avoid slug-collision
edge cases. Slug is still stored for display/future use but is not the routing key.

---

## Files to Create

| File | Purpose |
|------|---------|
| `supabase/migrations/YYYYMMDDHHMMSS_f002_projects_and_memberships.sql` | DB schema: tables, enums, RLS, SECURITY DEFINER helpers, triggers |
| `src/lib/actions/projects.ts` | Server actions: createProject, addMember, updateMemberRole, removeMember |
| `src/lib/auth/project-guard.ts` | requireProjectMember, requireProjectAdmin helpers |
| `src/app/(app)/projects/page.tsx` | Project list — all projects user is a member of |
| `src/app/(app)/projects/new/page.tsx` | Create project form page |
| `src/app/(app)/projects/[id]/page.tsx` | Project detail + team roster + team management (route by id) |
| `src/components/projects/ProjectForm.tsx` | Client form for project creation |
| `src/components/projects/AddMemberForm.tsx` | Inline client form to add a member + role |

## Files to Modify

| File | Change |
|------|--------|
| `src/app/(app)/layout.tsx` | Add "Projects" nav link in sidebar |
| `src/types/index.ts` | Add `Project` and `ProjectMembership` domain types |

---

## Steps

### 1. SQL Migration

**Filename:** `supabase/migrations/YYYYMMDDHHMMSS_f002_projects_and_memberships.sql`
(Use actual timestamp at creation time.)

```sql
-- Enums
CREATE TYPE project_status AS ENUM ('active', 'archived');
CREATE TYPE project_role AS ENUM ('project_admin', 'researcher', 'translator', 'reviewer');

-- projects table
CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  description TEXT,
  status      project_status NOT NULL DEFAULT 'active',
  created_by  UUID NOT NULL REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- project_memberships table
CREATE TABLE project_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role        project_role NOT NULL DEFAULT 'researcher',
  invited_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- ----------------------------------------------------------------
-- SECURITY DEFINER helpers (avoid RLS recursion)
-- These are called from RLS policies; they bypass RLS themselves.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_project_member(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_memberships
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION is_project_admin(p_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_memberships
    WHERE project_id = p_project_id AND user_id = auth.uid() AND role = 'project_admin'
  );
$$;

-- Auto-timestamps
CREATE TRIGGER set_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Creator auto-becomes project_admin
CREATE OR REPLACE FUNCTION handle_new_project_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO project_memberships (project_id, user_id, role, invited_by)
  VALUES (NEW.id, NEW.created_by, 'project_admin', NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_created
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION handle_new_project_membership();

-- ----------------------------------------------------------------
-- Row Level Security
-- All membership policies use SECURITY DEFINER helpers to avoid
-- the self-referential recursion class seen in naive implementations.
-- ----------------------------------------------------------------
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_memberships ENABLE ROW LEVEL SECURITY;

-- Projects: member or super_admin can read
CREATE POLICY "projects_select" ON projects FOR SELECT
  USING (is_super_admin() OR is_project_member(id));

-- Projects: any authenticated user can create (created_by = caller)
CREATE POLICY "projects_insert" ON projects FOR INSERT
  WITH CHECK (auth.uid() = created_by AND auth.uid() IS NOT NULL);

-- Projects: project_admin or super_admin can update
CREATE POLICY "projects_update" ON projects FOR UPDATE
  USING (is_super_admin() OR is_project_admin(id))
  WITH CHECK (is_super_admin() OR is_project_admin(id));

-- Memberships: member of same project or super_admin can read
CREATE POLICY "memberships_select" ON project_memberships FOR SELECT
  USING (is_super_admin() OR is_project_member(project_id));

-- Memberships: project_admin or super_admin can insert
CREATE POLICY "memberships_insert" ON project_memberships FOR INSERT
  WITH CHECK (is_super_admin() OR is_project_admin(project_id));

-- Memberships: project_admin or super_admin can update
CREATE POLICY "memberships_update" ON project_memberships FOR UPDATE
  USING (is_super_admin() OR is_project_admin(project_id))
  WITH CHECK (is_super_admin() OR is_project_admin(project_id));

-- Memberships: project_admin or super_admin can delete
CREATE POLICY "memberships_delete" ON project_memberships FOR DELETE
  USING (is_super_admin() OR is_project_admin(project_id));
```

Run: `supabase db push`

### 2. Types (`src/types/index.ts`)

Add after the existing `ProjectRole` type:

```typescript
export type ProjectStatus = "active" | "archived";

export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: ProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ProjectMembership = {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  invited_by: string | null;
  created_at: string;
  // joined from profiles query
  profile?: Pick<Profile, "email" | "display_name">;
};
```

### 3. Project Guard (`src/lib/auth/project-guard.ts`)

Follow the same shape as `role-guard.ts`:

- `requireProjectMember(projectId: string)` — fetch project by id, confirm caller is a member
  (check `project_memberships` via RLS); redirect to `/projects` if not
- `requireProjectAdmin(projectId: string)` — same but role must be `project_admin` OR
  caller is `super_admin`

Both return `{ project, profile }` so pages can use the data without re-fetching.

### 4. Server Actions (`src/lib/actions/projects.ts`)

**Authorization pattern (same as F001 — must be explicit in every action):**
1. Call `requireAuth()` — throws redirect if unauthenticated
2. For membership mutations: verify caller is `project_admin` or `super_admin` via a direct DB
   query, do NOT rely on RLS alone as the only check

**Actions:**

`createProject(prevState, formData)`:
- Validate: name required (≥2 chars), description optional
- Generate slug server-side: `slugify(name)` + suffix if collision (check uniqueness, append `-2`,
  `-3`, etc.)
- Return friendly error on slug collision instead of throwing
- Insert project row; trigger fires and inserts caller as `project_admin`
- Redirect to `/projects/[id]`

`addMember(formData)`:
- Fields: `projectId`, `email`, `role`
- Server-side admin guard: confirm caller is `project_admin` or `super_admin`
- Look up target user by email in `profiles`; return error if not found
- Insert membership; handle duplicate (UNIQUE constraint) with friendly error
- `revalidatePath("/projects/[id]")`

`updateMemberRole(formData)`:
- Fields: `projectId`, `membershipId`, `newRole`
- Server-side admin guard
- **Orphan guard:** if `newRole !== 'project_admin'`, verify there will still be at least one
  `project_admin` remaining after this change; return error if not
- Update membership role
- `revalidatePath("/projects/[id]")`

`removeMember(formData)`:
- Fields: `projectId`, `membershipId`
- Server-side admin guard
- **Orphan guard:** verify there is more than one `project_admin` before allowing removal of a
  `project_admin`; return error "Cannot remove the last project admin" if not
- Delete membership
- `revalidatePath("/projects/[id]")`

### 5. Pages

**`/projects`** (list) — `src/app/(app)/projects/page.tsx`
- Server component, calls `requireAuth()`
- Fetches all projects user is a member of (RLS handles filtering); join member count
- ILIZWI: vault header strip, desk content area
- Each project: row card with name, slug (as label), status badge, member count, link to
  `/projects/[id]`
- CTA: "New Project" button (all authenticated users)

**`/projects/new`** (create) — `src/app/(app)/projects/new/page.tsx`
- Server shell + `ProjectForm` client component
- Fields: Name (text), Description (textarea)
- No slug field — generated server-side
- Submit → `createProject` → redirect to `/projects/[id]`

**`/projects/[id]`** (detail + team) — `src/app/(app)/projects/[id]/page.tsx`
- Server component, calls `requireProjectMember(id)` (redirects non-members)
- Section 1: Project info — name, description, status, created date
- Section 2: Team roster — table of members (display_name/email, role badge, remove/change-role
  actions)
- Actions visible only when caller is `project_admin` or `super_admin`:
  - Role selector per member → `updateMemberRole` form
  - Remove button per member → `removeMember` form
  - `AddMemberForm` at bottom

### 6. UI Components

**`ProjectForm`** (`src/components/projects/ProjectForm.tsx`):
- `"use client"`, `useActionState` with `createProject`
- Fields: name, description
- Error display below form
- Submit button with pending state

**`AddMemberForm`** (`src/components/projects/AddMemberForm.tsx`):
- `"use client"`, `useActionState` with `addMember`
- Fields: email input, role `<select>` (project_admin | researcher | translator | reviewer)
- Hidden field: `projectId`
- Error display, submit with pending state

### 7. Sidebar Nav

In `src/app/(app)/layout.tsx`, add "Projects" link after Dashboard link (visible to all
authenticated users, no role gate).

---

## Acceptance Criteria

### Happy Path

| # | Test Step | Done when |
|---|-----------|-----------|
| AC1 | Create new project with name + description | Form submits, project in list at `/projects` |
| AC2 | Add team member by email | Membership row created, member in roster |
| AC3 | Assign project role to member | Role stored correctly, displayed in roster |
| AC4 | View team roster | `/projects/[id]` shows all members with roles |
| AC5 | Change member role / remove member | Update/removal persists without reload |

### Negative / Authorization

| # | Test Step | Done when |
|---|-----------|-----------|
| AC6 | Non-member visits `/projects/[id]` | Redirected to `/projects` |
| AC7 | Researcher member tries addMember via direct POST | Server action returns auth error |
| AC8 | Researcher member tries updateMemberRole via direct POST | Server action returns auth error |
| AC9 | Admin tries to remove/demote last project_admin | Action returns friendly error, no change |
| AC10 | Add same member twice | Friendly duplicate error, no crash |
| AC11 | Create project with name that generates a colliding slug | Returns unique slug with suffix |
| AC12 | Add member with email that doesn't exist | Friendly "user not found" error |

---

## Audit / Observability

Membership mutations must log to `console.log` (same pattern as F001 `promoteUser`):
- `[addMember] actor=<uid> added user=<uid> as <role> to project=<id>`
- `[updateMemberRole] actor=<uid> changed user=<uid> from <old> to <new> in project=<id>`
- `[removeMember] actor=<uid> removed user=<uid> from project=<id>`

---

## Verification

After implementation:
1. `npm run build` — must pass
2. `npx tsc --noEmit` — must pass
3. `supabase db push` — migration applied without errors
4. Run all acceptance criteria (AC1–AC12)
