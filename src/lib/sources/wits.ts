// Wits OAI-PMH adapter — metadata only, no credentials required

import { XMLParser } from "fast-xml-parser";

const WITS_OAI_BASE = "https://researcharchives.wits.ac.za/;oai";
const FETCH_TIMEOUT_MS = 10_000;

// --- Error types ---
export type WitsErrorType = "not_found" | "timeout" | "network" | "parse_error";
export type WitsError =
  | { type: "not_found" }
  | { type: "timeout" }
  | { type: "network"; message: string }
  | { type: "parse_error"; message: string };

export type WitsFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: WitsError };

// --- Mapped output shape ---
export type MappedWitsItem = {
  title: string;
  date_raw: string | null;       // verbatim dc:date string from source — NEVER rewritten
  date_extracted: string | null; // YYYY-MM-DD synthesised value for date_issued column
  language: string | null;
  description: string | null;
  oai_identifier: string;        // normalised canonical form (always includes :443:)
  landing_url: string | null;    // first https:// landing-page URL from dc:identifier (not a file URL)
  file_url: string | null;       // only set if dc:identifier contains a file-extension URL
};

// --- OAI identifier validation and normalisation ---
// The Wits OAI endpoint advertises two equivalent identifier shapes:
//   Short:  oai:researcharchives.wits.ac.za:{id}          (from Identify sampleIdentifier)
//   Long:   oai:researcharchives.wits.ac.za:443:{id}      (from GetRecord header response)
// Both are accepted as input. Both are normalised to the long (:443:) form before
// storage — that is the canonical form the server itself returns.
const WITS_SHORT_PATTERN = /^oai:researcharchives\.wits\.ac\.za:(?!443:)(.+)$/;
const WITS_LONG_PATTERN  = /^oai:researcharchives\.wits\.ac\.za:443:.+$/;

export function validateWitsRef(ref: string): boolean {
  return WITS_LONG_PATTERN.test(ref) || WITS_SHORT_PATTERN.test(ref);
}

// Normalise to the canonical long form. Idempotent on already-long identifiers.
export function normalizeWitsRef(ref: string): string {
  const short = ref.match(WITS_SHORT_PATTERN);
  if (short) return `oai:researcharchives.wits.ac.za:443:${short[1]}`;
  return ref; // already long form
}

// --- Field normalisation helpers ---
// OAI-DC fields may arrive as a single value OR an array from fast-xml-parser.

function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function toStringOrNull(v: unknown): string | null {
  if (Array.isArray(v)) return typeof v[0] === "string" && v[0].trim() ? v[0].trim() : null;
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

// --- Date extraction (provenance invariant) ---
// date_raw is ALWAYS the verbatim dc:date string — never rewritten.
// date_extracted is synthesised for the date_issued column.
function extractDate(raw: string | null): { date_extracted: string | null } {
  if (!raw) return { date_extracted: null };
  // Try strict ISO first
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { date_extracted: raw };
  // Extract first 4-digit year
  const yearMatch = raw.match(/\d{4}/);
  if (yearMatch) return { date_extracted: `${yearMatch[0]}-01-01` };
  return { date_extracted: null };
}

// --- File and landing-page URL detection ---
// Scans dc:identifier[] for HTTP(S) URLs.
// - file_url: first entry whose last path segment has a downloadable file extension
// - landing_url: first plain HTTP(S) URL that is NOT a file-extension URL (record page link)
const FILE_EXTENSION_PATTERN = /\.(pdf|jpg|jpeg|png|tiff|tif)$/i;

function extractUrls(identifiers: string[]): { file_url: string | null; landing_url: string | null } {
  let file_url: string | null = null;
  let landing_url: string | null = null;
  for (const id of identifiers) {
    if (!id.startsWith("http://") && !id.startsWith("https://")) continue;
    const lastSegment = id.split("/").pop() ?? "";
    if (FILE_EXTENSION_PATTERN.test(lastSegment)) {
      if (!file_url) file_url = id;
    } else {
      if (!landing_url) landing_url = id;
    }
  }
  return { file_url, landing_url };
}

// --- OAI-DC mapper ---
function mapOaiDcRecord(
  dc: Record<string, unknown>,
  oaiIdentifier: string
): MappedWitsItem {
  const title = toStringOrNull(dc["dc:title"]) ?? "(untitled)";
  const date_raw = toStringOrNull(dc["dc:date"]);
  const { date_extracted } = extractDate(date_raw);
  const language = toStringOrNull(dc["dc:language"]);
  const description = toStringOrNull(dc["dc:description"]);
  const identifiers = toStringArray(dc["dc:identifier"]);
  const { file_url, landing_url } = extractUrls(identifiers);

  return {
    title,
    date_raw,
    date_extracted,
    language,
    description,
    oai_identifier: oaiIdentifier,
    landing_url,
    file_url,
  };
}

// --- Fetch function ---
export async function fetchWitsItem(
  oaiId: string
): Promise<WitsFetchResult<MappedWitsItem>> {
  const url = `${WITS_OAI_BASE}?verb=GetRecord&identifier=${encodeURIComponent(oaiId)}&metadataPrefix=oai_dc`;

  let responseText: string;
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    responseText = await response.text();
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return { ok: false, error: { type: "timeout" } };
    }
    return {
      ok: false,
      error: {
        type: "network",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }

  let parsed: Record<string, unknown>;
  try {
    const parser = new XMLParser({ ignoreAttributes: false, isArray: () => false });
    parsed = parser.parse(responseText) as Record<string, unknown>;
  } catch (err) {
    return {
      ok: false,
      error: {
        type: "parse_error",
        message: err instanceof Error ? err.message : "XML parse failed",
      },
    };
  }

  // Check for OAI error element
  const oaiPmh = parsed["OAI-PMH"] as Record<string, unknown> | undefined;
  if (!oaiPmh) {
    return {
      ok: false,
      error: { type: "parse_error", message: "Unexpected XML structure: missing OAI-PMH root" },
    };
  }

  if (oaiPmh["error"]) {
    return { ok: false, error: { type: "not_found" } };
  }

  // Navigate to oai_dc:dc metadata
  let dc: Record<string, unknown> | undefined;
  try {
    const getRecord = oaiPmh["GetRecord"] as Record<string, unknown>;
    const record = getRecord["record"] as Record<string, unknown>;
    const metadata = record["metadata"] as Record<string, unknown>;
    dc = metadata["oai_dc:dc"] as Record<string, unknown>;
  } catch {
    return {
      ok: false,
      error: { type: "parse_error", message: "Could not navigate to oai_dc:dc in response" },
    };
  }

  if (!dc) {
    return {
      ok: false,
      error: { type: "parse_error", message: "oai_dc:dc element not found in response" },
    };
  }

  const mapped = mapOaiDcRecord(dc, oaiId);
  return { ok: true, data: mapped };
}
