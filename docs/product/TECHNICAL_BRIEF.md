# Technical Brief

Last updated: 2026-03-12

## System definition

This product should be designed as a **source-agnostic archival research workbench**.

It is not currently a live sync engine for all repositories. It is a platform that:

- accepts material from different archives in different formats
- stores original source material
- builds text layers and metadata around those sources
- supports researcher review and interpretation
- improves over time through human corrections

## Core system layers

### 1. Ingestion layer

Purpose:

- accept source material from archives
- preserve provenance
- create a canonical internal record

Supported inputs should include:

- PDFs
- page images
- OCR text
- manual transcriptions
- archive metadata
- batch uploads from manual acquisition
- API-fed imports from supported repositories

### 2. Processing layer

Purpose:

- turn archive inputs into usable research objects

Functions:

- OCR when needed
- extract embedded text where available
- detect duplicates
- capture source metadata
- normalize file naming
- assign quality/status markers
- prepare searchable corpus records

### 3. Research layer

Purpose:

- support scholarly use of the material

Functions:

- transcription management
- translation drafts
- human-corrected translation storage
- annotation
- term and concept controls
- uncertainty flags
- related text discovery
- corpus views and report generation

### 4. Administration layer

Purpose:

- keep the system consistent, auditable, and usable by a team

Functions:

- user authentication
- role-based access
- batch management
- processing status tracking
- import logs
- naming convention enforcement
- export and backup support

## Canonical record model

Each item in the system should be represented as a canonical record with the following logical structure:

- `record_id`
- `source_archive`
- `source_collection`
- `source_url`
- `source_identifier`
- `import_method`
  - manual upload
  - API import
  - bulk batch import
- `publication_title`
- `language`
- `date`
- `issue`
- `page`
- `article_title` if known
- `term_focus` if relevant
- `provenance_notes`
- `rights_notes`

Associated file/text assets should be stored as separate but linked layers:

- original source file
- extracted image pages
- raw OCR text
- corroborating transcription from another repository
- corrected transcription
- normalized orthography text
- machine translation
- human-corrected translation
- annotations
- citation packet export

## Text layer strategy

Future instances should preserve the distinction between text layers. Do not collapse them.

Recommended text layers:

1. `source_ocr`
2. `source_transcription`
3. `corrected_transcription`
4. `normalized_orthography`
5. `machine_translation`
6. `corrected_translation`

Each layer should carry metadata such as:

- creator/source
- date created
- quality level
- reviewer
- confidence/status

## Quality/status flags

Each text layer or record may need these statuses:

- raw
- OCR-derived
- manually transcribed
- corroborated
- reviewed
- approved
- uncertain
- disputed
- needs expert review

## Manual Readex workflow

The current expected Readex workflow is:

1. researcher searches Readex manually
2. researcher downloads permitted files manually
3. researcher uploads files into the platform
4. platform stores, renames, indexes, and processes them

This workflow should be treated as a first-class supported path, not a temporary hack.

## Programmatic source workflow

For sources that support programmatic access:

1. system or admin configures source credentials/keys if needed
2. source adapter retrieves metadata and/or files
3. imported records are converted into canonical internal records
4. files and text layers are stored using the same internal structure as manual imports

All sources should land in the same internal model regardless of origin.

## Source modality reality

The client clarified that the repositories do not all behave the same way:

- Readex often behaves like a clean primary source with useful PDFs
- UCT can provide manually typed transcriptions that are used as corroborating data
- NLSA can provide scans plus lower-quality OCR
- other university archives may expose different combinations of images, PDFs, metadata, or text

This means ingestion must support **heterogeneous evidence**, not assume one perfect source type.

## Translation architecture

Translation should be designed as a reviewable pipeline, not a one-shot automation.

Recommended flow:

1. source text enters system
2. machine translation generates first draft
3. human translator edits
4. system stores approved correction
5. translation memory and glossary rules are updated
6. future similar passages get suggestions based on prior corrections
7. earlier drafts may enter a later retranslation review queue

Current provider decision:

- default draft generation: **Google Cloud Translation**
- planned escalation path: **Claude API**, manually triggered by the user for difficult passages

Input-layer priority for machine translation:

1. `corrected_transcription`
2. `source_transcription`
3. `source_ocr`

The system should always translate from the strongest available eligible layer and record provider/source-layer provenance on every machine-generated draft.

## Protected-term / concept architecture

The system should support term-level controls such as:

- do not translate
- preserve original form
- approved translation mapping
- always flag for review
- attach glossary note
- attach editorial explanation

These controls should be applicable by:

- language
- publication
- date range
- concept study

## Orthography strategy

The client specifically wants support for historical orthography differences across time.

This should be modeled as an editable rules framework keyed by:

- language
- period/date range
- known orthography regime

The system may later support normalization assistance, but v1 should focus on:

- preserving original text
- allowing rule-driven suggestions
- keeping normalization separate from the original layer

## Core user-facing features

### Required baseline features

- upload/import interface
- batch management
- canonical record creation
- file renaming and naming convention enforcement
- source preservation
- OCR/text extraction support
- search
- item detail pages
- transcription and translation views
- annotation support
- exports

### High-value features

- scholarly side-by-side reader
- protected-term lens
- translation memory
- uncertainty flags
- citation packet generation
- corpus trend view
- related text suggestions

## Suggested internal modules

These are conceptual modules, not implementation commitments:

- `source-adapters`
- `ingestion-service`
- `file-storage`
- `metadata-service`
- `ocr-service`
- `text-layer-service`
- `translation-service`
- `translation-memory-service`
- `annotation-service`
- `search-index`
- `reporting-service`
- `admin-console`

## Recommended design principle

The system should become the **single source of truth** for the project’s working archive.

That means:

- do not rely on Google Drive as the primary working system
- preserve original uploads but manage them inside the platform
- enforce metadata and naming at the point of ingestion
- record provenance at every step

## Technical risks to preserve in future planning

- direct Readex integration may never happen
- some archive APIs may exist but return limited or inconsistent data
- OCR quality will vary significantly by source
- manually typed transcriptions may need to coexist with OCR-derived text
- historical orthography handling is partly a scholarly workflow, not just a technical feature

Any future build plan should respect those realities.
