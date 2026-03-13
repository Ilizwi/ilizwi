// Google Cloud Translation v2 (REST, API key auth)
// No "use server" directive — this module is imported by the server action only.

export type TranslateResult =
  | { ok: true; translation: string; provider: string }
  | { ok: false; error: string };

export const PROVIDER_NAME = "google_cloud_translation";

// Canonical display label map — import from here in components, never inline
export const PROVIDER_DISPLAY_LABELS: Record<string, string> = {
  google_cloud_translation: "Google Translate",
};

// Allowlist of Google Translate API language codes relevant to this corpus.
// Source: https://cloud.google.com/translate/docs/languages
// If sourceLayer.language is null or not in this set, the `source` param is
// omitted from the API request and Google auto-detects the language.
const SUPPORTED_SOURCE_LANGS = new Set([
  "af", "zu", "xh", "st", "sn", "sw", // African languages
  "nl", "en", "fr", "de", "pt", "la", // European/colonial languages likely in corpus
]);

// Target language allowlist for V1
export const TARGET_LANGUAGE_ALLOWLIST = ["en", "af", "fr", "de", "pt"] as const;
export type TargetLanguage = (typeof TARGET_LANGUAGE_ALLOWLIST)[number];

export async function translateWithGoogle(
  text: string,
  sourceLang: string | null,
  targetLang: TargetLanguage
): Promise<TranslateResult> {
  try {
    const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Translation service is not configured." };
    }

    // Normalize source language — omit if not in allowlist (API will auto-detect)
    const resolvedSource =
      sourceLang && SUPPORTED_SOURCE_LANGS.has(sourceLang) ? sourceLang : null;

    const body: Record<string, string> = {
      q: text,
      target: targetLang,
      format: "text",
    };
    if (resolvedSource) {
      body.source = resolvedSource;
    }

    const url = `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      return {
        ok: false,
        error: `Translation API error (${response.status}): ${errorText}`,
      };
    }

    const json = await response.json();
    const translation: string | undefined =
      json?.data?.translations?.[0]?.translatedText;

    if (!translation) {
      return {
        ok: false,
        error: "Translation API returned an unexpected response format.",
      };
    }

    return { ok: true, translation, provider: PROVIDER_NAME };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `Translation request failed: ${message}` };
  }
}
