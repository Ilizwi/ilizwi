# Panashe Archival Research Platform — Development Progress

## Overview
| Metric | Value |
|--------|-------|
| Total Features | 24 |
| Completed | 18 |
| Remaining | 6 |
| Current Day | 4 |

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
**Status:** Complete

- [x] F006: Ibali Source Integration — PASSED
- [x] F007: NLSA Source Integration — PASSED
- [x] F008: Wits Supplementary Source Intake — PASSED
- [x] F009: Source File Viewer — PASSED
- [x] F010: OCR and Source Text Acquisition Layer — PASSED
- [x] F011: Text Layer Management — PASSED

**Deliverable:** Source ingestion flows working with preserved file/text layers — Day 2 complete

---

## Day 3: Transcription and Translation
**Status:** Complete

- [x] F012: Transcription Editor and Review Status — PASSED
- [x] F013: Machine Translation Draft Generation — PASSED
- [x] F014: Translation Editor and Correction Workflow — PASSED
- [x] F015: Translation Memory — PASSED
- [x] F016: Protected-Term and Glossary Rules — PASSED

**Deliverable:** End-to-end transcription and translation workflow operational — Day 3 complete

---

## Day 4: Reader and Research Workflow
**Status:** In Progress

- [x] F017: Scholarly Side-by-Side Reader — PASSED
- [x] F018: Annotation and Notes — PASSED
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

### Session 19 — 2026-03-14
- F018: Annotation and Notes — implemented via 3-agent parallel team (migration + types, server actions, component), squash merged to main (PR #18)
- Migration `20260314000005`: `annotation_type_enum` ENUM, `annotations` table with project_id/record_id/text_layer_id/annotation_type/content/created_by; indexes on record_id and project_id; updated_at trigger (reuses existing `update_updated_at()` function); RLS SELECT (member OR super_admin), INSERT (any member OR super_admin), UPDATE (author OR project_admin OR super_admin)
- New server actions `src/lib/actions/annotations.ts`: `addAnnotation` derives project_id server-side from record_id (no client trust); validates text_layer_id belongs to same record_id; member-only insert guard; `updateAnnotation` derives project_id/record_id from annotation_id (no client trust); author-OR-project_admin-OR-super_admin update guard; both return `{ error: string | null }`, callers handle redirects
- New component `src/components/records/AnnotationsPanel.tsx`: server component; scholarly marginalia style (border-l-2 border-historic); annotation type badges (5 types, muted/coloured); author display_name or email; linked layer label; edit link visible to author OR canEditAll; inline edit form via `?editAnnotation=<id>` search param; add form always visible to project members
- Modified `src/types/index.ts`: added `Annotation` interface with `profiles?` join shape
- Modified `src/app/(app)/projects/[id]/records/[recordId]/page.tsx`: searchParams added; annotations fetched with profiles join (desc order); server action wrappers `handleAddAnnotation`/`handleUpdateAnnotation` handle redirects; AnnotationsPanel rendered after Text Layers section
- Addendums applied: server-derived project_id; text_layer_id cross-record validation; actions return error, page handles redirects; `npm run` commands in plan; CRU scope (no delete)
- Build, typecheck, lint all pass. All 5 PRD test steps satisfied. F018 PASSED.
- plan/2026-03-14-f018-annotation-notes.md written (addendums applied)

### Session 15 — 2026-03-13
- F014: Translation Editor and Correction Workflow — implemented via 3-agent parallel team, code reviewed (2 findings fixed), squash merged to main (PR #14)
- New RLS policy `text_layers_insert_translator_correction`: translator role scoped to `corrected_translation` only; mirrors existing contributor policy shape; no new SQL helpers
- New `saveTranslationCorrection` server action: membership-only (no super_admin bypass); verifies source layer is active (superseded MT layers rejected); derives language/record/project server-side; allows project_admin, researcher, translator; inserts `corrected_translation` with `source_layer_id` provenance link; no supersession
- New `TranslationEditorForm`: language read-only display (not a form field); mirrors TranscriptionEditorForm pattern; auto-close on success
- `TextLayerCard`: `canCorrectTranslation` required prop; "Correct Translation" button on active machine_translation layers; action section visible when `canAddLayer || canCorrectTranslation`
- Record detail page: `canCorrectTranslation` membership-only (no super_admin shortcut — matches F012/F013 boundary); translator role included
- Review P1 fix: superseded source layer check in server action
- Review P2 fix: `canCorrectTranslation` initialised to false, not super_admin
- Both MT draft and corrected_translation remain active and accessible independently
- All 5 PRD test steps satisfied. Day 3: 3/5. F014 PASSED.

### Session 14 — 2026-03-13
- F013: Machine Translation Draft Generation — implemented via 3-agent parallel team, code reviewed (3 findings fixed), squash merged to main (PR #13)
- Migration adds `source_layer_id` (NO ACTION FK, immutable) + `translation_provider` to `text_layers`
- New modules: `translation-constants.ts` (client-safe UI constants), `google-translate.ts` (server-only API wrapper with auto-detect path for unrecognized source languages)
- Server action enforces membership-only auth, source layer priority selection, blocks any active MT (incl. manual), rejects invalid `targetLanguage`
- `GenerateTranslationSection` UI: silent role gate, info notices for blocked states, language selector, success/error via `useActionState`
- `TextLayerCard`: provider display label from canonical map
- `TextLayer` type extended with `source_layer_id` + `translation_provider`
- All 5 PRD test steps satisfied. F013 PASSED. Day 3: 2/5 done.

### Session 13 — 2026-03-13
- F012: Transcription Editor and Review Status — implemented via parallel subagent team (5 tasks), code reviewed (2 findings fixed), squash merged to main (PR #12)
- Migration `20260313000004`: immutability trigger guarding `id` + 8 fields with `IS DISTINCT FROM`; membership-only UPDATE RLS policy (no super_admin — matches SELECT boundary)
- New: `updateLayerStatus` action (membership-only, status-field-only UPDATE); `TranscriptionEditorForm` (pre-filled from source layer, creation-time status select); `UpdateLayerStatusForm` (inline post-creation status update)
- Modified: `addTextLayer` — optional creation-time status with strict validation; `TextLayerCard` — both forms wired, mutually exclusive state, "Edit / Transcribe" button on source layers
- Review fixes: `id` added to immutability guard; super_admin bypass removed from action + policy
- All 5 PRD steps satisfied. F012 PASSED. Day 3 in progress (1/5).

### Session 12 — 2026-03-13
- F008: Wits Supplementary Source Intake — implemented via 2-agent parallel team, code reviewed (2 rounds, P1 + P2 addressed), squash merged to main (PR #11)
- No DB migration required — `source_type='wits'` already in ENUM; `source_identifier`, `source_url`, `file_assets` XOR constraint all in place from F006; `date_issued_raw` column present from existing schema
- New adapter `src/lib/sources/wits.ts`: OAI-PMH XML parse via `fast-xml-parser`; `validateWitsRef` accepts both short and long OAI identifier forms; `normalizeWitsRef` converts both to canonical `:443:` form before storage; explicit single-vs-array normalisation for all `dc:` fields; `extractDate` tries strict ISO then year-level fallback (`YYYY-01-01`), `date_raw` always verbatim; `extractUrls` separates `file_url` (downloadable file) from `landing_url` (record page) in `dc:identifier[]`
- New server action `src/lib/actions/import-wits.ts`: permission guard (super_admin bypass + role check); normalizes OAI ref before idempotency lookup; `source_records` insert with `source_type='wits'`, `source_archive='Wits'`, `source_url=mapped.landing_url` (provenance link), `date_issued_raw=verbatim dc:date`; canonical ref collision retry r2–r9 (expected for year-range dates); `file_assets` insert conditional on `file_url !== null` (metadata-only path skips asset); no text_layers; compensating rollback
- New import page `src/app/(app)/projects/[id]/import/wits/page.tsx`: server component, role gate, inline access-denied for translator/reviewer
- New form `src/components/records/WitsImportForm.tsx`: `useActionState`; placeholder shows official short form; hint documents both accepted formats
- Modified `src/app/(app)/projects/[id]/page.tsx`: "Import from Wits →" link, same researcher/admin gate
- P1 fix (review round 2): dual identifier form support + normalisation
- P2 fix (review round 2): `landing_url` extracted and persisted to `source_records.source_url`
- `fast-xml-parser` added to dependencies
- Live OAI contract verified: `historic_99960` `dc:date="1955 - 1959"` confirmed year-extraction path; `dc:identifier` contains only landing pages — metadata-only is V1 standard
- All 5 PRD test steps satisfied. Day 2 complete. F008 PASSED.

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
