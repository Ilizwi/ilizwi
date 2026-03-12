"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateCanonicalRef, appendCollisionSuffix, MAX_COLLISION_RETRIES } from "@/lib/records/canonical-ref";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/tiff",
  "image/webp",
];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[/\\:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 200) || "upload"
  );
}

async function assertUploadPermission(
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
    return "Insufficient permissions — only project admins and researchers can upload";
  }
  return null;
}

export async function uploadRecord(
  _prevState: { error: string | null; recordId?: string },
  formData: FormData
): Promise<{ error: string | null; recordId?: string }> {
  const profile = await requireAuth();
  const supabase = await createClient();

  const projectId = formData.get("projectId") as string;
  const file = formData.get("file") as File | null;
  const sourceArchive = (formData.get("source_archive") as string)?.trim();
  const publicationTitle = (formData.get("publication_title") as string)?.trim();
  const language = (formData.get("language") as string)?.trim();
  const sourceType = (formData.get("source_type") as string) || "manual_readex";
  const dateIssued = (formData.get("date_issued") as string)?.trim() || null;
  const dateIssuedRaw = (formData.get("date_issued_raw") as string)?.trim() || null;
  const pageLabel = (formData.get("page_label") as string)?.trim() || null;
  const volume = (formData.get("volume") as string)?.trim() || null;
  const issueNumber = (formData.get("issue_number") as string)?.trim() || null;
  const articleLabel = (formData.get("article_label") as string)?.trim() || null;

  // Permission check (server-side, not RLS-only)
  const permError = await assertUploadPermission(supabase, projectId, profile.id);
  if (permError) return { error: permError };

  // Required field validation
  if (!sourceArchive) return { error: "Source archive is required" };
  if (!publicationTitle) return { error: "Publication title is required" };
  if (!language) return { error: "Language is required" };
  if (!dateIssued) return { error: "Date issued is required" };

  // File validation
  if (!file || file.size === 0) return { error: "A file is required" };
  if (file.size > MAX_SIZE_BYTES) return { error: "File must be under 50MB" };
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      error: "Only PDF and image files (JPEG, PNG, TIFF, WebP) are allowed",
    };
  }

  // Generate canonical ref (base — collision suffix appended on retry)
  const baseRef = generateCanonicalRef({
    source_type: sourceType,
    publication_title: publicationTitle,
    date_issued: dateIssued,
    page_label: pageLabel,
    volume,
    issue_number: issueNumber,
    article_label: articleLabel,
  });

  // Pre-generate record ID before any I/O
  const recordId = crypto.randomUUID();
  const safeFilename = sanitizeFilename(file.name);
  const storagePath = `${projectId}/${recordId}/${safeFilename}`;

  // Step 1: Upload file
  const fileBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("archive-files")
    .upload(storagePath, fileBuffer, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  // Step 2: Insert source_records row with canonical_ref collision retry
  let canonicalRef = baseRef;
  let recordError: { message: string; code?: string } | null = null;
  for (let attempt = 1; attempt <= MAX_COLLISION_RETRIES + 1; attempt++) {
    canonicalRef = attempt === 1 ? baseRef : appendCollisionSuffix(baseRef, attempt);
    const { error } = await supabase.from("source_records").insert({
      id: recordId,
      project_id: projectId,
      source_type: sourceType,
      source_archive: sourceArchive,
      publication_title: publicationTitle,
      language,
      date_issued: dateIssued,
      date_issued_raw: dateIssuedRaw || null,
      page_label: pageLabel || null,
      volume: volume || null,
      issue_number: issueNumber || null,
      article_label: articleLabel || null,
      canonical_ref: canonicalRef,
      created_by: profile.id,
    });
    if (!error) { recordError = null; break; }
    if ((error as { code?: string }).code !== "23505") { recordError = error; break; }
    recordError = error;
  }
  if (recordError) {
    await supabase.storage.from("archive-files").remove([storagePath]);
    if ((recordError as { code?: string }).code === "23505") {
      return { error: "A record with this exact metadata already exists. Add volume, issue, page, or article label to disambiguate." };
    }
    return { error: `Record creation failed: ${recordError.message}` };
  }

  // Step 3: Insert file_assets row (compensate on failure)
  const { error: assetError } = await supabase.from("file_assets").insert({
    record_id: recordId,
    asset_type: "source_file",
    storage_path: storagePath,
    original_filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    is_original: true,
    uploaded_by: profile.id,
  });
  if (assetError) {
    await supabase.storage.from("archive-files").remove([storagePath]);
    await supabase.from("source_records").delete().eq("id", recordId);
    return { error: `Asset registration failed: ${assetError.message}` };
  }

  console.log(
    `[uploadRecord] actor=${profile.id} uploaded record=${recordId} ref=${canonicalRef} file=${safeFilename} (${file.type}, ${file.size}B) to project=${projectId}`
  );

  revalidatePath(`/projects/${projectId}/records`);
  return { error: null, recordId };
}
