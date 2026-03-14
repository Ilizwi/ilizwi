interface RecordSearchFiltersProps {
  projectId: string;
  q?: string;
  source?: string;
  language?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  flagged?: string;
}

export default function RecordSearchFilters({
  projectId,
  q,
  source,
  language,
  dateFrom,
  dateTo,
  status,
  flagged,
}: RecordSearchFiltersProps) {
  const hasActiveFilters = !!(q || source || language || dateFrom || dateTo || status);

  return (
    <form
      action={`/projects/${projectId}/records`}
      method="GET"
      className="mb-6 flex flex-wrap gap-3 items-end"
    >
      {/* Preserve flagged filter across search submissions */}
      {flagged === "true" && (
        <input type="hidden" name="flagged" value="true" />
      )}

      {/* Text search */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-sans uppercase tracking-widest text-desk-muted">
          Search
        </label>
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search records…"
          className="px-3 py-1.5 text-sm font-sans border border-desk-border rounded-[2px] bg-white text-desk-text placeholder:text-desk-muted focus:outline-none focus:border-desk-text w-56"
        />
      </div>

      {/* Source filter */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-sans uppercase tracking-widest text-desk-muted">
          Source
        </label>
        <select
          name="source"
          defaultValue={source ?? ""}
          className="px-3 py-1.5 text-sm font-sans border border-desk-border rounded-[2px] bg-white text-desk-text focus:outline-none focus:border-desk-text"
        >
          <option value="">All Sources</option>
          <option value="ibali">Ibali</option>
          <option value="nlsa">NLSA</option>
          <option value="wits">Wits</option>
          <option value="manual_readex">Manual / Readex</option>
        </select>
      </div>

      {/* Language filter */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-sans uppercase tracking-widest text-desk-muted">
          Language
        </label>
        <select
          name="language"
          defaultValue={language ?? ""}
          className="px-3 py-1.5 text-sm font-sans border border-desk-border rounded-[2px] bg-white text-desk-text focus:outline-none focus:border-desk-text"
        >
          <option value="">All Languages</option>
          <option value="xh">Xhosa (xh)</option>
          <option value="zu">Zulu (zu)</option>
          <option value="st">Sotho (st)</option>
          <option value="nl">Dutch (nl)</option>
          <option value="en">English (en)</option>
        </select>
      </div>

      {/* Status filter */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-sans uppercase tracking-widest text-desk-muted">
          Status
        </label>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="px-3 py-1.5 text-sm font-sans border border-desk-border rounded-[2px] bg-white text-desk-text focus:outline-none focus:border-desk-text"
        >
          <option value="">All Statuses</option>
          <option value="raw">Raw</option>
          <option value="in_review">In Review</option>
          <option value="approved">Approved</option>
        </select>
      </div>

      {/* Date from */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-sans uppercase tracking-widest text-desk-muted">
          From
        </label>
        <input
          type="date"
          name="date_from"
          defaultValue={dateFrom ?? ""}
          className="px-3 py-1.5 text-sm font-sans border border-desk-border rounded-[2px] bg-white text-desk-text focus:outline-none focus:border-desk-text"
        />
      </div>

      {/* Date to */}
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-sans uppercase tracking-widest text-desk-muted">
          To
        </label>
        <input
          type="date"
          name="date_to"
          defaultValue={dateTo ?? ""}
          className="px-3 py-1.5 text-sm font-sans border border-desk-border rounded-[2px] bg-white text-desk-text focus:outline-none focus:border-desk-text"
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        className="px-4 py-1.5 text-sm font-sans bg-vault-bg text-vault-text rounded-[2px] hover:bg-vault-surface transition-colors"
      >
        Search
      </button>

      {/* Clear filters */}
      {hasActiveFilters && (
        <a
          href={`/projects/${projectId}/records${flagged === "true" ? "?flagged=true" : ""}`}
          className="px-4 py-1.5 text-sm font-sans border border-desk-border text-desk-muted rounded-[2px] hover:text-desk-text hover:border-desk-text transition-colors"
        >
          Clear filters
        </a>
      )}
    </form>
  );
}
