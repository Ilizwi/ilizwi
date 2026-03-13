# Panashe Archival Research Platform — Development Progress

## Overview
| Metric | Value |
|--------|-------|
| Total Features | 24 |
| Completed | 10 |
| Remaining | 14 |
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
**Status:** In Progress

- [x] F006: Ibali Source Integration — PASSED
- [x] F007: NLSA Source Integration — PASSED
- [ ] F008: Wits Supplementary Source Intake
- [x] F009: Source File Viewer — PASSED
- [x] F010: OCR and Source Text Acquisition Layer — PASSED
- [x] F011: Text Layer Management — PASSED

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

### Session 11 — 2026-03-13
- F011 Text Layer Management — implemented via 3-agent parallel team, code reviewed (3 findings, 2 commits), squash merged to main (PR #10)
- TextLayerCard: card-based layer display with own type/status label maps, expand/collapse, inline versioning form
- CreateLayerVersionForm: submit-protected (isPending), auto-close on success, supersedes_layer_id wired correctly
- addTextLayer() action: validates supersedes_layer_id for same-record AND same-type; logs supersedes_layer_id on success
- Record detail page: replaces table with cards; reverse-lookup supersededIds; active/superseded split sections
- All 5 PRD test steps satisfied. F011 PASSED.

### Session 10 — 2026-03-13
- F010: OCR and Source Text Acquisition Layer — implemented, code reviewed (1 P1 fix), squash merged to main (PR #9)
- No DB migration required — existing text_layers schema supports this
- pdf-parse v2 (PDFParse class-based API) installed; extractTextFromBuffer utility in src/lib/sources/text-extractor.ts
- extractTextFromRecord server action: derives projectId server-side, V1 first-PDF rule, content-hash no-op, supersedes_layer_id versioning, sanitized error messages
- Review P1 fix: super_admin bypass removed from assertLayerPermission — all SELECT/storage read policies are membership-only, app-layer boundary now matches DB boundary
- ExtractTextSection client component: useActionState, PDF/image branch, re-extract hint
- Record detail page wired with hasPdfAsset and hasExistingSourceOcr computations
- All 5 PRD steps satisfied. F010 PASSED.

### Session 9 — 2026-03-13
- F009: Source File Viewer — implemented via 2-agent parallel team, squash merged to main (PR #8)
- New: `FileViewerSection` client component — inline PDF iframe viewer, non-PDF fallback, disabled View state on null/error view_url
- New: `EnrichedFileAsset = FileAsset & { view_url: string | null; view_url_error?: string | null }` in `src/types/index.ts`
- Signed URLs generated server-side for `storage_path` assets; `source_url` assets passed through directly
- Hardening: raw error messages sanitized to `"Preview unavailable"`; `isTrustedOrigin()` allowlist (Supabase, NLSA, Ibali) gates iframe; untrusted-origin PDFs fall back to open-link
- All 5 PRD steps satisfied. F009 PASSED.

### Session 8 — 2026-03-13
- F007: NLSA ContentDM Source Integration — implemented via parallel agent team (2 agents), code reviewed (P1 fix: date validator tightened to full YYYY-MM-DD only), squash merged to main (PR #7)
- No new migration — F006 schema covers NLSA
- Adapter `src/lib/sources/nlsa.ts`: ContentDM singleitem endpoint, flat-field mapping, typed fetch results, timeout error shaping
- Action `importFromNlsa`: strict two-format parser, alias normalised to lowercase, full-date-only validation, source_ocr layer type, compensating rollback
- Review P1 fix: partial dates (YYYY, YYYY-MM) rejected — would produce malformed canonical refs violating `CanonicalRefFields.date_issued // YYYY-MM-DD`
- Import page + form with known-collection hints; project detail link added
- All 5 PRD steps satisfied. F007 PASSED.

### Session 7 — 2026-03-13
- F006: Ibali Source Integration — implemented via parallel agent team (3-wave, 5 agents), code reviewed (P1 fix: removed synthetic date fallback), squash merged to main (PR #6)
- Migration `20260313000003`: `source_identifier` + `source_url` on `source_records`; partial unique index `(project_id, source_type, source_identifier) WHERE source_identifier IS NOT NULL`; `source_url` on `file_assets`; `storage_path` nullable; `file_assets_location_check` CHECK constraint (exactly one of storage_path/source_url)
- Adapter `src/lib/sources/ibali.ts`: Omeka S property helper, `fetchIbaliItem`/`fetchIbaliMedia` with `AbortSignal.timeout(10_000)`, typed `IbaliFetchResult` with three error shapes
- Action `importFromIbali`: idempotency pre-check; assertImportPermission (local copy of existing pattern); canonical ref collision retry; compensating rollback on any partial child failure; rejects items with no dcterms:date
- Review P1 fix: `new Date()` fallback removed — import fails with clear error if Ibali provides no date, preserving provenance invariant
- Import page `/projects/[id]/import/ibali`: role-gated; translator/reviewer see inline access-denied
- `IbaliImportForm`: useActionState, success/error state, record link on success
- Project detail: "Import from Ibali →" link (same gate as Upload)
- Types: `SourceRecord` + `FileAsset` extended; `storage_path` nullable
- `supabase db push` applied; build passes clean
- All 5 PRD steps + 4 addendum criteria satisfied. F006 PASSED.

### Session 6 — 2026-03-13
- F005 Canonical Record Creation — implemented via parallel agent team (3 agents), code reviewed (1 P1 finding), 2 fixes applied, squash merged to main (PR #5)
- Migration `20260313000001`: text_layers table, idempotent enums (layer_type / layer_status / layer_source_method), RLS SELECT/INSERT, updated_at trigger
- Migration `20260313000002`: compensating — drops UPDATE policy removed in review
- Review P1 fix: no UPDATE policy ships with F005; content immutability enforced at application layer; supersedes_layer_id used for versioning; status-only UPDATE deferred to a later feature with DB-level column enforcement and current-membership check
- Server action tightened: `addTextLayer` derives project_id from source_records on server (not hidden form field)
- All 5 PRD test steps satisfied. F005 PASSED. Day 1 complete.

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
