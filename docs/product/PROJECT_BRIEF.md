# Project Brief

Last updated: 2026-03-12

## Project name

Working name: `panashe-software`

No final client-facing product name has been selected yet.

## Client

- Primary client: **Dr. Panashe Chigumadzi**
- Project identity used in the materials: **Archive of Indigenous Intellectual Traditions (AIIT)**
- Related institutional context in the proposal:
  - Johannesburg Institute for Advanced Study (JIAS), University of Johannesburg
  - AU ECOSOCC as commissioning body for the broader report context

## What we were asked to help build

The client wants a software system to support research on 19th-century South African and related African-language newspapers. The long-term vision is a rich digital archive. The short-term need is a research system that reduces manual archival and linguistic workflow.

The system should help the client and research assistants:

- gather material from multiple archival repositories
- preserve original source documents
- create or manage transcriptions
- support translations that respect historical language use
- annotate historically specific terms, euphemisms, names, and disputes
- search across the growing corpus
- organize research materials consistently
- generate research-ready outputs and reports

## Product vision

The end-state vision is broader than a simple archive viewer. The desired system is a specialized digital humanities platform with:

- source document preservation
- searchable text layers
- translation layers
- annotation and scholarly interpretation
- terminology controls
- corpus analysis and reporting

The client frequently compares the desired user experience to a newspaper archive, but with substantially more scholarly depth:

- original scan or PDF
- transcription
- translation
- editorial notes
- orthography/context explanations
- future thematic and authorial analysis

## Key research principles from the client

These principles are central and should shape the product:

- preserve original orthography
- do not flatten historically specific terms into modern assumptions
- keep translation literal where possible
- separate translation from interpretation
- allow explanations, disputes, and uncertainty to remain visible
- support concept-focused study, not just document storage

## Current mandate

As of the follow-up call on **2026-03-11**, the realistic mandate is:

- proceed even if Readex cannot be integrated directly
- allow the team to continue using Readex manually
- build a system that handles the heavy lifting after materials are obtained
- pursue integrations with other archive sources where technically possible

## Current product framing

The first viable product is:

- an **internal research ingestion and analysis system**
- not yet a public archive
- not yet a universal live archive connector
- not dependent on Readex integration

## Manual vs automated operating model

### Manual tasks that remain with the client team

- search Readex
- choose what to download
- download files from Readex
- upload or feed those files into the system
- review OCR/transcription quality
- review and correct translations
- add scholarly annotations and context

### Tasks the system should automate

- intake and storage of uploaded files
- metadata capture and enforcement
- file naming normalization
- OCR and text extraction where needed
- indexing and search
- duplicate detection
- source tracking
- report and citation packet generation
- translation memory reuse
- optional programmatic ingestion from non-Readex sources

## “Wow factor” features explicitly desired

The following were identified as desirable high-value features even though they were not part of the original narrow ask:

1. **Scholarly Side-by-Side Reader**
   - original scan/PDF
   - transcription
   - translation
   - notes in one synchronized view

2. **Protected-Term / Concept Lens**
   - preserve specific concepts or terms
   - enforce “do not translate” or approved translation rules
   - flag historically important terms across the corpus

3. **Translation Memory With Reuse Alerts**
   - store corrected translations
   - reuse them when similar text appears later
   - improve future translation drafts

4. **Uncertainty / Dispute Flags**
   - illegible
   - uncertain
   - disputed
   - needs expert review

5. **Automatic Citation Packet**
   - create research-ready item summaries with citation details and relevant text layers

6. **Corpus Trend View**
   - show how terms appear across time, publication, geography, language, and source

7. **Related Text Suggestions**
   - suggest similar articles or passages by term, context, or wording

## Translation improvement requirement

The client wants a system that gets better over time. The intended pattern is:

- machine translation creates an initial draft
- human translator corrects it
- system stores the correction
- future similar passages reuse or suggest those corrections
- earlier draft translations can later be revisited in a second sweep

This should be implemented as a combination of:

- translation memory
- glossary and protected-term rules
- versioned retranslation suggestions

## Important scope discipline

The client has a large long-term vision, but the current implementation should stay grounded in the present mandate. The product should not be scoped as:

- a fully automated archive-wide scraper
- a full public-facing archive launch
- a guaranteed Readex integration
- a finished historical normalization engine
- a reliable fully automated scholarly translator

## Current recommendation

Proceed only on the basis of the current narrowed model:

- Readex is manual for now
- other archive integrations are conditional on testing
- the system focuses on intake, processing, organization, search, translation support, and scholarly workflow

That version of the project is feasible and worth documenting/building.
