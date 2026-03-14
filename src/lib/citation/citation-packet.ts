// Shared module — no "use server". Safe to import from server actions and client components.

export interface CitationPacketRecord {
  canonical_ref: string;
  source_type: string;
  source_archive: string;
  publication_title: string;
  date_issued: string | null;
  date_issued_raw: string | null;
  language: string;
  record_status: string;
  source_identifier: string | null;
  source_url: string | null;
}

export interface CitationPacketLayer {
  layer_type: string;
  content: string;
  language: string | null;
  status: string;
  source_method: string;
  created_at: string;
}

export interface CitationPacketAnnotation {
  annotation_type: string;
  content: string;
  author: string;
  created_at: string;
}

export interface CitationPacket {
  generated_at: string;
  platform: string;
  record: CitationPacketRecord;
  text_layers: CitationPacketLayer[];
  annotations: CitationPacketAnnotation[];
}

export function serializeToText(packet: CitationPacket): string {
  const r = packet.record;
  const date = r.date_issued ?? r.date_issued_raw ?? "—";

  const lines: string[] = [
    "CITATION PACKET",
    "===============",
    `Title:              ${r.publication_title}`,
    `Canonical Ref:      ${r.canonical_ref}`,
    `Source Type:        ${r.source_type}`,
    `Source Archive:     ${r.source_archive}`,
    `Date:               ${date}`,
    `Language:           ${r.language}`,
    `Status:             ${r.record_status}`,
    `Source Identifier:  ${r.source_identifier ?? "—"}`,
    `Source URL:         ${r.source_url ?? "—"}`,
    "",
  ];

  if (packet.text_layers.length > 0) {
    lines.push("TEXT LAYERS", "-----------");
    for (const layer of packet.text_layers) {
      const lang = layer.language ? ` / ${layer.language}` : "";
      lines.push(`[${layer.layer_type} / ${layer.status}${lang}]`);
      lines.push(layer.content);
      lines.push("");
    }
  } else {
    lines.push("TEXT LAYERS", "-----------", "(none)", "");
  }

  if (packet.annotations.length > 0) {
    lines.push("NOTES & ANNOTATIONS", "--------------------");
    for (const ann of packet.annotations) {
      const date = ann.created_at.slice(0, 10);
      lines.push(`[${ann.annotation_type}] ${ann.author} — ${date}`);
      lines.push(ann.content);
      lines.push("");
    }
  } else {
    lines.push("NOTES & ANNOTATIONS", "--------------------", "(none)", "");
  }

  lines.push("---");
  lines.push(`Generated: ${packet.generated_at}`);
  lines.push(`Platform: ${packet.platform}`);

  return lines.join("\n");
}

export function serializeToJSON(packet: CitationPacket): string {
  return JSON.stringify(packet, null, 2);
}

export function sanitizeCitationFilename(ref: string): string {
  return (
    ref
      .replace(/[/\\:*?"<>|]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 200) || "record"
  );
}
