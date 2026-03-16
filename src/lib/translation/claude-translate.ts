// Claude translation wrapper — server-only.
// Do NOT import this module from client components.
import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_MODEL } from "./translation-constants";

export type ClaudeTranslateResult =
  | { ok: true; translation: string }
  | { ok: false; error: string };

export const CLAUDE_PROVIDER_NAME = "claude_anthropic";

function buildSystemPrompt(targetLang: string): string {
  return `You are a scholarly translator specialising in African-language archival newspaper texts from the colonial and early post-colonial period. Your task is to produce a precise, readable translation into ${targetLang} of the provided source text.

Guidelines:
- Preserve proper nouns, place names, and personal names exactly as written in the source.
- Retain historical terminology and colonial-era vocabulary without modernising it; if a term is ambiguous or untranslatable, include the original in brackets after your rendering.
- Do not omit passages. If a segment is illegible or uncertain, mark it with [illegible] or [uncertain].
- Do not add interpretation, commentary, or editorial notes beyond the translation itself.
- Maintain the original paragraph and sentence structure where possible.
- Produce only the translation — no preamble, no explanation.`;
}

export async function translateWithClaude(
  text: string,
  sourceLang: string | null,
  targetLang: string
): Promise<ClaudeTranslateResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Claude translation service is not configured." };
    }

    const client = new Anthropic({ apiKey });

    const langHint = sourceLang
      ? `The source language is ${sourceLang}. `
      : "";

    const userMessage = `${langHint}Translate the following archival text into ${targetLang}:\n\n${text}`;

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system: buildSystemPrompt(targetLang),
      messages: [{ role: "user", content: userMessage }],
    });

    const block = response.content[0];
    if (!block || block.type !== "text" || !block.text.trim()) {
      return { ok: false, error: "Claude returned an unexpected response format." };
    }

    return { ok: true, translation: block.text.trim() };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `Claude translation request failed: ${message}` };
  }
}
