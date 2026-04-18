import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { compareMessages } from "../utils/compareMessages";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return parsed.toLocaleString();
}

function SummaryTripleCell({ deleted, added, updated }) {
  return (
    <div className="flex flex-wrap gap-1">
      <span className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
        Deleted: {deleted}
      </span>
      <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
        New: {added}
      </span>
      <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
        Updated: {updated}
      </span>
    </div>
  );
}

function getDefaultComparison(group) {
  const records = group.records ?? [];
  if (records.length < 2) {
    return null;
  }

  const afterRecord = records[records.length - 1];
  const beforeRecord = records[records.length - 2];
  return compareMessages(beforeRecord, afterRecord);
}

function isResolved(comparison) {
  if (!comparison) {
    return false;
  }

  const dishSummary = comparison.summary?.dishes;
  const titleSummary = comparison.summary?.menuTitles;

  return (
    (dishSummary?.deleted ?? 0) === 0
    && (dishSummary?.new ?? 0) === 0
    && (dishSummary?.updated ?? 0) === 0
    && (dishSummary?.requiresCuration ?? 0) === 0
    && (titleSummary?.deleted ?? 0) === 0
    && (titleSummary?.new ?? 0) === 0
    && (titleSummary?.updated ?? 0) === 0
    && (titleSummary?.requiresCuration ?? 0) === 0
  );
}

function SummaryTable({ groups, loading, onSelectGroup }) {
  const rows = useMemo(() => {
    return groups.map((group) => ({
      group,
      comparison: getDefaultComparison(group),
    }));
  }, [groups]);

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
        Parsing CSV...
      </section>
    );
  }

  if (!groups.length) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
        Upload a CSV file to see grouped results.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed border-collapse">
          <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="w-40 px-3 py-2">Menu ID</th>
              <th className="px-3 py-2">Menu URL</th>
              <th className="w-32 px-3 py-2">Brand ID</th>
              <th className="w-64 px-3 py-2">Brand Name</th>
              <th className="w-32 px-3 py-2">Status</th>
              <th className="w-[280px] px-3 py-2">Menu Title</th>
              <th className="w-[280px] px-3 py-2">Dishes</th>
              <th className="w-44 px-3 py-2">Dishes Require Curation</th>
              <th className="w-48 px-3 py-2">Menu Titles Require Curation</th>
              <th className="w-44 px-3 py-2">Latest updatedAt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ group, comparison }) => (
              <tr
                key={group.key}
                onClick={() => onSelectGroup?.(group)}
                className="cursor-pointer border-b border-slate-100 text-xs text-slate-700 hover:bg-slate-50"
              >
                <td className="px-3 py-2 font-medium text-slate-900">{group.menuId}</td>
                <td className="max-w-[420px] truncate px-3 py-2">
                  {group.menuUrl && group.menuUrl !== "-" ? (
                    <a
                      href={group.menuUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex max-w-full items-center gap-1 text-blue-600 hover:underline"
                      title={group.menuUrl}
                    >
                      <span className="truncate">{group.menuUrl}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  ) : (
                    <span>-</span>
                  )}
                </td>
                <td className="px-3 py-2">{group.brandId}</td>
                <td className="px-3 py-2">
                  {group.brandWebsite ? (
                    <a
                      href={group.brandWebsite}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      {group.brandName}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span>{group.brandName}</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {isResolved(comparison) ? (
                    <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                      Resolved
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      For Review
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {comparison ? (
                    <SummaryTripleCell
                      deleted={comparison.summary.menuTitles.deleted}
                      added={comparison.summary.menuTitles.new}
                      updated={comparison.summary.menuTitles.updated}
                    />
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {comparison ? (
                    <SummaryTripleCell
                      deleted={comparison.summary.dishes.deleted}
                      added={comparison.summary.dishes.new}
                      updated={comparison.summary.dishes.updated}
                    />
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {comparison ? comparison.summary.dishes.requiresCuration : "-"}
                </td>
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {comparison ? comparison.summary.menuTitles.requiresCuration : "-"}
                </td>
                <td className="px-3 py-2">{formatDate(group.latest?.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default SummaryTable;
