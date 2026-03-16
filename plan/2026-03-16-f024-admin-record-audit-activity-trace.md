# F024 — Admin Record Audit and Activity Trace

**Date:** 2026-03-16
**Branch:** `codex/f024-admin-record-audit-activity-trace`
**PR:** #23 (squash merged to main)
**Status:** PASSED

---

## Objective

Persist audit entries to a DB table for all record-relevant mutations, and expose a project-scoped admin view where admins can see who did what and when, filterable by record.

---

## Approach

1. Migration: `audit_logs` table with admin-only SELECT and no INSERT policy (service role writes only)
2. Service role client: `src/lib/supabase/service.ts` — singleton, `server-only` guarded
3. Shared helper: `src/lib/audit/log.ts` — wraps insert, fully `try/catch`-wrapped (never throws)
4. Wire 14 action types across all record-relevant server actions
5. Audit page: `/projects/[id]/audit` — admin-gated, `?record=<UUID>` filter
6. Navigation links: project detail + record detail pages

---

## Files Created

- `supabase/migrations/20260314000008_f024_audit_logs.sql`
- `src/lib/audit/log.ts`
- `src/lib/supabase/service.ts`
- `src/app/(app)/projects/[id]/audit/page.tsx`
- `plan/2026-03-16-f024-admin-record-audit-activity-trace.md`

## Files Modified

- `src/types/index.ts` — `AuditLog` interface added
- `src/app/(app)/projects/[id]/page.tsx` — "Activity Trace →" link (admin only)
- `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` — "Activity →" link (admin only)
- `src/lib/actions/records.ts`
- `src/lib/actions/text-layers.ts`
- `src/lib/actions/extract-text.ts`
- `src/lib/actions/generate-translation.ts`
- `src/lib/actions/save-translation-correction.ts`
- `src/lib/actions/import-ibali.ts`
- `src/lib/actions/import-nlsa.ts`
- `src/lib/actions/import-wits.ts`
- `src/lib/actions/annotations.ts`
- `src/lib/actions/record-flags.ts`
- `package.json` / `package-lock.json` — `server-only` dependency added

---

## Steps Executed

1. **Migration** — `audit_logs` table: `project_id`, `record_id` (nullable), `actor_id ON DELETE RESTRICT`, `action_type TEXT`, `metadata JSONB`, `created_at`. Two indexes (project+time, record+time partial). RLS: admin-only SELECT; no INSERT policy (service role only).
2. **Service client** — `src/lib/supabase/service.ts`: singleton `createClient<any>` using `SUPABASE_SERVICE_ROLE_KEY`; `import "server-only"` guard at top.
3. **Shared helper** — `src/lib/audit/log.ts`: full `try/catch` wrapping including client creation; checks `{ error }` from insert; logs but never throws.
4. **Action wiring** — `insertAuditLog({ projectId, actorId, actionType, recordId, metadata })` added after each primary mutation's console.log, before revalidatePath. 14 call sites total.
5. **Audit page** — server component; reuses `isAdmin` pattern from project detail; `?record=<UUID>` validated via regex before query; `{ error }` from query logged; `formatMetadata()` renders compact suffix per action type.
6. **Links** — "Activity Trace →" in project detail (isAdmin gate); "Activity →" in record detail linking to `?record=<recordId>`.

---

## Review Findings Fixed (4 rounds)

| Round | Finding | Fix |
|-------|---------|-----|
| 1 | INSERT policy too weak — any member could fabricate rows | Tightened to membership + record/project consistency |
| 1 | UUID filter not validated; query error swallowed | UUID regex validation; logsError logged |
| 1 | Metadata not surfaced in UI | `formatMetadata()` renders compact suffix in action column |
| 2 | INSERT policy still allows member forgery | Moved writes to service role; dropped INSERT policy entirely |
| 3 | super_admin non-member actions silently dropped | N/A (resolved by service role — no membership check needed) |
| 4 | `insertAuditLog` could throw on env misconfiguration | Wrapped full body in try/catch |
| 4 | `service.ts` lacked server-only guard | Added `import "server-only"` |

---

## Acceptance Criteria (PRD test steps)

1. ✅ All 14 action types write to `audit_logs` on success (non-blocking)
2. ✅ `/projects/[id]/audit` accessible to project_admin and super_admin
3. ✅ Each row shows: timestamp, actor name/email, action label + metadata suffix, record link
4. ✅ `?record=<UUID>` filters to that record's history; link from record detail page
5. ✅ actor + timestamp + action_type + metadata satisfies "who changed what and when"

---

## Known Limitations (V1)

- Limit 100 rows per page — no pagination
- No date-range filter on the audit page
- `action_type` is free-text at the helper layer; DB has no CHECK constraint on valid values
- `SUPABASE_SERVICE_ROLE_KEY` must be set in deployment env; missing key is caught and logged but audit rows will not be written
