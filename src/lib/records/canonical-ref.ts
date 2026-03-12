// canonical-ref.ts
// Pure TypeScript — no server/client directive. Shared by server action and client form preview.
// Single source of truth for canonical ref generation.

export type CanonicalRefFields = {
  source_type: string;
  publication_title: string;
  date_issued: string; // YYYY-MM-DD
  page_label?: string | null;
  volume?: string | null;
  issue_number?: string | null;
  article_label?: string | null;
};

export const MAX_COLLISION_RETRIES = 9;

// Source alias map
const SOURCE_ALIASES: Record<string, string> = {
  manual_readex: "READEX",
  ibali: "IBALI",
  nlsa: "NLSA",
  wits: "WITS",
};

// Known publication aliases (case-insensitive lookup)
const PUB_ALIASES: Record<string, string> = {
  "imvo zabantsundu": "IMV",
  "isigidimi samaxhosa": "ISIG",
  "leselinyana la basotho": "LB",
};

// Stop words to remove during fallback normalization
const STOP_WORDS = new Set([
  "la", "le", "les", "the", "a", "an", "of", "de", "du",
  "der", "die", "das", "van", "y",
]);

/**
 * Normalize a publication title to a short uppercase alias.
 * Used when the title is not in the known PUB_ALIASES map.
 *
 * Algorithm:
 * 1. NFD normalize, remove combining marks
 * 2. Remove non-alphanumeric, non-space chars
 * 3. Lowercase, split into words
 * 4. Remove stop words
 * 5. Take first remaining word, uppercase, truncate to 4 chars
 * 6. If < 2 chars: use first 4 chars of step-2 result
 * 7. If still empty: return "PUB"
 */
function normalizePubTitle(title: string): string {
  // Step 1: NFD + strip combining marks
  const nfd = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // Step 2: remove non-alphanumeric, non-space
  const cleaned = nfd.replace(/[^a-zA-Z0-9 ]/g, "");
  // Step 3: split into words, lowercase
  const words = cleaned.toLowerCase().split(/\s+/).filter(Boolean);
  // Step 4: remove stop words
  const meaningful = words.filter((w) => !STOP_WORDS.has(w));
  // Step 5: first word, uppercase, truncate to 4
  const first = meaningful[0];
  if (first && first.length >= 2) {
    return first.slice(0, 4).toUpperCase();
  }
  // Step 6: fallback to first 4 chars of cleaned
  const fallback = cleaned.replace(/\s/g, "").slice(0, 4).toUpperCase();
  if (fallback.length >= 2) return fallback;
  // Step 7: last resort
  return "PUB";
}

function resolveSourceAlias(sourceType: string): string {
  return SOURCE_ALIASES[sourceType] ?? sourceType.slice(0, 6).toUpperCase();
}

function resolvePubAlias(publicationTitle: string): string {
  const key = publicationTitle.trim().toLowerCase();
  return PUB_ALIASES[key] ?? normalizePubTitle(publicationTitle);
}

/**
 * Generate a canonical ref for a source record.
 *
 * Format: {SOURCE}-{PUB}-{YYYY-MM-DD}[-v{vol}][-i{iss}][-p{page}][-a{article}]
 *
 * All optional segment values are trimmed and lowercased.
 *
 * Example:
 *   generateCanonicalRef({ source_type: "manual_readex", publication_title: "Imvo Zabantsundu",
 *     date_issued: "1888-01-15", page_label: "003" })
 *   // → "READEX-IMV-1888-01-15-p003"
 */
export function generateCanonicalRef(fields: CanonicalRefFields): string {
  const source = resolveSourceAlias(fields.source_type);
  const pub = resolvePubAlias(fields.publication_title);
  let ref = `${source}-${pub}-${fields.date_issued}`;

  const seg = (prefix: string, val: string | null | undefined) => {
    const v = val?.trim();
    if (v) ref += `-${prefix}${v.toLowerCase()}`;
  };

  seg("v", fields.volume);
  seg("i", fields.issue_number);
  seg("p", fields.page_label);
  seg("a", fields.article_label);

  return ref;
}

/**
 * Append a collision-disambiguation suffix.
 * Used by the server action when a unique constraint violation (23505) occurs.
 *
 * attempt=2 → "{ref}-r2"
 * attempt=9 → "{ref}-r9"
 */
export function appendCollisionSuffix(ref: string, attempt: number): string {
  return `${ref}-r${attempt}`;
}
