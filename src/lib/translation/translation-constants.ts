// Shared translation constants — safe to import from both client and server.
// Server-only translation logic lives in google-translate.ts (do not import that from client components).

export const TARGET_LANGUAGE_ALLOWLIST = ["en", "af", "fr", "de", "pt"] as const;
export type TargetLanguage = (typeof TARGET_LANGUAGE_ALLOWLIST)[number];

// Canonical provider display label map.
// Import from here in UI components — never hardcode inline strings.
export const PROVIDER_DISPLAY_LABELS: Record<string, string> = {
  google_cloud_translation: "Google Translate",
  claude_anthropic: "Claude (Anthropic)",
};

// Pinned for auditability — update intentionally, not automatically.
export const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
