# Architecture Overview

Last updated: 2026-03-12
Status: Planning reference

## Recommended V1 Stack

- Frontend/App: `Next.js`
- Auth: `Supabase Auth`
- Database: `Supabase Postgres`
- File storage: `Supabase Storage`
- Hosting: `Vercel`
- Source control: `GitHub`

## Architectural Position

V1 should use the chosen stack for the product shell and core workflows.

Heavy or long-running processing such as OCR, batch imports, and retranslation should be designed as asynchronous work and should not be tightly coupled to a single web request lifecycle.

## High-Level Components

### 1. Web Application

Responsibilities:

- authentication
- project/team management
- upload flows
- record views
- side-by-side reader
- annotation UI
- admin tools

Likely location:

- Next.js app routes/pages and server actions or API routes where appropriate

### 2. Database Layer

Responsibilities:

- users
- projects
- memberships
- records
- metadata
- text layers
- annotations
- glossary rules
- activity logs

Likely location:

- Supabase Postgres

### 3. Storage Layer

Responsibilities:

- original source files
- imported transcription documents
- derived files
- exports

Likely location:

- Supabase Storage

### 4. Search Layer

Responsibilities:

- record-level search
- filtering by source, date, language, publication, and status
- later text-centric retrieval

V1 note:

Start with database-backed search/filter patterns where practical. Introduce a dedicated search index only when needed.

### 5. Processing Layer

Responsibilities:

- OCR/text extraction
- source import jobs
- translation draft generation
- translation memory matching
- future reprocessing jobs

V1 note:

Design this as an asynchronous subsystem, even if some operations begin in a lightweight or manually triggered form.

## Recommended Logical Flow

1. user authenticates
2. user uploads file or triggers supported source import
3. system creates canonical record
4. system stores source file and provenance
5. system creates source text layer from archive text, transcription file, or OCR pipeline
6. researchers review or correct transcription
7. machine translation is generated
8. human translator corrects translation
9. translation memory and glossary rules improve future work
10. records are searchable and annotatable throughout

## Integration Model

### Readex

- manual input only for now
- upload-driven workflow

### Ibali

- read-only structured source
- metadata + transcription files + extracted transcription text

### NLSA

- read-only structured source
- metadata + file references/PDFs + OCR text

### Wits

- supplementary source
- public metadata harvesting + selective record/file ingestion

## Deployment Model

### V1

- deploy the main app to Vercel
- use Supabase for auth/db/storage
- keep processing flows simple and intentionally modular

### Future

- add a dedicated worker service if OCR and large batch processing grow beyond light app-triggered jobs

## Key Architectural Rules

- original files are immutable
- provenance is mandatory
- text layers remain separate
- external source behavior must not be assumed uniform
- source integrations must map into one internal canonical record model

## Risks

- long-running OCR work should not be trapped inside the request/response cycle
- file storage must be organized from day one
- text-layer sprawl will become unmanageable without strict typing and status fields
- source-specific quirks can leak into product logic if not normalized through adapters
