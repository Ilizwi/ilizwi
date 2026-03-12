# Sources and Integrations

Last updated: 2026-03-12

This document separates:

- confirmed current understanding
- reported but still unverified details
- next actions for technical validation

## Summary table

| Source | Current position | Integration status |
|---|---|---|
| Readex | Manual acquisition source only | No direct integration assumed |
| UCT Ibali | Confirmed public API access for relevant issue/transcription records | Public read path confirmed; deeper collection mapping still useful |
| Wits Historical Papers | Confirmed public metadata and browse access; partial digital-object access | Supplementary source; not a clean REST-style archive API |
| NLSA ContentDM | Confirmed public API access for relevant issue/PDF/OCR records | Strong programmatic source confirmed |
| UCT Emandulo | Potentially useful but less certain | Secondary / validate later |
| UKZN | Mentioned as marginal source | Unvalidated |
| UNISA | Mentioned as marginal source | Unvalidated |

## 1. Readex

### Current truth

Readex should currently be treated as **not programmatically integrated**.

The working assumption based on prior research and client discussions is:

- no direct self-service public API
- text/data mining handled through internal tools or custom permissions
- any exception is case-by-case
- access usually tied to institutional subscription or formal permission

### Practical operating model

- researchers search Readex manually
- researchers download permitted materials manually
- materials are uploaded into the platform

### Important note

Future sessions should not assume a simple API-key-based Readex integration exists. If written permission is later obtained, that becomes a new decision and should be documented before implementation planning changes.

### Reported contact paths

- customer service / permissions paths were reported in prior research
- if future work depends on Readex access, confirm current contacts and policy directly before building anything around it

### Current outreach status

- a permissions / research-access email has now been sent on the client’s behalf
- response pending

## 2. UCT Ibali

### Reported details

- URL: `https://ibali.uct.ac.za/`
- platform reportedly uses **Omeka S**
- reported API endpoint: `https://ibali.uct.ac.za/api`
- IIIF support has also been reported

### Live checks completed on 2026-03-12

The following were directly tested and returned successfully:

- `GET https://ibali.uct.ac.za/api`
- `GET https://ibali.uct.ac.za/api/items?pretty_print=1&page=1&per_page=1`
- `GET https://ibali.uct.ac.za/api/media?pretty_print=1&page=1&per_page=1`
- `GET https://ibali.uct.ac.za/api/items/180673`
- `GET https://ibali.uct.ac.za/api/media/180674`

Observed results:

- API root is publicly reachable
- public item JSON is returned
- public media JSON is returned
- the exact `Isigidimi sama-Xosa 1870-10-01` item shown by the client is publicly retrievable as API item `180673`
- that item includes issue-level metadata such as title, identifier, date issued, issue number, volume number, and editor link
- linked media records are downloadable `.docx` files, for example `ISIG_1870-10-01_p005.docx`
- Ibali media payloads include `extracttext:extracted_text`, meaning the transcribed text is exposed through the API metadata as well
- a login route exists at `/login`
- no self-service registration route was found at `/register`
- a forgot-password route is linked from the login page

### Current confidence

High that public read access exists for at least some resources. Medium-high for broader project usefulness until more collection-specific testing is done.

### What this means for the project

Ibali is a strong fit for the client’s corroborating-transcription workflow. It appears to provide:

- issue-level metadata
- downloadable transcription files
- extracted transcription text through the API

It does **not** yet appear, from these tests alone, to function as the primary source of original scanned page images in the same way as Readex or NLSA.

### Suggested next validation

- test whether public records are reachable through `/api`
- confirm whether authentication is required for useful access
- confirm whether there are rate or access controls
- confirm what item metadata and media URLs are actually returned

### Reported contact

- `dls@uct.ac.za`

## 3. Wits Historical Papers Research Archive

### Reported details

- URL: `https://www.wits.ac.za/historicalpapers/`
- platform reportedly uses **AtoM**
- research supplied after the follow-up call says AtoM may support REST access if enabled

### Current confidence

High for public metadata harvesting and browse access. Medium for consistent file/digital-object extraction across all relevant materials.

### Live checks completed on 2026-03-12

The following were directly tested:

- `GET https://researcharchives.wits.ac.za/`
- `GET https://researcharchives.wits.ac.za/index.php/user/login`
- `GET https://researcharchives.wits.ac.za/index.php/user/register`
- `GET https://researcharchives.wits.ac.za/api/`
- `GET https://researcharchives.wits.ac.za/index.php/api/`

Observed results:

- public archive site is reachable
- login page exists
- no self-service registration route was found at the tested registration path
- tested `/api` paths returned `404 not found`
- no public REST-style JSON API endpoint has been confirmed
- public OAI-PMH endpoint exists at `https://researcharchives.wits.ac.za/index.php/;oai?verb=Identify`
- OAI-PMH supports at least `oai_dc`
- `ListSets` works and returns public set/collection metadata
- direct record pages are publicly accessible
- search and browse work publicly and return real record pages
- at least some record pages expose downloadable PDFs, uploaded finding aids, EAD/XML exports, and public digital-object files/images
- public search results include Panashe-relevant records such as `Imvo Zabantsundu` clippings/copies
- based on current tests, Wits behaves more like a broad archival repository with selective digital objects than a structured newspaper archive like NLSA

### What this means for the project

Wits is a real and usable source, but its role is likely supplementary:

- strong for public metadata harvesting
- usable for public record discovery
- usable for at least some downloadable files and digital objects
- less clean and uniform than Ibali or NLSA for newspaper-style ingestion

Current implementation position:

- Wits does not need to block project start
- it should be treated as a supplementary source in v1
- it can be incorporated through metadata harvesting plus selective record/file ingestion where relevant

### Suggested next validation

- identify which Wits collections are actually relevant to Panashe’s archive scope
- determine whether there is a stable machine-readable route from search results to digital objects at scale
- determine whether a richer export path exists beyond OAI-PMH and record-page scraping
- confirm whether Wits offers any recommended technical access for sustained academic use

### Reported contact

- `archives.library@wits.ac.za`

## 4. National Library of South Africa (NLSA)

### Reported details

- URL: `https://cdm21048.contentdm.oclc.org/`
- platform uses **OCLC ContentDM**
- prior research strongly suggested this is the best candidate for direct integration
- later research note also referenced ContentDM API-style access

### Current confidence

High that the platform is a strong candidate. Medium until project-specific testing confirms what data is actually retrievable.

### Live checks completed on 2026-03-12

The following were directly tested and returned successfully:

- `GET https://cdm21048.contentdm.oclc.org/digital/bl/dmwebservices/index.php?q=dmGetCollectionList/json`
- `GET https://cdm21048.contentdm.oclc.org/digital/api/singleitem/collection/p21048coll37/id/1`
- `GET https://cdm21048.contentdm.oclc.org/utils/getfile/collection/p21048coll37/id/1/filename/2.pdf`

Observed results:

- ContentDM webservices endpoint is publicly reachable
- JSON collection data is returned without authentication for this endpoint
- public collection aliases and names are visible
- `Imvo Zabantsundu` collection is publicly visible as `p21048coll37`
- item-level records can be fetched directly through the ContentDM item API
- item payloads include downloadable PDF links, IIIF/image paths, and OCR text snippets
- OCR text is present but noisy, which matches the client’s description of NLSA as useful but lower quality
- NLSA also exposes at least one Sotho-language newspaper collection, `Lentsoe la Basotho` (`p21048coll77`), with downloadable PDFs and OCR text

### Suggested next validation

- verify item listing endpoints
- verify file/media retrieval behavior
- verify OCR/text availability on real items
- verify pagination/rate behavior
- verify whether collection restrictions exist

### Reported contact

- `info@nlsa.ac.za`
- `infodesk@nlsa.ac.za`

## 5. UCT Emandulo

### Current position

Useful for context, but currently less certain than Ibali.

The project has repeatedly treated UCT transcription resources as corroborating text rather than the main master source. That should remain the assumption unless proven otherwise.

## 6. UKZN and UNISA

### Current position

Mentioned by the client as marginal or secondary sources. No technical research or testing has yet been completed in this project record.

## Integration principles

Regardless of source, all integrations should follow the same internal logic:

1. source-specific adapter retrieves material
2. adapter maps external data into canonical internal record structure
3. source files and text layers are preserved separately
4. provenance is recorded
5. source limitations are not hidden

## Source hierarchy for planning

Current planning priority should be:

1. Readex manual intake support
2. NLSA technical validation
3. Ibali technical validation
4. Wits supplementary-source integration
5. later exploration of Emandulo, UKZN, and UNISA

## Important caution for future sessions

Do not treat reported source-platform claims as fully settled until they have been tested in the actual project workflow.

In particular, future sessions should avoid turning these into implementation promises before:

- endpoint testing
- authentication testing
- data-return inspection
- policy confirmation where needed
