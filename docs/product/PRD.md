# PRD: Panashe Archival Research Platform

Last updated: 2026-03-12
Version: 1.0
Status: Draft for review

## 1. Product Overview

### 1.1 Product Name

Working project name: `panashe-software`

Final product name pending.

### 1.2 Product Summary

The Panashe Archival Research Platform is an internal, multi-user research system for collecting, organizing, transcribing, translating, annotating, and studying African-language archival newspaper materials, with an initial focus on 19th-century South African indigenous-language newspapers.

The system is designed to support a scholarly workflow rather than a generic document-management workflow. It must preserve source provenance, preserve original orthography, support manual and semi-automated transcription workflows, support historically sensitive translation workflows, and allow researchers to work across multiple source repositories with different formats and levels of text quality.

### 1.3 Primary Users

- Super Admin
  - initial system owner
  - manages platform-level configuration
  - creates and promotes project admins and super admins
- Project Admin
  - manages a project team
  - invites researchers/translators/reviewers
  - oversees records and workflows
- Researcher
  - uploads materials
  - edits metadata
  - reviews transcription
  - annotates and explores the corpus
- Translator
  - reviews machine translations
  - submits corrected translations
  - contributes glossary and terminology decisions
- Reviewer
  - approves or rejects transcription/translation states

### 1.4 Why This Product Exists

The client’s current workflow is fragmented across:

- manual downloads from archive systems
- folder-based file storage
- manual naming conventions
- inconsistent metadata capture
- external spreadsheets
- mixed-quality OCR and transcription sources
- repeated translation effort without systematic memory

The product exists to turn that fragmented research process into a coherent archival research workflow.

### 1.5 Product Scope for V1

V1 is an internal research platform, not a public archive launch.

V1 must support:

- manual Readex uploads
- programmatic ingestion from supported public archives
- file storage and provenance tracking
- transcription handling
- OCR/text extraction support
- translation workflow
- annotation workflow
- search and filtering
- role-based access

V1 does not need to deliver:

- direct Readex integration
- full public archive publishing
- finished historical orthography normalization automation
- fully automated high-quality translation
- advanced stylometric authorship attribution

## 2. Product Context and Constraints

### 2.1 Source Reality

The system must handle multiple archive modalities:

- Readex: manual download source for now
- Ibali: issue-level metadata plus downloadable transcription files and text
- NLSA: issue/page-level metadata plus PDFs and OCR text
- Wits: supplementary archive source with public metadata, record pages, and some downloadable files/digital objects

The system must not assume that all sources behave the same way.

### 2.2 Core Scholarly Principles

- preserve original source files unchanged
- preserve original orthography
- separate original text from corrected and normalized text
- separate translation from interpretation
- expose uncertainty rather than hide it
- preserve provenance across all text layers

### 2.3 Technical Constraints

- frontend stack: Next.js
- database/auth/storage: Supabase
- hosting: Vercel
- code hosting: GitHub
- heavy processing should be designed to run asynchronously and not depend on a single synchronous request lifecycle

### 2.4 Business / Operating Constraints

- the platform is intended for noncommercial scholarly use
- the client has a team and requires multi-user access
- the client will manually acquire Readex materials unless permissions change

## 3. Features

Each feature below is defined so it can later be extracted directly into `feature_list.json`.

### F001 — Authentication and Role-Based Access

- Category: core
- Priority: P0
- Day: 1

Description:
Create a secure multi-user authentication and role system using Supabase so the platform can support a super admin, future project admins, and team members with controlled permissions.

Test steps:
1. Sign in as the initial super admin using the configured authentication flow.
2. View a protected application area that is inaccessible to unauthenticated users.
3. Create or promote another user to an elevated admin role from the admin interface.
4. Sign in as a non-admin user and confirm restricted admin actions are hidden or blocked.
5. Sign out and confirm protected routes redirect back to authentication.

### F002 — Project and Team Management

- Category: core
- Priority: P0
- Day: 1

Description:
Allow a super admin or project admin to create a research project workspace and manage the project team so Panashe can later add her own people without developer intervention.

Test steps:
1. Create a new project workspace with a title and basic project metadata.
2. Invite or add a team member to the project.
3. Assign a project role to the added team member.
4. View the team roster for the project and confirm the member appears with the correct role.
5. Remove or change a team member role and confirm the update is reflected immediately.

### F003 — Manual Archive Upload Intake

- Category: core
- Priority: P0
- Day: 1

Description:
Provide a manual upload workflow for archive materials, especially Readex downloads, so researchers can upload source files into the platform and stop relying on loose folder structures.

Test steps:
1. Upload a supported source file such as a PDF or document file through the intake interface.
2. Enter required metadata fields during upload, including source archive, publication, language, and date where available.
3. Confirm the file is stored successfully and linked to a newly created record.
4. Confirm the platform preserves the original uploaded file without overwriting it.
5. Reopen the created record and verify that the uploaded source file and entered metadata are visible.

### F004 — Upload Metadata Enforcement and File Naming

- Category: core
- Priority: P0
- Day: 1

Description:
Enforce a structured naming and metadata workflow at intake so file organization no longer depends on manual human naming conventions.

Test steps:
1. Start a file upload and attempt to continue without filling required metadata fields.
2. Confirm the system blocks completion until required metadata is supplied.
3. Complete the upload with valid metadata.
4. Confirm the system applies a consistent generated naming convention to the stored file or record.
5. Confirm the stored record shows both the original source details and the normalized internal naming outcome.

### F005 — Canonical Record Creation

- Category: core
- Priority: P0
- Day: 1

Description:
Create a canonical internal record model that stores source provenance, metadata, and linked text/file layers regardless of whether a record came from manual upload or programmatic import.

Test steps:
1. Create a record through manual upload.
2. Confirm the record stores the source archive, source identifier or upload source, publication, language, and date if provided.
3. Confirm the record stores linked file assets separately from text-layer content.
4. Reopen the record and verify provenance information is still visible and unchanged.
5. Confirm the record can be updated with additional linked text layers without replacing the original source file.

### F006 — Ibali Source Integration

- Category: core
- Priority: P0
- Day: 2

Description:
Implement read-only integration for UCT Ibali so the system can fetch issue metadata and linked transcription files/text from publicly accessible Ibali records.

Test steps:
1. Query the Ibali integration using a known issue such as an Isigidimi record.
2. Confirm the platform retrieves issue-level metadata from the Ibali API.
3. Confirm the platform retrieves or stores linked transcription file references from the Ibali media records.
4. Confirm extracted transcription text from the Ibali media payload is captured into the record workflow.
5. Confirm the imported record is saved as a canonical internal record with source provenance marked as Ibali.

### F007 — NLSA Source Integration

- Category: core
- Priority: P0
- Day: 2

Description:
Implement read-only integration for NLSA so the system can fetch relevant newspaper records, store file references or downloaded source files, and capture OCR text where exposed.

Test steps:
1. Query the NLSA integration using a known collection such as Imvo Zabantsundu.
2. Confirm the platform retrieves item metadata from the NLSA ContentDM endpoints.
3. Confirm the platform retrieves or stores the linked source PDF reference for a selected item.
4. Confirm OCR text exposed by NLSA is captured into the record workflow as a source text layer.
5. Confirm the imported record is saved as a canonical internal record with source provenance marked as NLSA.

### F008 — Wits Supplementary Source Intake

- Category: secondary
- Priority: P1
- Day: 2

Description:
Support Wits as a supplementary archive source through public metadata harvesting and selective record/file ingestion where relevant materials are available.

Test steps:
1. Search or harvest Wits metadata for a Panashe-relevant query such as Imvo or newspaper.
2. Confirm the platform can store Wits record metadata as a source-linked record or discovery entry.
3. Where a downloadable file or digital object is publicly available, import or link that file into the record.
4. Confirm the record is marked as a Wits-derived supplementary source rather than a primary structured newspaper source.
5. Confirm Wits records can still participate in search and filtering inside the platform.

### F009 — Source File Viewer

- Category: core
- Priority: P0
- Day: 2

Description:
Provide a record view where researchers can open and inspect original source files such as PDFs or linked archive files directly inside the platform.

Test steps:
1. Open a record that has an attached or linked source file.
2. View the source file inside the application without downloading it first.
3. Navigate back to the record metadata without losing context.
4. Confirm that source provenance remains visible while viewing the source.
5. Confirm the viewer works for at least one uploaded file and one imported source-linked file.

### F010 — OCR and Source Text Acquisition Layer

- Category: core
- Priority: P0
- Day: 2

Description:
Support source text acquisition by storing archive-supplied OCR where available and running text extraction/OCR workflows where needed so every record can begin a transcription workflow.

Test steps:
1. Open a record imported from a source that already exposes OCR or extracted text.
2. Confirm the source text is stored as a distinct text layer rather than merged into corrected transcription.
3. Upload or select a record that requires OCR or text extraction.
4. Run the text acquisition process and confirm a source text layer is created.
5. Confirm the record clearly distinguishes the source-acquired text layer from later corrected text layers.

### F011 — Text Layer Management

- Category: core
- Priority: P0
- Day: 2

Description:
Support multiple linked text layers per record so original OCR, source transcription, corrected transcription, normalized orthography, machine translation, and corrected translation remain distinct.

Test steps:
1. Open a record with at least one source text layer.
2. Add a second text layer for corrected transcription or corroborating transcription.
3. Confirm the system stores the two text layers separately.
4. View both text layers and confirm their labels, provenance, and status are visible.
5. Confirm updating one text layer does not overwrite the other.

### F012 — Transcription Editor and Review Status

- Category: core
- Priority: P0
- Day: 3

Description:
Provide a transcription editing workflow so researchers can correct OCR or imported text and move the transcription through review states.

Test steps:
1. Open a record with a source text layer and enter transcription edit mode.
2. Save a corrected transcription as a distinct text layer or updated working transcription.
3. Mark the transcription with a status such as reviewed or needs expert review.
4. Reopen the record and confirm the corrected transcription persists with its status.
5. Confirm the original source-acquired text layer is still preserved separately.

### F013 — Machine Translation Draft Generation

- Category: core
- Priority: P0
- Day: 3

Description:
Generate a machine translation draft from a chosen transcription layer so the translation workflow can begin inside the platform.

Test steps:
1. Select a record with an eligible transcription layer.
2. Trigger machine translation draft generation.
3. Confirm a machine translation text layer is created and linked to the source transcription.
4. Confirm the machine translation is clearly labeled as a draft.
5. Confirm the record keeps the translation layer separate from both transcription and annotation layers.

### F014 — Translation Editor and Correction Workflow

- Category: core
- Priority: P0
- Day: 3

Description:
Allow a translator or researcher to review and correct machine translation drafts while preserving the original machine output and the corrected version separately.

Test steps:
1. Open a machine translation draft for a record.
2. Edit the draft and save a corrected translation.
3. Confirm the corrected translation is stored with author and timestamp context.
4. Confirm the original machine translation draft remains preserved separately.
5. Reopen the record and verify both translation versions are still accessible.

### F015 — Translation Memory

- Category: core
- Priority: P0
- Day: 3

Description:
Store approved translation corrections so future similar passages can reuse or suggest prior translations instead of repeating work from scratch.

Test steps:
1. Save a corrected translation for a record.
2. Open another record with the same or closely matching source text segment.
3. Trigger translation generation or review for that record.
4. Confirm the system surfaces a prior corrected translation suggestion or reuse alert.
5. Confirm the user can accept, reject, or edit the suggested reused translation.

### F016 — Protected-Term and Glossary Rules

- Category: core
- Priority: P0
- Day: 3

Description:
Allow the team to define protected terms and terminology rules so historically important words are preserved, flagged, or translated consistently.

Test steps:
1. Create a protected-term rule for a key concept or term.
2. Mark the rule with a behavior such as do not translate, always flag, or approved translation.
3. Open a record containing that term.
4. Confirm the term is handled according to the configured rule inside the translation workflow.
5. Confirm the rule can be edited later without deleting the underlying record text.

### F017 — Scholarly Side-by-Side Reader

- Category: core
- Priority: P0
- Day: 4

Description:
Provide a synchronized reading interface that shows source file, transcription, translation, and notes together so researchers can work across layers without leaving the record context.

Test steps:
1. Open a record that has a source file, transcription, and translation.
2. View the source file and text layers side by side in the reader.
3. Confirm a user can switch between or compare available text layers.
4. Confirm notes or annotations are visible in the same research context.
5. Confirm the reader remains usable on a standard laptop viewport without breaking layout.

### F018 — Annotation and Notes

- Category: core
- Priority: P0
- Day: 4

Description:
Allow researchers to attach notes and annotations to records and text layers so historical context, euphemisms, names, and disputes can be documented in the platform.

Test steps:
1. Open a record and add a note or annotation.
2. Link the note to the relevant record or text-layer context.
3. Save the note with author attribution.
4. Reopen the record and confirm the note is still visible.
5. Edit the note and confirm the updated version persists correctly.

### F019 — Uncertainty and Dispute Flags

- Category: secondary
- Priority: P1
- Day: 4

Description:
Allow records or text segments to be explicitly marked as illegible, uncertain, disputed, or needing expert review.

Test steps:
1. Open a record or text layer and apply an uncertainty or dispute flag.
2. Save the flagged state.
3. Reopen the record and confirm the flag is visible in context.
4. Filter or search for flagged records and confirm the flagged record appears.
5. Update or clear the flag and confirm the change is reflected.

### F020 — Search and Filter

- Category: core
- Priority: P0
- Day: 4

Description:
Provide search and filtering across records so researchers can find materials by source, publication, language, date, term, and workflow status.

Test steps:
1. Search for a known term that exists in at least one imported or uploaded record.
2. Confirm matching records are returned.
3. Apply filters such as source archive, language, or date.
4. Confirm the result set updates correctly when filters are applied.
5. Open a result and confirm the user lands in the correct record context.

### F021 — Citation Packet Export

- Category: secondary
- Priority: P1
- Day: 5

Description:
Generate a research-ready citation packet for a record so researchers can export source, metadata, text, and notes in a structured way.

Test steps:
1. Open a record with source metadata, transcription, and translation.
2. Trigger citation packet generation.
3. Confirm the export includes source details, publication, date, and record metadata.
4. Confirm the export includes the relevant text layers and/or notes.
5. Confirm the export downloads or opens successfully in the expected format.

### F022 — Corpus Trend View

- Category: secondary
- Priority: P1
- Day: 5

Description:
Provide a basic corpus view that helps researchers see how a term or concept appears across time, publication, language, or source.

Test steps:
1. Open the corpus trend view for a known term present in multiple records.
2. Confirm the system groups or visualizes the term across at least one dimension such as date or publication.
3. Change a filter such as source or language.
4. Confirm the trend view updates accordingly.
5. Open one underlying record from the trend view and confirm navigation works.

### F023 — Related Text Suggestions

- Category: polish
- Priority: P2
- Day: 5

Description:
Suggest related records based on shared terms, source context, or textual similarity so researchers can discover nearby material.

Test steps:
1. Open a record that has enough text or metadata to support related suggestions.
2. View the related records section.
3. Confirm at least one suggested related record is shown.
4. Open a suggested record and confirm it is relevant by shared context, term, or source relationship.
5. Return to the original record and confirm the related suggestions remain available.

### F024 — Admin Record Audit and Activity Trace

- Category: secondary
- Priority: P1
- Day: 5

Description:
Provide basic administrative visibility into uploads, imports, edits, and workflow actions so the platform remains manageable for a multi-user team.

Test steps:
1. Perform several actions such as upload, edit, annotation, and translation correction on one or more records.
2. Open the admin audit or activity view.
3. Confirm the recent actions appear with user and timestamp context.
4. Filter or inspect a specific record’s activity history.
5. Confirm the audit information helps identify who changed what and when.

## 4. Non-Functional Requirements

### 4.1 Security

- authenticated access required for protected areas
- role-based access control enforced on sensitive admin actions
- provenance and data integrity must be preserved

### 4.2 Performance

- record pages should remain usable with large text payloads
- ingestion and processing should be asynchronous where needed
- search should feel responsive for v1-scale data

### 4.3 Data Integrity

- original source files must remain preserved
- text layers must remain distinct
- source provenance must not be lost during correction or translation

### 4.4 Usability

- interface should support long-form reading and review
- metadata should be clear and legible
- upload and workflow state should be obvious to nontechnical team members

## 5. Out of Scope for V1

- direct Readex API integration
- public archive launch
- advanced orthography automation
- fully automated scholarly-quality translation
- stylometric attribution tooling
- institutional preservation packaging

## 6. Success Criteria

V1 is successful if:

- Panashe’s team can upload Readex materials into the system without relying on Google Drive as the working source of truth
- the platform can ingest usable material from Ibali and NLSA
- Wits can be included as a supplementary source where useful
- records preserve source files, text layers, and provenance
- researchers can transcribe, translate, annotate, search, and review inside one system
- corrected translations begin to improve future work through translation memory

## 7. Open Questions for Post-PRD Work

- final product name
- final design system and tokens
- exact v1 role taxonomy names
- exact naming convention format
- first implementation milestone grouping
