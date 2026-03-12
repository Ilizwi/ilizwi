# Panashe Archival Research Platform — Development Progress

## Overview
| Metric | Value |
|--------|-------|
| Total Features | 24 |
| Completed | 2 |
| Remaining | 22 |
| Current Day | 1 |

## Day 1: Foundation
**Status:** In Progress

- [x] Project scaffolding complete
- [x] CLAUDE.md configured
- [x] docs/ structure ready
- [x] F001: Authentication and Role-Based Access — PASSED
- [x] F002: Project and Team Management — PASSED
- [ ] F003: Manual Archive Upload Intake
- [ ] F004: Upload Metadata Enforcement and File Naming
- [ ] F005: Canonical Record Creation and Linking

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

---

## Notes

- Readex remains manual unless permissions change
- Ibali and NLSA are core structured sources for v1
- Wits is a supplementary source
- ILIZWI brand direction documented under `docs/design/`
