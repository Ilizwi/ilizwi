# CLAUDE.md

Last updated: 2026-03-12

This file defines how future Codex or Claude build sessions should operate in this repository.

## Project Role

You are working on the Panashe Archival Research Platform, an internal multi-user scholarly research system for African-language archival newspaper materials.

This is a research product, not a generic SaaS dashboard.

## Read Before Every Session

Read these files in order before proposing any implementation work:

1. `CLAUDE.md`
2. `claude-progress.txt`
3. `docs/process/progress.md`
4. `docs/product/PRD.md`
5. `feature_list.json`
6. `docs/engineering/architecture.md`
7. `docs/engineering/data-model.md`
8. `plan/` folder contents, if any

Also reference these project-context files when needed:

- `docs/product/PROJECT_BRIEF.md`
- `docs/product/TECHNICAL_BRIEF.md`
- `docs/context/SOURCES_AND_INTEGRATIONS.md`
- `docs/context/DECISIONS_AND_OPEN_QUESTIONS.md`
- `docs/context/project-history.md`
- `docs/design/design-system.md`
- `docs/design/ILIZWI_AGENT_GUIDE.md`
- `docs/design/design-tokens.json`

## Session Workflow

At the start of every new implementation session:

1. Read the current docs.
2. Report back very concisely:
   - what was completed last session
   - current progress
   - the next feature where `passes` is `false`
   - blockers or important notes
3. Propose today’s plan.
4. Wait for approval before writing code.

Do not start coding before approval.

## Branching Rule

Create a feature branch before implementation work begins.

Branch naming pattern:

- `codex/f001-auth-role-access`
- `codex/f006-ibali-source-integration`
- `codex/f017-side-by-side-reader`

Use the feature ID and a short kebab-case name.

## Source of Truth

The PRD and feature list are the execution source of truth.

- `docs/product/PRD.md` defines what the product is.
- `feature_list.json` defines the feature checklist and pass state.

Do not invent new features during implementation sessions.
If scope needs to change, update planning docs first.

## Product Rules

- preserve original source files
- preserve provenance
- preserve original text layers separately from corrected layers
- do not overwrite text layers silently
- do not collapse OCR, transcription, and translation into one field
- treat Readex as manual input unless documented permission changes that
- treat Ibali and NLSA as structured integrations
- treat Wits as a supplementary source

## UX Rules

- optimize for scholarly reading, comparison, and metadata clarity
- avoid generic startup styling
- support dense but readable layouts
- make source, provenance, and status always visible
- do not hide uncertainty

## Documentation Rules

At the end of each implementation session:

1. Update `claude-progress.txt`
2. Update `docs/process/progress.md`
3. Update `feature_list.json` if a feature now passes
4. Save or update the relevant implementation plan in `plan/`
5. Note any architecture or data-model changes in docs before ending the session

## Planning Rules

Before coding a feature, create a plan file in `plan/`.

Naming pattern:

- `YYYY-MM-DD-f001-auth-role-access.md`
- `YYYY-MM-DD-f006-ibali-source-integration.md`

Each plan must contain:

1. Objective
2. Approach
3. Files to create or modify
4. Steps
5. Acceptance criteria

## Quality Rules

- prefer reversible, well-scoped changes
- implement one feature at a time
- do not mix unrelated refactors into a feature session
- do not mark a feature as passed unless all PRD test steps are satisfied

## Design System

The current working brand direction is **ILIZWI**.

Future feature sessions must follow:

- `docs/design/design-system.md`
- `docs/design/ILIZWI_AGENT_GUIDE.md`
- `docs/design/design-tokens.json`

Do not invent a new visual direction.
Do not hardcode scattered colors or spacing values.
Use centralized tokens and the ILIZWI rules.

## Escalation

Raise a blocker instead of guessing if:

- a feature depends on unavailable credentials
- source integration behavior differs from documented assumptions
- the data model must change materially
- the requested implementation conflicts with the PRD
