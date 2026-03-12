# Panashe Software Documentation Pack

Last updated: 2026-03-12

This folder contains the working project record for the Panashe archival research software project. It is intended to let any future Codex or Claude instance recover full context quickly and continue work without relying on prior chat history.

## How to use this folder

Start here, then read files in this order:

1. `docs/README.md`
2. `docs/context/project-history.md`
3. `docs/product/PROJECT_BRIEF.md`
4. `docs/product/TECHNICAL_BRIEF.md`
5. `docs/context/SOURCES_AND_INTEGRATIONS.md`
6. `docs/context/DECISIONS_AND_OPEN_QUESTIONS.md`

## Current high-level status

- Project is still in pre-build planning.
- The client is willing to proceed **without direct Readex integration**.
- Readex should currently be treated as a **manual acquisition source** unless written permission changes that.
- Other archive sources may support programmatic access and need technical validation.
- The first realistic product is an **internal research ingestion and analysis system**, not a public archive and not a universal live sync platform.

## Core project position

The system should:

- accept manually downloaded Readex materials
- ingest from other sources programmatically where allowed
- preserve source files unchanged
- support transcription, translation, annotation, search, and reporting
- improve over time via translation memory and editorial corrections

The system should not currently assume:

- direct Readex API access
- a fully automated multi-source pull pipeline
- high-quality automatic translation without review
- finished historical orthography normalization in v1

## File map

- `docs/README.md`
  - canonical documentation index for future sessions
- `docs/product/PROJECT_BRIEF.md`
  - client mandate, vision, objectives, status, and delivery framing
- `docs/product/TECHNICAL_BRIEF.md`
  - proposed product shape, architecture, workflows, data model, features
- `docs/context/SOURCES_AND_INTEGRATIONS.md`
  - archive source inventory, access constraints, programmatic options, current confidence levels
- `docs/context/DECISIONS_AND_OPEN_QUESTIONS.md`
  - settled decisions, assumptions, risks, unresolved questions, and next validation steps
- `docs/context/project-history.md`
  - running log of research, calls, findings, and project actions
- `docs/product/PRD.md`
  - execution source of truth for the product build
- `docs/design/`
  - locked brand and UI direction for feature agents
- `docs/engineering/`
  - architecture and data model references
- `docs/process/progress.md`
  - build-progress tracker against the feature list

## Maintenance rule for future sessions

When major decisions are made, update:

- `docs/context/project-history.md` for chronology
- `docs/context/DECISIONS_AND_OPEN_QUESTIONS.md` for the current truth
- `docs/product/PROJECT_BRIEF.md` if client mandate or scope changes
- `docs/product/TECHNICAL_BRIEF.md` if architecture or product shape changes
