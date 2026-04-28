import { useEffect, useMemo, useState } from "react";
import { StatusPill, rowStyles } from "./ui/StatusPill";
import { challengeCell } from "./ui/ChallengeBadge";
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

export function UnifiedExpandableTable({
  menuTitleRows,
  dishRows,
  selectedStatuses,
  setSelectedStatuses,
  selectedRelevancies,
  setSelectedRelevancies,
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
            <col className="w-36" />
            <col className="w-60" />
            <col className="w-[560px]" />
          </colgroup>
          <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">ID</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Title / Name</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Challenge</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Relevancies</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Changed Fields</th>
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
                      {challengeCell(item)}
                    </td>
                    <td className="px-3 py-2">
                      <ChangeTypeCounts counts={visibleChangeTypeCounts} />
                    </td>
                    <td className="px-3 py-2">
                      <ChangedFieldsCell item={item} selectedRelevancies={selectedRelevancySet} />
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
