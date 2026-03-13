# Panashe Archival Research Platform — Development Progress

## Overview
| Metric | Value |
|--------|-------|
| Total Features | 24 |
| Completed | 5 |
| Remaining | 19 |
| Current Day | 2 |

## Day 1: Foundation
**Status:** Complete

- [x] Project scaffolding complete
- [x] CLAUDE.md configured
- [x] docs/ structure ready
- [x] F001: Authentication and Role-Based Access — PASSED
- [x] F002: Project and Team Management — PASSED
- [x] F003: Manual Archive Upload Intake — PASSED
- [x] F004: Upload Metadata Enforcement and File Naming — PASSED
- [x] F005: Canonical Record Creation — PASSED

**Deliverable:** Admin shell and foundational upload/record workflow visible on localhost

---

## Day 2: Source and Text Foundations
**Status:** Not Started

- [ ] F006: Ibali Source Integration
- [ ] F007: NLSA Source Integration
- [ ] F008: Wits Supplementary Source Intake
- [ ] F009: Source File Viewer
- [ ] F010: OCR and Source Text Acquisition Layer
- [ ] F011: Text Layer Management

**Deliverable:** Source ingestion flows working with preserved file/text layers

---

## Day 3: Transcription and Translation
**Status:** Not Started

- [ ] F012: Transcription Editor and Review Status
- [ ] F013: Machine Translation Draft Generation
- [ ] F014: Translation Editor and Correction Workflow
- [ ] F015: Translation Memory
- [ ] F016: Protected-Term and Glossary Rules

**Deliverable:** End-to-end transcription and translation workflow operational

---

## Day 4: Reader and Research Workflow
**Status:** Not Started

- [ ] F017: Scholarly Side-by-Side Reader
- [ ] F018: Annotation and Notes
- [ ] F019: Uncertainty and Dispute Flags
- [ ] F020: Search and Filter

**Deliverable:** Researchers can read, annotate, and search records in one workspace

---

## Day 5: Reporting, Discovery, and Polish
**Status:** Not Started

- [ ] F021: Citation Packet Export
- [ ] F022: Corpus Trend View
- [ ] F023: Related Text Suggestions
- [ ] F024: Admin Record Audit and Activity Trace

**Deliverable:** Research outputs, auditability, and polish complete

---

## Session Log

### Session 1 — 2026-03-12
- Initial project docs created
- Source integrations researched and validated
- PRD written and approved
- Feature list created and approved
- Execution docs prepared

### Session 2 — 2026-03-12
- F001 Authentication and Role-Based Access — implemented, reviewed, and merged
- Plan written with addendums: RLS recursion fix, null-profile diagnostic logging, promoteUser input validation, SignOutButton as Server Component, AC-to-step mapping
- SQL migration applied to remote Supabase; both users provisioned
- Supabase CLI linked; Vercel env vars set for production and development
- PR #1 reviewed by Codex (3 review rounds), all feedback addressed, squash merged to main
- F001 marked as passed

### Session 3 — 2026-03-12
- F002 Project and Team Management — implemented, reviewed, and merged
- Plan written with addendums: SECURITY DEFINER RLS helpers, orphan guard on both mutations, explicit auth in actions, server-side slug, negative ACs
- Backend: migration (enums, tables, is_project_member/is_project_admin helpers, triggers, RLS), types, project guard, server actions with orphan guards + audit logs
- Frontend: /projects list, /projects/new, /projects/[id] detail+team, ProjectForm, AddMemberForm, MemberRoleForm, RemoveMemberForm, sidebar nav link
- supabase db push applied to remote
- PR #2 reviewed (FK disambiguation, auth returns instead of throws, unused helper removed, audit log user_id), all fixed, squash merged to main
- F002 marked as passed

### Session 5 — 2026-03-12
- F004 Upload Metadata Enforcement and File Naming — implemented via parallel agent team (6 agents, 2 waves), PR reviewed, 2 fixes applied (migration collision bug, retry loop off-by-one), squash merged to main
- Migrations: `20260312000003` (2-phase canonical_ref column + unique index) + `20260312000004` (live-DB LEGACY sentinel fixup)
- New module: `src/lib/records/canonical-ref.ts` — pure TS shared by server action and client form preview; source/pub alias maps, deterministic fallback normalization, collision suffix support
- `source_records` extended: `volume`, `issue_number`, `article_label`, `canonical_ref` (NOT NULL, unique index)
- Upload now requires `date_issued`; canonical_ref generated on upload with 23505 collision retry (up to -r9)
- Records list shows canonical_ref in monospace column
- Deferred: storage path alignment with canonical_ref; backfill of real refs for legacy rows
- All 5 PRD test steps satisfied. F004 PASSED.

### Session 6 — 2026-03-13
- F005 Canonical Record Creation — implemented via parallel agent team (3 agents), quality gate passed, all 5 PRD test steps satisfied
- Migration: `20260313000001_f005_text_layers.sql` — text_layers table with idempotent enum creation; RLS SELECT (project members), INSERT (super_admin/project_admin/researcher), UPDATE status-only (creator/super_admin) with immutability comment; updated_at trigger
- Types: `TextLayer` added to `src/types/index.ts`
- Server action: `src/lib/actions/text-layers.ts` — `addTextLayer` with permission symmetry (project_admin + researcher allowed, translator/reviewer explicitly denied), input validation, audit log, revalidatePath
- Detail page: `/projects/[id]/records/[recordId]` — combined tenancy guard validates both project_id and recordId in one query (prevents cross-project leakage); provenance read-only panel, file assets table, text layers table with type/status badges, AddTextLayerForm gated to allowed roles
- Component: `AddTextLayerForm` client component — useActionState, layer_type select, content textarea, optional language input, source_method select, error display
- Records list: canonical_ref cell now links to detail page
- Addendums applied: immutability comment on UPDATE policy; language stays null (not inherited at action level); translator/reviewer denied with friendly error; tenancy guard tightened; action in dedicated text-layers.ts file
- `supabase db push` needed to apply migration to remote
- F005 PASSED.

### Session 4 — 2026-03-12
- F003 Manual Archive Upload Intake — implemented via parallel agent team (backend + frontend tracks), PR reviewed, two P1 fixes applied, squash merged to main
- Migrations applied: source_records + file_assets tables with SQL enums (source_type, record_status, asset_type); is_super_admin() helper; RLS policies for SELECT/INSERT + DELETE (compensating cleanup); archive-files private storage bucket (50MB, mime whitelist)
- uploadRecord server action: pre-generated UUID, compensating transaction with storage rollback on DB failure, explicit role guard (project_admin/researcher only), server-side mime/size/field validation, upsert: false
- Types added: RecordStatus, SourceRecord, FileAsset
- Pages: /projects/[id]/upload (role-gated), /projects/[id]/records (table + status badges + empty state); project detail updated with records count and links
- Code review findings: compensating cleanup DELETE policies missing (fixed), super_admin RLS gap (fixed with is_super_admin() + updated INSERT/DELETE policies)
- All 5 PRD test steps satisfied. F003 marked as passed

---

## Notes

- Readex remains manual unless permissions change
- Ibali and NLSA are core structured sources for v1
- Wits is a supplementary source
- ILIZWI brand direction documented under `docs/design/`
