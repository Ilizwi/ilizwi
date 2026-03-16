import Link from "next/link";
import type { RelatedRecord } from "@/lib/records/related";

export default function RelatedRecordsSection({
  relatedRecords,
  projectId,
}: {
  relatedRecords: RelatedRecord[];
  projectId: string;
}) {
  if (relatedRecords.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="font-serif text-xl text-desk-text mb-4">Related Records</h2>
      <div className="border border-desk-border rounded-[2px] overflow-hidden">
        <table className="w-full text-sm font-sans">
          <thead>
            <tr className="bg-vault-bg/5 border-b border-desk-border">
              <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">Ref</th>
              <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">Publication</th>
              <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">Date</th>
              <th className="text-left px-4 py-2 text-desk-muted font-normal text-xs uppercase tracking-widest">Relationship</th>
            </tr>
          </thead>
          <tbody>
            {relatedRecords.map(({ record, reason }) => (
              <tr key={record.id} className="border-b border-desk-border last:border-b-0">
                <td className="px-4 py-3">
                  <Link
                    href={`/projects/${projectId}/records/${record.id}`}
                    className="font-mono text-xs text-desk-text hover:underline underline-offset-2"
                  >
                    {record.canonical_ref ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-3 text-desk-muted">{record.publication_title}</td>
                <td className="px-4 py-3 text-desk-muted">
                  {record.date_issued ?? record.date_issued_raw ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block px-2 py-0.5 text-[10px] font-sans uppercase tracking-widest rounded-[2px] bg-vault-bg/10 text-desk-muted">
                    {reason}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
