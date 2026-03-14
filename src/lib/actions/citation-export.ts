"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/role-guard";
import type { CitationPacket } from "@/lib/citation/citation-packet";

type GetCitationPacketResult =
  | { packet: CitationPacket; error: null }
  | { packet: null; error: string };

export async function getCitationPacket(
  recordId: string
): Promise<GetCitationPacketResult> {
  const profile = await requireAuth();
  const supabase = await createClient();

  // Fetch record — tenancy guard: derive project_id from record itself
  const { data: record } = await supabase
    .from("source_records")
    .select("*")
    .eq("id", recordId)
    .single();

  if (!record) {
    return { packet: null, error: "Record not found" };
  }

  // Authorization: super_admin bypasses; otherwise verify project membership
  if (profile.global_role !== "super_admin") {
    const { data: membership } = await supabase
      .from("project_memberships")
      .select("id")
      .eq("project_id", record.project_id)
      .eq("user_id", profile.id)
      .single();

    if (!membership) {
      return { packet: null, error: "Insufficient permissions" };
    }
  }

  // Text layers — all layers, ascending by creation
  const { data: layersData } = await supabase
    .from("text_layers")
    .select("layer_type, content, language, status, source_method, created_at")
    .eq("record_id", recordId)
    .order("created_at", { ascending: true });

  // Annotations — with author profile join
  const { data: annotationsData } = await supabase
    .from("annotations")
    .select("annotation_type, content, created_at, profiles(display_name, email)")
    .eq("record_id", recordId)
    .order("created_at", { ascending: true });

  const text_layers = (layersData ?? []).map((l) => ({
    layer_type: l.layer_type as string,
    content: l.content as string,
    language: l.language as string | null,
    status: l.status as string,
    source_method: l.source_method as string,
    created_at: l.created_at as string,
  }));

  const annotations = (annotationsData ?? []).map((a) => {
    const prof = (Array.isArray(a.profiles) ? a.profiles[0] : a.profiles) as { display_name: string | null; email: string } | null;
    const author = prof?.display_name ?? prof?.email ?? "unknown";
    return {
      annotation_type: a.annotation_type as string,
      content: a.content as string,
      author,
      created_at: a.created_at as string,
    };
  });

  const packet: CitationPacket = {
    generated_at: new Date().toISOString(),
    platform: "Panashe Archival Research Platform",
    record: {
      canonical_ref: record.canonical_ref,
      source_type: record.source_type,
      source_archive: record.source_archive,
      publication_title: record.publication_title,
      date_issued: record.date_issued ?? null,
      date_issued_raw: record.date_issued_raw ?? null,
      language: record.language,
      record_status: record.record_status,
      source_identifier: record.source_identifier ?? null,
      source_url: record.source_url ?? null,
    },
    text_layers,
    annotations,
  };

  return { packet, error: null };
}
