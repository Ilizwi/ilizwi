import { PDFParse } from "pdf-parse";

export type ExtractSuccess = { ok: true; text: string };
export type ExtractFailure =
  | { ok: false; reason: "unsupported_mime_type" }
  | { ok: false; reason: "empty_content" }
  | { ok: false; reason: "parse_error" };
export type ExtractResult = ExtractSuccess | ExtractFailure;

export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string | null
): Promise<ExtractResult> {
  if (!mimeType || mimeType !== "application/pdf") {
    return { ok: false, reason: "unsupported_mime_type" };
  }

  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = (result.text ?? "").trim();
    if (!text) return { ok: false, reason: "empty_content" };
    return { ok: true, text };
  } catch (err) {
    // Log internally; never surface raw parser error to caller
    console.error("[text-extractor] pdf-parse error:", err);
    return { ok: false, reason: "parse_error" };
  }
}
