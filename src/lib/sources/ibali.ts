// Ibali adapter — Omeka S public API, no credentials required

const IBALI_BASE = "https://ibali.uct.ac.za/api";
const FETCH_TIMEOUT_MS = 10_000;

// --- Error types ---

export type IbaliErrorType = "not_found" | "timeout" | "network";

export type IbaliError =
  | { type: "not_found" }
  | { type: "timeout" }
  | { type: "network"; message: string };

export type IbaliFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: IbaliError };

// --- Raw Omeka S shapes (typed loosely) ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IbaliItem = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type IbaliMedia = Record<string, any>;

// --- Mapped output shapes ---

export type MappedIbaliItem = {
  publication_title: string;
  date_issued: string | null;
  volume: string | null;
  issue_number: string | null;
  language: string | null;
  identifier: string | null;
};

export type IbaliMediaRef = {
  originalUrl: string;
  extractedText: string | null;
};

// --- Omeka S property helper ---

export function getProp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: Record<string, any>,
  ns: string,
  prop: string
): string | null {
  const key = `${ns}:${prop}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (obj[key] as any[])?.[0]?.["@value"] ?? null;
}

// --- Fetch helpers ---

async function ibaliGet<T>(url: string): Promise<IbaliFetchResult<T>> {
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

export async function fetchIbaliItem(
  itemId: string | number
): Promise<IbaliFetchResult<IbaliItem>> {
  return ibaliGet<IbaliItem>(`${IBALI_BASE}/items/${itemId}`);
}

export async function fetchIbaliMedia(
  itemId: string | number
): Promise<IbaliFetchResult<IbaliMedia[]>> {
  return ibaliGet<IbaliMedia[]>(`${IBALI_BASE}/media?item_id=${itemId}`);
}

// --- Mapping ---

export function mapIbaliItem(item: IbaliItem): MappedIbaliItem {
  const title =
    getProp(item, "dcterms", "title") ??
    getProp(item, "o", "title") ??
    "Untitled";
  const dateRaw = getProp(item, "dcterms", "date");
  const date_issued = dateRaw ?? null;
  const volume = getProp(item, "bibo", "volume");
  const issue_number = getProp(item, "bibo", "issue");
  const language = getProp(item, "dcterms", "language");
  const identifier = getProp(item, "dcterms", "identifier");

  return {
    publication_title: title,
    date_issued,
    volume,
    issue_number,
    language,
    identifier,
  };
}

export function extractMediaRefs(media: IbaliMedia[]): IbaliMediaRef[] {
  return media
    .map((m) => {
      const originalUrl: string | null = m["o:original_url"] ?? null;
      if (!originalUrl) return null;
      const extractedText: string | null =
        getProp(m, "extracttext", "extracted_text") ?? null;
      return { originalUrl, extractedText };
    })
    .filter((ref): ref is IbaliMediaRef => ref !== null);
}
