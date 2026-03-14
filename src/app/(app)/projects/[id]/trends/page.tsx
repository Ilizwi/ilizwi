import { requireProjectMember } from "@/lib/auth/project-guard";
import { getCorpusTrends } from "@/lib/trends/corpus-trends";
import TrendBarChart from "@/components/records/TrendBarChart";
import Link from "next/link";

export default async function TrendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{
    q?: string;
    source?: string;
    language?: string;
  }>;
}) {
  const { id } = await params;
  const resolved = await (searchParams ?? Promise.resolve({} as { q?: string; source?: string; language?: string }));
  const q = resolved.q;
  const source = resolved.source;
  const language = resolved.language;

  const { project } = await requireProjectMember(id);
  const trends = await getCorpusTrends(
    id,
    q?.trim() || undefined,
    source,
    language
  );

  const hasFilters = !!(q || source || language);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-3xl text-desk-text tracking-tight">
          Corpus Trends
        </h1>
        <p className="text-desk-muted text-sm font-sans mt-2">{project.name}</p>
      </div>

      {/* Search + filter bar — GET form */}
      <form method="GET" className="flex items-center gap-3 mb-6">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search term…"
          className="border border-desk-border rounded-[2px] px-3 py-1.5 text-sm font-sans text-desk-text bg-transparent placeholder:text-desk-muted focus:outline-none focus:border-desk-text w-64"
        />
        <select
          name="source"
          defaultValue={source ?? ""}
          className="border border-desk-border rounded-[2px] px-3 py-1.5 text-sm font-sans text-desk-text bg-transparent focus:outline-none focus:border-desk-text"
        >
          <option value="">All sources</option>
          <option value="manual_readex">Readex</option>
          <option value="ibali">Ibali</option>
          <option value="nlsa">NLSA</option>
          <option value="wits">Wits</option>
        </select>
        <select
          name="language"
          defaultValue={language ?? ""}
          className="border border-desk-border rounded-[2px] px-3 py-1.5 text-sm font-sans text-desk-text bg-transparent focus:outline-none focus:border-desk-text"
        >
          <option value="">All Languages</option>
          <option value="xh">Xhosa (xh)</option>
          <option value="zu">Zulu (zu)</option>
          <option value="st">Sotho (st)</option>
          <option value="nl">Dutch (nl)</option>
          <option value="en">English (en)</option>
        </select>
        <button
          type="submit"
          className="px-4 py-1.5 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors"
        >
          Search
        </button>
        {hasFilters && (
          <Link
            href={`/projects/${id}/trends`}
            className="text-sm font-sans text-desk-muted underline underline-offset-2"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Result summary */}
      {q && (
        <p className="text-xs font-sans text-desk-muted mb-6">
          {trends.total} record{trends.total !== 1 ? "s" : ""} match &ldquo;
          {q}&rdquo;
        </p>
      )}

      {/* Empty state — with search term, no results */}
      {q && trends.total === 0 && (
        <div className="text-center py-12">
          <p className="text-desk-muted text-sm font-sans">
            No records match this term.
          </p>
        </div>
      )}

      {/* Charts — 2×2 grid (search term, results found) */}
      {q && trends.total > 0 && (
        <div className="grid grid-cols-2 gap-6">
          <TrendBarChart title="By Year" items={trends.byYear} projectId={id} />
          <TrendBarChart
            title="By Publication"
            items={trends.byPublication}
            projectId={id}
          />
          <TrendBarChart
            title="By Language"
            items={trends.byLanguage}
            projectId={id}
          />
          <TrendBarChart
            title="By Source"
            items={trends.bySource}
            projectId={id}
          />
        </div>
      )}

      {/* No-term browse prompt */}
      {!q && trends.total === 0 && (
        <div className="text-center py-12">
          <p className="text-desk-muted text-sm font-sans">
            Enter a search term to explore corpus distributions.
          </p>
        </div>
      )}

      {/* No-term browse with results */}
      {!q && trends.total > 0 && (
        <div className="grid grid-cols-2 gap-6">
          <TrendBarChart title="By Year" items={trends.byYear} projectId={id} />
          <TrendBarChart
            title="By Publication"
            items={trends.byPublication}
            projectId={id}
          />
          <TrendBarChart
            title="By Language"
            items={trends.byLanguage}
            projectId={id}
          />
          <TrendBarChart
            title="By Source"
            items={trends.bySource}
            projectId={id}
          />
        </div>
      )}
    </div>
  );
}
