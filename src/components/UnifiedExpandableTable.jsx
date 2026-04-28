import { useEffect, useMemo, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { StatusPill, rowStyles } from "./ui/StatusPill";
import { ChangeTypeCounts } from "./ui/ChangeTypeBadge";
import { ChangedFieldsModal } from "./ui/ChangedFieldsModal";
import { buildHierarchy, collectTitleIds } from "../utils/hierarchyUtils";
import {
  filterHierarchyByStatus,
  filterHierarchyByRelevancy,
  filterChangedFieldsByRelevancy,
  shouldHideChangedField,
  getVisibleChangeTypeCounts,
} from "../utils/filterUtils";
// analysisResultsMap is keyed by `${item.id}__${item.type}` (short key, before/after constant per view)

const STATUS_FILTER_OPTIONS = [
  { value: "new", label: "New" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "unchanged", label: "No Changes" },
];

const RELEVANCY_FILTER_OPTIONS = [
  { value: "Relevant", label: "Relevant", defaultChecked: true },
  { value: "Not Relevant", label: "Not Relevant", defaultChecked: false },
];

export const DEFAULT_SELECTED_STATUSES = STATUS_FILTER_OPTIONS
  .filter((option) => option.value !== "deleted" && option.value !== "unchanged")
  .map((option) => option.value);

export const DEFAULT_SELECTED_RELEVANCIES = RELEVANCY_FILTER_OPTIONS
  .filter((option) => option.defaultChecked)
  .map((option) => option.value);

function ChangedFieldsCell({ item, selectedRelevancies }) {
  const [open, setOpen] = useState(false);
  const visibleChangedFields = filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancies)
    .filter((field) => !shouldHideChangedField(item, field));

  if (!visibleChangedFields.length) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-blue-700 hover:text-blue-900 hover:underline focus:outline-none"
      >
        {visibleChangedFields.length} field{visibleChangedFields.length > 1 ? "s" : ""} changed
      </button>
      {open ? (
        <ChangedFieldsModal
          item={item}
          fields={visibleChangedFields}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function AnalysisResultDisplay({ result }) {
  const [expanded, setExpanded] = useState(false);

  const complexityColor = {
    EASY: "text-emerald-700 bg-emerald-50 border-emerald-200",
    MEDIUM: "text-amber-700 bg-amber-50 border-amber-200",
    HARD: "text-rose-700 bg-rose-50 border-rose-200",
  }[result.overall_complexity] ?? "text-slate-700 bg-slate-50 border-slate-200";

  const changeStatusColor = {
    NO_CHANGE: "text-slate-600",
    MINOR_CHANGE: "text-amber-700",
    SIGNIFICANT_CHANGE: "text-rose-700",
  }[result.change_status] ?? "text-slate-600";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${complexityColor}`}>
          {result.overall_complexity}
        </span>
        <span className={`text-[10px] font-medium ${changeStatusColor}`}>
          {result.change_status?.replace(/_/g, " ")}
        </span>
        <span className="text-[10px] text-slate-500">
          avg {result.average_score?.toFixed(1)}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-[10px] text-blue-600 hover:underline focus:outline-none"
        >
          {expanded ? "hide" : "details"}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-1 rounded border border-slate-200 bg-slate-50 p-2 text-[10px]">
          {result.parameter_scores && (
            <div className="flex flex-col gap-0.5">
              <p className="font-semibold text-slate-600 uppercase tracking-wide">Scores</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {Object.entries(result.parameter_scores).map(([k, v]) => (
                  <span key={k} className="flex justify-between">
                    <span className="text-slate-500">{k.replace(/_/g, " ")}</span>
                    <span className="font-medium text-slate-700">{v}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {result.critical_reasons?.length > 0 && (
            <div className="flex flex-col gap-0.5 mt-1">
              <p className="font-semibold text-slate-600 uppercase tracking-wide">Reasons</p>
              <ul className="flex flex-col gap-0.5">
                {result.critical_reasons.map((r, i) => (
                  <li key={i} className="text-slate-600 break-words">· {r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AnalysisCell({ item, analysisKey, analysisResultsMap, runningKeys, onRunOne }) {
  const result = analysisResultsMap[analysisKey];
  const isRunning = runningKeys.has(analysisKey);

  if (result) {
    return (
      <div className="flex flex-col gap-1">
        <AnalysisResultDisplay result={result} />
        <button
          type="button"
          onClick={() => onRunOne(item)}
          disabled={isRunning}
          className="self-start text-[10px] text-slate-400 hover:text-blue-600 hover:underline focus:outline-none disabled:cursor-not-allowed"
        >
          re-run
        </button>
      </div>
    );
  }

  if (isRunning) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Running…
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onRunOne(item)}
      className="inline-flex items-center gap-1 rounded border border-blue-300 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 hover:bg-blue-100 focus:outline-none"
    >
      <Play className="h-2.5 w-2.5" />
      Run
    </button>
  );
}

export function UnifiedExpandableTable({
  menuTitleRows,
  dishRows,
  selectedStatuses,
  setSelectedStatuses,
  selectedRelevancies,
  setSelectedRelevancies,
  analysisResultsMap,
  runningKeys,
  onRunOne,
  eligibleItemKeys,
}) {
  const selectedRelevancySet = useMemo(() => new Set(selectedRelevancies), [selectedRelevancies]);
  const { roots, orphanDishes } = useMemo(
    () => buildHierarchy(menuTitleRows, dishRows),
    [menuTitleRows, dishRows],
  );
  const [expandedTitles, setExpandedTitles] = useState({});
  const selectedStatusSet = useMemo(() => new Set(selectedStatuses), [selectedStatuses]);
  const { roots: statusFilteredRoots, orphanDishes: statusFilteredOrphanDishes } = useMemo(
    () => filterHierarchyByStatus(roots, orphanDishes, selectedStatusSet),
    [roots, orphanDishes, selectedStatusSet],
  );
  const { roots: filteredRoots, orphanDishes: filteredOrphanDishes } = useMemo(
    () => filterHierarchyByRelevancy(statusFilteredRoots, statusFilteredOrphanDishes, selectedRelevancySet),
    [selectedRelevancySet, statusFilteredOrphanDishes, statusFilteredRoots],
  );

  const toggleStatus = (status) => {
    setSelectedStatuses((prev) => (
      prev.includes(status)
        ? prev.filter((item) => item !== status)
        : [...prev, status]
    ));
  };

  const toggleRelevancy = (relevancy) => {
    setSelectedRelevancies((prev) => (
      prev.includes(relevancy)
        ? prev.filter((item) => item !== relevancy)
        : [...prev, relevancy]
    ));
  };

  useEffect(() => {
    const allTitleIds = collectTitleIds(filteredRoots);
    const nextExpanded = {};
    allTitleIds.forEach((id) => {
      nextExpanded[id] = true;
    });
    setExpandedTitles(nextExpanded);
  }, [filteredRoots]);

  const rows = useMemo(() => {
    const flat = [];

    const walk = (node, depth) => {
      const hasChildren = node.children.length > 0 || node.dishes.length > 0;
      flat.push({
        key: `title-${node.id}`,
        kind: "menuTitle",
        depth,
        hasChildren,
        isExpanded: Boolean(expandedTitles[node.id]),
        item: node.item,
      });

      if (!expandedTitles[node.id]) {
        return;
      }

      node.children.forEach((child) => walk(child, depth + 1));
      node.dishes.forEach((dish) => {
        flat.push({
          key: `dish-${dish.id}`,
          kind: "dish",
          depth: depth + 1,
          hasChildren: false,
          isExpanded: false,
          item: dish,
        });
      });
    };

    filteredRoots.forEach((node) => walk(node, 0));

    filteredOrphanDishes.forEach((dish) => {
      flat.push({
        key: `orphan-dish-${dish.id}`,
        kind: "dish",
        depth: 0,
        hasChildren: false,
        isExpanded: false,
        orphan: true,
        item: dish,
      });
    });

    return flat;
  }, [expandedTitles, filteredRoots, filteredOrphanDishes]);

  const toggleTitle = (id) => {
    setExpandedTitles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <section className="overflow-visible rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Menu Structure</header>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2">
        <span className="text-xs font-semibold text-slate-700">Filter Status</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTER_OPTIONS.map((option) => {
            const checked = selectedStatuses.includes(option.value);
            return (
              <label key={option.value} className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={checked}
                  onChange={() => toggleStatus(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        <span className="text-xs font-semibold text-slate-700">Relevancies</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {RELEVANCY_FILTER_OPTIONS.map((option) => {
            const checked = selectedRelevancies.includes(option.value);
            return (
              <label key={option.value} className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={checked}
                  onChange={() => toggleRelevancy(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-36" />
            <col className="w-[420px]" />
            <col className="w-60" />
            <col className="w-[560px]" />
            <col className="w-72" />
          </colgroup>
          <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">ID</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Title / Name</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Relevancies</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Changed Fields</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Analysis</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-xs text-slate-500">No menu title or dish changes to render.</td>
              </tr>
            ) : (
              rows.map((row) => {
                const item = row.item;
                const label = row.kind === "menuTitle" ? (item.title || "-") : (item.name || "-");
                const indentPx = row.depth * 20;
                const visibleChangedFields = filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancySet)
                  .filter((field) => !shouldHideChangedField(item, field));
                const visibleChangeTypeCounts = getVisibleChangeTypeCounts(visibleChangedFields);
                const shortKey = `${item.id}__${item.type}`;
                const isEligible = eligibleItemKeys?.has(shortKey);

                return (
                  <tr key={row.key} className={`border-b border-slate-100 text-xs text-slate-700 ${rowStyles(item.status)}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{item.id}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-1.5" style={{ paddingLeft: `${indentPx}px` }}>
                        {row.kind === "menuTitle" && row.hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleTitle(item.id)}
                            className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-white text-[10px] text-slate-700 hover:bg-slate-100"
                            aria-label={row.isExpanded ? "Collapse row" : "Expand row"}
                          >
                            {row.isExpanded ? "-" : "+"}
                          </button>
                        ) : (
                          <span className="inline-flex h-4 w-4 items-center justify-center text-slate-300">•</span>
                        )}
                        <span className={`break-words ${row.kind === "menuTitle" ? "font-semibold text-slate-900" : ""}`}>{label}</span>
                        {row.contextOnly ? (
                          <span className="inline-flex items-center rounded border border-slate-300 bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-600">
                            Context
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <ChangeTypeCounts counts={visibleChangeTypeCounts} />
                    </td>
                    <td className="px-3 py-2">
                      <ChangedFieldsCell item={item} selectedRelevancies={selectedRelevancySet} />
                    </td>
                    <td className="px-3 py-2">
                      {isEligible ? (
                        <AnalysisCell
                          item={item}
                          analysisKey={shortKey}
                          analysisResultsMap={analysisResultsMap}
                          runningKeys={runningKeys}
                          onRunOne={onRunOne}
                        />
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
