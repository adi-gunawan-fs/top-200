import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { compareMessages } from "../utils/compareMessages";
import { formatDate } from "../utils/formatDate";
import { Badge } from "./ui/Badge";
import { Card } from "./ui/Card";
import { EmptyState } from "./ui/EmptyState";
import { SummaryTriple } from "./ui/SummaryTriple";

function getDefaultComparison(group) {
  const records = group.records ?? [];
  if (records.length < 2) return null;

  const afterRecord = records[records.length - 1];
  const beforeRecord = records[records.length - 2];
  return compareMessages(beforeRecord, afterRecord);
}

function isResolved(comparison) {
  if (!comparison) return false;

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

function handleRowKey(event, callback) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    callback();
  }
}

function SummaryTable({ groups, loading, onSelectGroup }) {
  const rows = useMemo(() => {
    return groups.map((group) => ({
      group,
      comparison: getDefaultComparison(group),
    }));
  }, [groups]);

  if (loading) return <EmptyState message="Parsing CSV..." />;
  if (!groups.length) return <EmptyState message="Upload a CSV file to see grouped results." />;

  return (
    <Card>
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
              <th className="w-44 px-3 py-2">Latest updatedAt</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ group, comparison }) => {
              const handleSelect = () => onSelectGroup?.(group);
              return (
                <tr
                  key={group.key}
                  onClick={handleSelect}
                  onKeyDown={(e) => handleRowKey(e, handleSelect)}
                  role="button"
                  tabIndex={0}
                  className="cursor-pointer border-b border-slate-100 text-xs text-slate-700 hover:bg-slate-50 focus:outline-none focus:bg-slate-50 focus:ring-2 focus:ring-inset focus:ring-blue-500"
                >
                  <td className="px-3 py-2 font-medium text-slate-900">{group.menuId}</td>
                  <td className="max-w-[420px] truncate px-3 py-2">
                    {group.menuUrl && group.menuUrl !== "-" ? (
                      <a
                        href={group.menuUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
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
                        onClick={(e) => e.stopPropagation()}
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
                      <Badge tone="success">Resolved</Badge>
                    ) : (
                      <Badge tone="warning">For Review</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {comparison ? (
                      <SummaryTriple
                        bare
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
                      <SummaryTriple
                        bare
                        deleted={comparison.summary.dishes.deleted}
                        added={comparison.summary.dishes.new}
                        updated={comparison.summary.dishes.updated}
                      />
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">{formatDate(group.latest?.updatedAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default SummaryTable;
