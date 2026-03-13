// NLSA ContentDM adapter — public API, no credentials required

const NLSA_BASE = "https://cdm21048.contentdm.oclc.org";
const FETCH_TIMEOUT_MS = 10_000;

// --- Error types ---
export type NlsaErrorType = "not_found" | "timeout" | "network";
export type NlsaError =
  | { type: "not_found" }
  | { type: "timeout" }
  | { type: "network"; message: string };
export type NlsaFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: NlsaError };

// --- Raw ContentDM shape (typed loosely) ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NlsaItem = Record<string, any>;

// --- Mapped output shape ---
export type MappedNlsaItem = {
  publication_title: string;
  date_issued: string | null;
  language: string | null;
  identifier: string | null;
  description: string | null;
};

export type NlsaFileRef = {
  pdfUrl: string;
  ocrText: string | null;
};

// --- Generic fetch ---
async function nlsaGet<T>(url: string): Promise<NlsaFetchResult<T>> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status === 404) return { ok: false, error: { type: "not_found" } };
    if (!res.ok) {
      return {
        ok: false,
        error: { type: "network", message: `HTTP ${res.status}` },
      };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === "AbortError" || err.name === "TimeoutError")
    ) {
      return { ok: false, error: { type: "timeout" } };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: { type: "network", message } };
  }
}

// Fetch a single item from ContentDM
// GET /digital/api/singleitem/collection/{alias}/id/{id}
export async function fetchNlsaItem(
  alias: string,
  id: string
): Promise<NlsaFetchResult<NlsaItem>> {
  return nlsaGet<NlsaItem>(
    `${NLSA_BASE}/digital/api/singleitem/collection/${alias}/id/${id}`
  );
}

// Map ContentDM fields to internal shape
// ContentDM field names: title, date, descri, langua, find, pointer
export function mapNlsaItem(item: NlsaItem): MappedNlsaItem {
  const title =
    typeof item["title"] === "string" && item["title"].trim()
      ? item["title"].trim()
      : "Untitled";
  const dateRaw =
    typeof item["date"] === "string" && item["date"].trim()
      ? item["date"].trim()
      : null;
  const language =
    typeof item["langua"] === "string" && item["langua"].trim()
      ? item["langua"].trim()
      : null;
  const identifier =
    typeof item["find"] === "string" && item["find"].trim()
      ? item["find"].trim()
      : null;
  const description =
    typeof item["descri"] === "string" && item["descri"].trim()
      ? item["descri"].trim()
      : null;

  return {
    publication_title: title,
    date_issued: dateRaw,
    language,
    identifier,
    description,
  };
}

// Extract PDF URL and OCR text from ContentDM item
// PDF: GET /utils/getfile/collection/{alias}/id/{id} (original file)
// OCR: item["fulltext"] field
export function extractNlsaRefs(
  alias: string,
  id: string,
  item: NlsaItem
): NlsaFileRef {
  const pdfUrl = `${NLSA_BASE}/utils/getfile/collection/${alias}/id/${id}`;
  const ocrText =
    typeof item["fulltext"] === "string" && item["fulltext"].trim()
      ? item["fulltext"].trim()
      : null;
  return { pdfUrl, ocrText };
}
