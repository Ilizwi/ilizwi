# Decisions and Open Questions

Last updated: 2026-03-12

## Decisions already made

### Product framing

- The first product is an **internal research platform**, not a public archive launch.
- The product should be a **source-agnostic archival research workbench**.
- The platform should become the **single source of truth** instead of relying on Google Drive as the primary working system.

### Readex position

- Readex is currently treated as a **manual acquisition source**.
- The project should proceed without waiting for Readex integration.
- If Readex permissions later change, the platform can be extended, but that is not a current dependency.
- A Readex permissions / special-access request has been sent and is awaiting reply.

### Workflow position

- The client team will continue to manually search and download from Readex.
- The software takes over once materials are in the system.
- The system must support heterogeneous source types and quality levels.
- Ibali and NLSA are now confirmed as viable structured sources for v1.
- Wits is now confirmed as a supplementary source rather than a blocker.

### Core feature direction

- transcription must be explicitly included
- translation memory is required
- orthography-sensitive workflow is required
- terminology controls are required
- uncertainty/dispute visibility is required

## Assumptions currently in force

- the client is willing to proceed without direct Readex integration
- manual uploads from Readex are acceptable
- at least some other archives may support programmatic access
- archive materials will continue to vary heavily in modality and quality

## Open questions

### Source validation

- What exact data can be fetched from NLSA in practice?
- Is Ibali’s reported API endpoint usable for the required project workflows?
- Is the Wits archive actually using AtoM in a way that exposes useful API access?
- Which of UKZN and UNISA are worth pursuing at all in the first implementation phase?

### Data model

- What is the canonical granularity of a record?
  - issue
  - page
  - article
  - or mixed with parent-child relationships
- What metadata fields are mandatory at upload time?
- What naming convention should the system enforce?
- How should unresolved legacy records be handled during canonical-record rollout?

### Transcription workflow

- When both OCR text and a manual transcription exist, which one is the working base layer?
- How should corroborating transcriptions be linked to source documents?
- What review states should be required before a transcription is considered trusted?

### Translation workflow

- Which machine translation provider will be used initially?
- How will translation memory match future text?
  - exact match only
  - fuzzy match
  - semantic similarity later
- How are protected terms defined, approved, and versioned?

### Orthography handling

- How should orthography rules be represented?
  - by language and date band
  - by publication
  - by manually curated glossary/rule set
- Should normalization be suggested automatically or only user-invoked?

### Operations

- Should uploads happen through a web interface only, or also batch folder import?
- What storage provider should be used?
- What backup approach is required?
- What access roles will exist?

## Risks that future sessions should keep in view

- archive integrations may look possible in theory but be limited in practice
- source data may be incomplete or inconsistent
- OCR quality may be poor enough to require strong human review
- translation quality may vary too much for automation to be trusted without controls
- scope can drift toward a public portal too early

## Immediate implementation clarification

- Do not create a separate `F004.2` or debt sprint for legacy canonical-ref cleanup.
- Treat cleanup of `LEGACY-{uuid}` sentinel rows as part of `F005 Canonical Record Creation and Linking`.
- Reason:
  - fake canonical identifiers affect record identity, provenance confidence, and linking
  - F005 is the correct place to normalize, backfill, or quarantine them
  - storage-path neatness does not need to block F005

## Recommended next validation tasks

1. Draft the first naming convention and required metadata schema.
2. Define the first internal record model.
3. Define the first upload workflow for manually downloaded Readex files.
4. Decide how Wits should be represented in v1 ingestion: metadata-only discovery vs selective file ingestion.
5. Wait for Readex response and log outcome when received.

## Documentation rule

When one of these questions is answered, move it:

- from `Open questions`
- to `Decisions already made`

and record the change in `progress.md`.
