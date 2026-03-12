# Progress Log

Last updated: 2026-03-12

This file is the running chronology of the project. Update it at the end of any meaningful research, decision, or delivery step.

## Status summary

- Phase: pre-build discovery and documentation
- Build started: no
- Client approved proceeding without Readex integration: yes
- Readex direct integration confirmed: no
- Manual Readex workflow accepted: yes
- Other source integrations validated: yes

## Chronology

### 2026-03-05 to 2026-03-06: initial project understanding

Key materials reviewed:

- client transcript describing archive vision and workflow
- research assistant agreement
- draft proposal on historical concept research and reparatory justice

Key understanding captured:

- long-term vision is a deeply annotated digital archive for African-language newspapers
- near-term need is a practical research system that reduces manual work
- product must preserve original orthography and support literal translation plus contextual explanation
- client initially hoped Readex would be the core integration source

### 2026-03-06: deep research prompt strategy prepared

Deep research prompt set was created for parallel investigation of:

- source access and permissions
- technical integration paths
- OCR / translation / orthography feasibility
- comparable projects and scoping inputs

### 2026-03-06 to 2026-03-09: research outputs synthesized

Key findings:

- Readex should not be assumed to allow direct API access
- NLSA ContentDM appears to be the strongest integration candidate
- Ibali / UCT appears promising but needs testing
- Wits was reported later as a possible AtoM-based source and needs testing
- OCR/transcription/translation pipeline is feasible only with human review
- historical orthography handling is a real scholarly requirement, not just a formatting issue

Strategic conclusion:

- the product should be framed as an internal research ingestion and analysis platform
- not as a full live-sync archive system

### 2026-03-09 to 2026-03-11: scope narrowed

Important planning position established:

- do not quote the project as a “paid pilot to discover if anything is possible”
- instead define what is possible under current source constraints
- Readex can seed the corpus through manual downloads even if no direct integration exists

Key product shift:

- manual Readex intake becomes an explicit supported workflow
- other sources may still be integrated programmatically
- heavy lifting begins after ingestion into the platform

### 2026-03-11: follow-up call with client

Important outcomes from the follow-up call:

- client is willing to proceed without Readex integration
- client wants the system to remain flexible in case Readex or another source later becomes integrable
- client clarified that different repositories offer different modalities:
  - Readex often acts as the cleanest master source
  - UCT can provide manually typed transcriptions
  - NLSA can provide scans with weaker OCR
- transcription must be explicitly included in the product scope
- system should support date-sensitive orthography logic
- system should likely replace Google Drive as the working system of record
- file naming and upload metadata should be system-enforced rather than left to manual convention

### 2026-03-12: documentation pack created

Created project documentation in `panashe-software`:

- `README.md`
- `PROJECT_BRIEF.md`
- `TECHNICAL_BRIEF.md`
- `SOURCES_AND_INTEGRATIONS.md`
- `DECISIONS_AND_OPEN_QUESTIONS.md`
- `progress.md`

Purpose:

- preserve project context across future chat compaction
- allow future Codex/Claude instances to continue work without re-deriving context

### 2026-03-12: live endpoint validation started

Direct public checks completed:

- Ibali API root responded publicly at `https://ibali.uct.ac.za/api`
- Ibali public `items` and `media` endpoints returned JSON successfully
- Ibali login page exists, but no self-service registration route was found at `/register`
- NLSA ContentDM `dmGetCollectionList/json` endpoint returned public JSON successfully
- Wits archive site is reachable, but tested `/api` routes returned `404`
- Wits login page exists, but no self-service registration route was found at the tested registration path

Working interpretation:

- Ibali can be tested further right now without waiting for email outreach
- NLSA can be tested further right now without waiting for email outreach
- Wits likely requires human confirmation before we assume any API support

### 2026-03-12: deeper source testing completed for Panashe-relevant materials

Ibali:

- confirmed the exact item from the client screenshot is publicly accessible through the API as item `180673`
- confirmed item title `Isigidimi sama-Xosa 1870-10-01`
- confirmed linked media are downloadable `.docx` transcription files
- confirmed media payloads expose extracted transcription text
- conclusion: Ibali is directly useful for the client’s transcription/corroboration workflow

NLSA:

- confirmed `Imvo Zabantsundu` collection is publicly accessible as `p21048coll37`
- confirmed item-level records expose downloadable PDFs and OCR text
- confirmed OCR is available but noisy, matching the client’s own experience
- confirmed at least one other indigenous-language newspaper collection, `Lentsoe la Basotho`, is also publicly accessible with PDF + OCR
- conclusion: NLSA is directly useful as a source of original files plus imperfect OCR text

Wits:

- confirmed public OAI-PMH metadata harvesting works
- confirmed browse/search works publicly
- confirmed direct public record pages are accessible
- confirmed some records expose downloadable PDFs, uploaded finding aids, EAD/XML exports, and public digital-object files/images
- confirmed public search returns Panashe-relevant records such as `Imvo Zabantsundu` materials
- conclusion: Wits is a real supplementary source, but not a clean structured newspaper API in the same way as Ibali or NLSA

### 2026-03-12: current operational position finalized

Current source picture:

- Readex remains manual for now
- Ibali is confirmed usable for issue metadata plus transcription files/text
- NLSA is confirmed usable for issue/page metadata plus PDFs and OCR
- Wits is confirmed usable as a supplementary source with metadata harvesting and selective public digital-object access

Project-management updates:

- Readex permissions / research-access email has been sent
- client update email and WhatsApp summary were drafted
- invoice labeling guidance was prepared
- project is now in a position where it can proceed without waiting on Wits or Readex

### 2026-03-12: execution docs prepared

Created execution-oriented project files:

- `CLAUDE.md`
- `claude-progress.txt`
- `docs/progress.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/design-system.md`
- `plan/README.md`

Purpose:

- make future small-context feature sessions safe and consistent
- provide architecture and domain-model guardrails
- support the user’s one-feature-per-session workflow

### 2026-03-12: repository structure normalized and brand direction translated

Changes made:

- moved long-lived project docs into grouped folders under `docs/`
- kept only execution-critical files in the project root
- ingested `Ilizwi_Brand_Direction.md` into the design-system layer
- created an agent-facing ILIZWI design guide
- created a design token JSON reference for future feature sessions

Result:

- future sessions now have a cleaner, more maintainable document structure
- design direction is clearer and more actionable for implementers

## Current best understanding

### Feasible now

- manual Readex uploads
- source preservation
- canonical record creation
- OCR/text extraction support
- search and metadata management
- transcription support
- translation memory workflow
- annotation and uncertainty handling
- integrations with NLSA and Ibali
- supplementary integration work against Wits metadata and public records

### Not currently safe to assume

- direct Readex API access
- guaranteed live integrations for all named archives
- fully automatic high-quality translation
- complete historical orthography normalization in v1

## Immediate next steps

1. Decide how Wits should be handled in v1: metadata-first or selective record ingestion.
2. Draft the first naming convention and upload metadata model.
3. Draft the first internal record schema.
4. Define what a first delivery would include if build starts.
5. Record the outcome of the Readex permissions request when a reply arrives.

## Notes for future sessions

- Separate confirmed facts from reported-but-untested source claims.
- Treat Readex as manual until written evidence changes that.
- Keep transcription as an explicit first-class requirement.
- Preserve the distinction between source OCR, corroborating transcription, corrected transcription, and translation layers.
