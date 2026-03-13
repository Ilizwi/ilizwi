# F010: OCR & Source Text Acquisition Layer — Implementation Plan

**Objective:** Enable manually-uploaded PDF records to have text extracted automatically and stored as a distinct `source_ocr` text layer, completing the F010 PRD test steps.

**Architecture:** New `text-extractor.ts` utility wraps `pdf-parse`; new `extract-text.ts` server action orchestrates download → extract → insert; new `ExtractTextSection` client component renders the trigger UI on the record detail page. No schema changes.

**Tech Stack:** Next.js 15 Server Actions, `useActionState`, `pdf-parse` npm package, Supabase Storage download, existing `text_layers` schema.

---

## Context

**Completed last session (Session 9, 2026-03-13):** F009 (Source File Viewer) — merged to main as PR #8.

**Progress:** 8/24 features passing (F001–F007, F009). F008 deferred (P1). Day 2 remaining: F010, F011.

**What already works (no changes needed):**
- `text_layers` DB table with `layer_type`, `source_method`, `supersedes_layer_id`
- Types: `LayerType`, `LayerSourceMethod` (including `source_ocr`, `file_extract`)
- Ibali imports → `source_transcription` layer; NLSA imports → `source_ocr` layer (PRD steps 1–2 satisfied)
- Record detail page already renders a text_layers table distinguishing type/source/status (PRD step 5 satisfied)

**The gap (PRD steps 3–4):** Manually-uploaded PDF records have no text layer. No "run extraction" trigger exists.

---

## V1 Scope Decisions

- PDFs → `pdf-parse` synchronous extraction (fast, acceptable in server action for V1)
- Images → informational notice only, no button ("not supported in V1 — add text manually")
- **No Jest setup** — existing repo has no test runner; adding jest+ts-jest is too much surface for two helpers. Feature verified via typecheck + manual test against a real PDF.
- **No exported `blobToBuffer` helper** — inline `Buffer.from(await blob.arrayBuffer())` directly in the action; don't export trivial helpers just to test them.
- **Versioning, not idempotency** — the plan correctly uses `supersedes_layer_id` to chain layers. Added: before inserting, if an existing `source_ocr/file_extract` layer's content hash matches the new extraction, skip insert and return the existing layer ID (true no-op).
- **Sanitized errors** — internal storage/parser errors are logged server-side only; user-visible messages are fixed safe strings.
- **V1 rule explicit** — if a record has multiple PDF assets, extract from the first uploaded one only. Asset selection UI is out of scope for V1.

---

## Branch

```
git checkout -b codex/f010-ocr-source-text-acquisition
```

---

## File Map

| Action | Path |
|--------|------|
| Create | `src/lib/sources/text-extractor.ts` |
| Create | `src/lib/actions/extract-text.ts` |
| Create | `src/components/records/ExtractTextSection.tsx` |
| Modify | `package.json` (add `pdf-parse` + `@types/pdf-parse`) |
| Modify | `src/app/(app)/projects/[id]/records/[recordId]/page.tsx` |
| Create | `plan/2026-03-13-f010-ocr-source-text-acquisition.md` (this file) |
| Update | `claude-progress.txt`, `docs/process/progress.md`, `feature_list.json` |

---

## Steps

### Step 1: Install `pdf-parse`

```bash
npm install pdf-parse
npm install --save-dev @types/pdf-parse
```

Commit: `chore(f010): add pdf-parse dependency`

---

### Step 2: Create `src/lib/sources/text-extractor.ts`

Pure utility — no Supabase, no Next.js. Takes a Buffer + mime_type, returns discriminated result.

```typescript
import pdfParse from "pdf-parse";

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
    const data = await pdfParse(buffer);
    const text = (data.text ?? "").trim();
    if (!text) return { ok: false, reason: "empty_content" };
    return { ok: true, text };
  } catch (err) {
    // Log internally; never surface raw parser error to caller
    console.error("[text-extractor] pdf-parse error:", err);
    return { ok: false, reason: "parse_error" };
  }
}
```

Typecheck after: `npm run typecheck`

Commit: `feat(f010): add text-extractor utility for PDF text extraction`

---

### Step 3: Create `src/lib/actions/extract-text.ts`

Key design decisions:
- `blobToBuffer` is **inlined**, not exported — addendum: don't export trivial helpers
- Error messages are **fixed safe strings** — internal details only in server console
- **Versioning with content-hash no-op**: before inserting, hash existing latest layer content; if matches new extraction, return existing layer ID
- **V1 rule**: picks the first uploaded PDF asset only; logs a note if multiple exist

```typescript
"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractTextFromBuffer } from "@/lib/sources/text-extractor";

async function assertLayerPermission(
  supabase: SupabaseClient,
  projectId: string,
  callerId: string
): Promise<string | null> {
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("global_role")
    .eq("id", callerId)
    .single();

  if (callerProfile?.global_role === "super_admin") return null;

  const { data: membership } = await supabase
    .from("project_memberships")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", callerId)
    .single();

  if (!membership) return "Not a member of this project";
  if (!["project_admin", "researcher"].includes(membership.role)) {
    return "Insufficient permissions";
  }
  return null;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function extractTextFromRecord(
  _prevState: { error: string | null; layerId?: string },
  formData: FormData
): Promise<{ error: string | null; layerId?: string }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const recordId = (formData.get("recordId") as string)?.trim();
  if (!recordId) return { error: "Record ID is required" };

  // Derive projectId from record — never trust client-supplied value
  const { data: record } = await supabase
    .from("source_records")
    .select("project_id")
    .eq("id", recordId)
    .single();
  if (!record) return { error: "Record not found" };
  const projectId = record.project_id;

  const permError = await assertLayerPermission(supabase, projectId, profile.id);
  if (permError) return { error: permError };

  // V1 rule: pick first uploaded PDF with a storage_path (manually uploaded only)
  const { data: assets } = await supabase
    .from("file_assets")
    .select("id, storage_path, mime_type")
    .eq("record_id", recordId)
    .eq("mime_type", "application/pdf")
    .not("storage_path", "is", null)
    .order("uploaded_at", { ascending: true })
    .limit(2);

  if ((assets?.length ?? 0) > 1) {
    console.log(`[extractTextFromRecord] record=${recordId} has ${assets!.length} PDF assets — using first only (V1)`);
  }

  const asset = assets?.[0] ?? null;
  if (!asset?.storage_path) {
    return {
      error: "No locally-uploaded PDF found on this record. Only uploaded PDF files support text extraction in V1.",
    };
  }

  // Download from Supabase storage
  const { data: fileBlob, error: downloadError } = await supabase.storage
    .from("archive-files")
    .download(asset.storage_path);

  if (downloadError || !fileBlob) {
    console.error("[extractTextFromRecord] download failed:", downloadError);
    return { error: "File download failed. Please try again or contact support." };
  }

  const buffer = Buffer.from(await fileBlob.arrayBuffer());
  const extractResult = await extractTextFromBuffer(buffer, "application/pdf");

  if (!extractResult.ok) {
    if (extractResult.reason === "empty_content") {
      return {
        error: "The PDF contains no extractable text. It may be a scanned image — add text manually using the form below.",
      };
    }
    // parse_error or unsupported_mime_type (shouldn't happen given mime check above)
    return { error: "Text extraction failed. The file may be corrupted or unsupported." };
  }

  // Content-hash no-op: if latest source_ocr/file_extract layer has identical content, skip insert
  const { data: existingLayers } = await supabase
    .from("text_layers")
    .select("id, content")
    .eq("record_id", recordId)
    .eq("layer_type", "source_ocr")
    .eq("source_method", "file_extract")
    .order("created_at", { ascending: false })
    .limit(1);

  const latestLayer = existingLayers?.[0] ?? null;
  if (latestLayer && sha256(latestLayer.content) === sha256(extractResult.text)) {
    console.log(`[extractTextFromRecord] content unchanged — returning existing layer ${latestLayer.id}`);
    return { error: null, layerId: latestLayer.id };
  }

  const supersedes_layer_id = latestLayer?.id ?? null;

  const { data: row, error: insertError } = await supabase
    .from("text_layers")
    .insert({
      record_id: recordId,
      layer_type: "source_ocr",
      content: extractResult.text,
      language: null,
      status: "raw",
      source_method: "file_extract",
      supersedes_layer_id,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[extractTextFromRecord] insert failed:", insertError);
    return { error: "Failed to save text layer. Please try again." };
  }

  console.log(
    `[extractTextFromRecord] actor=${profile.id} record=${recordId} project=${projectId} layer=${row.id} supersedes=${supersedes_layer_id ?? "none"}`
  );

  revalidatePath(`/projects/${projectId}/records/${recordId}`);
  return { error: null, layerId: row.id };
}
```

Typecheck after: `npm run typecheck`

Commit: `feat(f010): add extractTextFromRecord server action`

---

### Step 4: Create `src/components/records/ExtractTextSection.tsx`

```tsx
"use client";

import { useActionState } from "react";
import { extractTextFromRecord } from "@/lib/actions/extract-text";

type Props = {
  recordId: string;
  hasPdfAsset: boolean;
  hasExistingSourceOcr: boolean;
  canExtract: boolean;
};

const initialState = { error: null as string | null, layerId: undefined as string | undefined };

export default function ExtractTextSection({
  recordId,
  hasPdfAsset,
  hasExistingSourceOcr,
  canExtract,
}: Props) {
  const [state, formAction, isPending] = useActionState(extractTextFromRecord, initialState);

  if (!hasPdfAsset) {
    return (
      <div className="mt-6 border border-desk-border rounded-[2px] px-4 py-4">
        <p className="text-xs font-sans uppercase tracking-widest text-desk-muted mb-1">
          Text Extraction
        </p>
        <p className="text-sm font-sans text-desk-muted">
          OCR for image files is not supported in V1 — add text manually using the form below.
        </p>
      </div>
    );
  }

  if (!canExtract) return null;

  return (
    <div className="mt-6 border border-desk-border rounded-[2px] px-4 py-4">
      <p className="text-xs font-sans uppercase tracking-widest text-desk-muted mb-3">
        Text Extraction
      </p>

      {hasExistingSourceOcr && !state.layerId && (
        <p className="text-xs font-sans text-desk-muted mb-3">
          A source text layer already exists. Extracting again will create a new layer superseding
          the previous one, unless the content is unchanged.
        </p>
      )}

      {state.layerId ? (
        <p className="text-sm font-sans text-desk-text">
          Source text layer saved.{" "}
          <span className="text-desk-muted font-mono text-xs">{state.layerId}</span>
        </p>
      ) : (
        <form action={formAction}>
          <input type="hidden" name="recordId" value={recordId} />
          {state.error && (
            <p className="text-sm font-sans text-red-600 mb-3">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors disabled:opacity-50"
          >
            {isPending ? "Extracting\u2026" : "Extract Text from PDF"}
          </button>
        </form>
      )}
    </div>
  );
}
```

Typecheck after: `npm run typecheck`

Commit: `feat(f010): add ExtractTextSection client component`

---

### Step 5: Update record detail page

Wire `ExtractTextSection` into `src/app/(app)/projects/[id]/records/[recordId]/page.tsx`.

1. Add import after line 7:
   ```typescript
   import ExtractTextSection from "@/components/records/ExtractTextSection";
   ```

2. After line 37 (`const typedAssets = ...`), add:
   ```typescript
   const hasPdfAsset = typedAssets.some(
     (a) => a.mime_type === "application/pdf" && a.storage_path !== null
   );
   ```

3. After line 70 (`const typedLayers = ...`), add:
   ```typescript
   const hasExistingSourceOcr = typedLayers.some(
     (l) => l.layer_type === "source_ocr" && l.source_method === "file_extract"
   );
   ```

4. Replace line 231:
   ```tsx
   {canAddLayer && <AddTextLayerForm recordId={recordId} projectId={id} />}
   ```
   With:
   ```tsx
   {canAddLayer && (
     <ExtractTextSection
       recordId={recordId}
       hasPdfAsset={hasPdfAsset}
       hasExistingSourceOcr={hasExistingSourceOcr}
       canExtract={canAddLayer}
     />
   )}
   {canAddLayer && <AddTextLayerForm recordId={recordId} projectId={id} />}
   ```

Typecheck: `npm run typecheck`
Lint: `npm run lint`
Build: `npm run build`

Commit: `feat(f010): wire ExtractTextSection into record detail page`

---

### Step 6: Manual verification (PRD test steps)

Run `npm run dev` and verify:

- PRD steps 1–2: Ibali/NLSA records show correct layer type/source
- PRD step 3: PDF record shows "Extract Text from PDF" button
- PRD step 4: Button extracts text, success message + layer ID appear; text layers table refreshes
- PRD step 5: `source_ocr/file_extract` row visually distinct
- Image test: JPEG record shows notice, no button
- Versioning test: re-extract changed PDF → new layer with `supersedes_layer_id` set; unchanged PDF → returns same layer ID
- Permission test: translator/reviewer → section not rendered

---

### Step 7: Documentation

- Update `feature_list.json` — set F010 `passes: true`
- Update `claude-progress.txt` — add Session 10 entry
- Update `docs/process/progress.md` — mark F010 complete

Commit: `docs(f010): mark F010 as passing, update progress`

---

## Commit Sequence

```
chore(f010): add pdf-parse dependency
feat(f010): add text-extractor utility for PDF text extraction
feat(f010): add extractTextFromRecord server action
feat(f010): add ExtractTextSection client component
feat(f010): wire ExtractTextSection into record detail page
docs(f010): mark F010 as passing, update progress
```

---

## Architecture Notes

- **No Jest setup** — addendum: too much tooling surface for two helpers with minimal test value.
- **Inlined `blobToBuffer`** — addendum: `Buffer.from(await blob.arrayBuffer())` is smaller and clearer than an exported helper.
- **Content-hash no-op** — addendum: repeated extraction on an unchanged PDF returns the existing layer ID without a new DB row.
- **Sanitized errors** — addendum: internal errors (download, parse, insert) are console.error'd only; users see fixed safe strings.
- **V1 first-PDF rule** — addendum: explicit. Multiple PDF assets → first uploaded only; logs if >1 found.
- **`supersedes_layer_id` instead of update** — CLAUDE.md product rule: "do not overwrite text layers silently". Full history preserved.
