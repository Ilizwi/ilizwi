import Link from "next/link";
import { TrendBucket } from "@/lib/trends/corpus-trends";

interface TrendBarChartProps {
  title: string;
  items: TrendBucket[];
  projectId: string;
}

export default function TrendBarChart({ title, items }: TrendBarChartProps) {
  const visible = items.slice(0, 15);
  const maxCount = visible[0]?.count ?? 1;

  return (
    <div className="border border-desk-border rounded-[2px] p-4">
      <h3 className="font-serif text-base text-desk-text tracking-tight mb-3">
        {title}
      </h3>

      {visible.length === 0 ? (
        <p className="text-desk-muted text-sm font-sans">No data</p>
      ) : (
        <ul>
          {visible.map((item) => {
            const pct = Math.round((item.count / (items.reduce((s, i) => s + i.count, 0) || 1)) * 100);
            const barWidth = `${(item.count / maxCount) * 100}%`;

            return (
              <li key={item.label} className="flex items-center gap-3 mb-2 last:mb-0">
                <Link
                  href={item.href}
                  className="w-32 shrink-0 text-sm font-serif text-desk-text truncate hover:underline underline-offset-2"
                  title={item.label}
                >
                  {item.label}
                </Link>

                <div className="flex-1 bg-vault-surface/20 rounded-[1px] h-3 relative">
                  <div
                    className="absolute inset-y-0 left-0 bg-vault-bg rounded-[1px] transition-all"
                    style={{ width: barWidth }}
                  />
                </div>

                <span className="w-16 shrink-0 text-xs font-sans text-desk-muted text-right">
                  {item.count} · {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
