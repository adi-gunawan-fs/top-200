import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Database, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { useWeights } from "../contexts/WeightsContext";
import { rowStyles } from "./ui/StatusPill";
import { Badge } from "./ui/Badge";
import { Button, IconButton } from "./ui/Button";
import { Card } from "./ui/Card";
import { ChangeTypeCounts } from "./ui/ChangeTypeBadge";
import { ChangedFieldsModal } from "./ui/ChangedFieldsModal";
import { AnalysisCompareModal } from "./ui/AnalysisCompareModal";
import { DishSnapshotsModal } from "./ui/DishSnapshotsModal";
import { buildHierarchy } from "../utils/hierarchyUtils";
import { getAnalysisReviewStatus, getAnalysisReviewTone } from "../utils/analysisReview";
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

function AnalysisCell({ item, shortKey, job, modelNames, analysisResultsMap, runningKeys, onRunOne }) {
  const modelResults = analysisResultsMap[shortKey] ?? {};
  const isRunning = runningKeys.has(shortKey);
  const isFailed = job?.status === "failed";
  const hasAnyResult = modelNames.some((name) => modelResults[name] && !modelResults[name].error);
  const [modalOpen, setModalOpen] = useState(false);
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);

  async function handleRun(replaceExisting = false) {
    setIsSending(true);
    try {
      await onRunOne(item, { replaceExisting });
    } finally {
      setIsSending(false);
    }
  }

  if (isSending) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Sending…
      </span>
    );
  }

  if (isRunning) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analysing…
      </span>
    );
  }

  if (isFailed && !hasAnyResult) {
    const errorMessage = job?.error_message ?? "";

    return (
      <div className="flex max-w-64 flex-col gap-1">
        <span className="text-[10px] font-semibold text-rose-500" title={job?.error_message ?? "Analysis failed"}>
          Failed
        </span>
        {errorMessage ? (
          <>
            <span
              className={`${errorExpanded ? "whitespace-pre-wrap break-words" : "line-clamp-2"} text-[10px] text-rose-600`}
              title={errorMessage}
            >
              {errorMessage}
            </span>
            <button
              type="button"
              className="w-fit text-[10px] font-semibold text-rose-700 hover:text-rose-900 hover:underline focus:outline-none"
              onClick={() => setErrorExpanded((prev) => !prev)}
            >
              {errorExpanded ? "Show less" : "Show full error"}
            </button>
          </>
        ) : null}
        <Button variant="tonal" tone="warning" size="xs" onClick={() => handleRun(true)}>
          <RefreshCw className="h-2.5 w-2.5" />
          Re-run
        </Button>
      </div>
    );
  }

  if (!hasAnyResult) {
    return (
      <Button variant="tonal" tone="info" size="xs" onClick={() => handleRun(false)}>
        <Sparkles className="h-2.5 w-2.5" />
        {isFailed ? "Retry" : "Run"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <IconButton onClick={() => setModalOpen(true)} title="Compare models" aria-label="Compare models">
        <Search className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        tone="warning"
        onClick={() => handleRun(true)}
        title="Re-run analysis and replace previous data"
        aria-label="Re-run analysis and replace previous data"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </IconButton>

      {modalOpen && (
        <AnalysisCompareModal
          itemLabel={item.name || item.title || String(item.id)}
          itemId={item.id}
          item={item}
          modelNames={modelNames}
          modelResults={modelResults}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

function AnalysisStatusCell({ shortKey, modelNames, analysisResultsMap, runningKeys, isEligible, weights, difficultyThreshold }) {
  if (!isEligible) {
    return <span className="text-slate-400">-</span>;
  }

  if (runningKeys.has(shortKey)) {
    return <span className="text-slate-400">-</span>;
  }

  const status = getAnalysisReviewStatus(analysisResultsMap[shortKey], modelNames, weights, difficultyThreshold);
  if (!status) {
    return <span className="text-slate-400">-</span>;
  }

  const icon = status === "Critical Review"
    ? <AlertTriangle className="h-2.5 w-2.5" />
    : status === "Low Review"
      ? <AlertTriangle className="h-2.5 w-2.5" />
      : null;

  return (
    <Badge tone={getAnalysisReviewTone(status)} uppercase={false}>
      {icon}
      {status}
    </Badge>
  );
}

function SnapshotsCell({ item, afterRecord }) {
  const [open, setOpen] = useState(false);
  if (!afterRecord) return <span className="text-slate-400">-</span>;

  return (
    <>
      <IconButton
        title="View dish snapshots"
        aria-label="View dish snapshots"
        onClick={() => setOpen(true)}
      >
        <Database className="h-3.5 w-3.5" />
      </IconButton>
      {open ? (
        <DishSnapshotsModal
          dishId={item.id}
          afterDate={afterRecord.createdAt}
          dishName={item.name}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

// Collect all menu titles in depth-first order (flattened hierarchy)
function flattenTitles(nodes, depth = 0, out = []) {
  nodes.forEach((node) => {
    out.push({ node, depth });
    flattenTitles(node.children, depth + 1, out);
  });
  return out;
}

function MenuTitlesTable({ filteredRoots, selectedRelevancySet }) {
  const titleRows = useMemo(() => flattenTitles(filteredRoots), [filteredRoots]);

  return (
    <div className="max-h-[40vh] overflow-auto">
      <table className="min-w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-36" />
          <col className="w-[500px]" />
          <col className="w-60" />
          <col className="w-[320px]" />
          <col className="w-40" />
        </colgroup>
        <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
          <tr>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">ID</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Title</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Relevancies</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Changed Fields</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {titleRows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-3 py-4 text-xs text-slate-500">No menu title changes to display.</td>
            </tr>
          ) : (
            titleRows.map(({ node, depth }) => {
              const item = node.item;
              const indentPx = depth * 20;
              const visibleChangedFields = filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancySet)
                .filter((field) => !shouldHideChangedField(item, field));
              const visibleChangeTypeCounts = getVisibleChangeTypeCounts(visibleChangedFields);

              return (
                <tr key={`title-${node.id}`} className={`border-b border-slate-100 text-xs text-slate-700 ${rowStyles(item.status)}`}>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.id}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-1.5" style={{ paddingLeft: `${indentPx}px` }}>
                      <span className="font-semibold text-slate-900 break-words">{item.title || "-"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <ChangeTypeCounts counts={visibleChangeTypeCounts} />
                  </td>
                  <td className="px-3 py-2">
                    <ChangedFieldsCell item={item} selectedRelevancies={selectedRelevancySet} />
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-slate-400">-</span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

const PAGE_SIZE = 20;

function DishesTable({
  filteredRoots,
  filteredOrphanDishes,
  selectedRelevancySet,
  analysisResultsMap,
  analysisJobsMap,
  runningKeys,
  onRunOne,
  eligibleItemKeys,
  modelNames,
  afterRecord,
  weights,
  difficultyThreshold,
}) {
  const [page, setPage] = useState(0);
  const [selectedGroupKey, setSelectedGroupKey] = useState("all");

  // Flat list of dishes in order, each carrying its group info
  const dishEntries = useMemo(() => {
    const entries = [];

    const walkTitles = (node) => {
      const allDishes = [];
      const collectDishes = (n) => {
        n.dishes.forEach((dish) => allDishes.push(dish));
        n.children.forEach(collectDishes);
      };
      collectDishes(node);

      allDishes.forEach((dish) => {
        entries.push({ dish, groupKey: `group-${node.id}`, groupLabel: node.item.title || `Menu Title ${node.item.id}` });
      });

      node.children.forEach(walkTitles);
    };

    filteredRoots.forEach(walkTitles);

    filteredOrphanDishes.forEach((dish) => {
      entries.push({ dish, groupKey: "group-orphan", groupLabel: "No Menu Title" });
    });

    return entries;
  }, [filteredRoots, filteredOrphanDishes]);

  // Unique menu title options for the filter dropdown
  const groupOptions = useMemo(() => {
    const seen = new Map();
    dishEntries.forEach(({ groupKey, groupLabel }) => {
      if (!seen.has(groupKey)) seen.set(groupKey, groupLabel);
    });
    return Array.from(seen.entries()).map(([key, label]) => ({ key, label }));
  }, [dishEntries]);

  // Reset page and filter when underlying data changes
  useEffect(() => { setPage(0); setSelectedGroupKey("all"); }, [dishEntries]);

  const filteredEntries = selectedGroupKey === "all"
    ? dishEntries
    : dishEntries.filter((e) => e.groupKey === selectedGroupKey);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageEntries = filteredEntries.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const [menuTitleSearch, setMenuTitleSearch] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const comboboxRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allOptions = useMemo(() => [{ key: "all", label: "All" }, ...groupOptions], [groupOptions]);
  const currentIndex = allOptions.findIndex((o) => o.key === selectedGroupKey);
  const selectedLabel = allOptions[currentIndex]?.label ?? "All";

  const filteredGroupOptions = useMemo(() => {
    if (!menuTitleSearch.trim()) return allOptions;
    const q = menuTitleSearch.toLowerCase();
    return allOptions.filter((o) => o.label.toLowerCase().includes(q));
  }, [allOptions, menuTitleSearch]);

  function selectGroup(key) {
    setSelectedGroupKey(key);
    setPage(0);
    setMenuTitleSearch("");
    setDropdownOpen(false);
  }

  function stepGroup(dir) {
    const next = currentIndex + dir;
    if (next >= 0 && next < allOptions.length) {
      setSelectedGroupKey(allOptions[next].key);
      setPage(0);
    }
  }

  return (
    <div>
    {groupOptions.length > 1 && (
      <div className="flex items-center gap-0 border-b border-slate-200 bg-white">
        <span className="border-r border-slate-200 px-3 py-2 text-xs font-semibold text-blue-600">Menu titles</span>
        <button
          type="button"
          onClick={() => stepGroup(-1)}
          disabled={currentIndex <= 0}
          className="border-r border-slate-200 px-2 py-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous menu title"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div ref={comboboxRef} className="relative flex-1">
          <div className="flex items-center">
            <input
              type="text"
              placeholder={selectedGroupKey === "all" ? "Filter by Menu Titles..." : selectedLabel}
              value={dropdownOpen ? menuTitleSearch : ""}
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => { setMenuTitleSearch(e.target.value); setDropdownOpen(true); }}
              className="w-full bg-transparent px-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:outline-none"
            />
            {!dropdownOpen && (
              <span className="pointer-events-none absolute left-3 text-xs text-slate-700">
                {selectedGroupKey === "all" ? <span className="text-slate-400">Filter by Menu Titles...</span> : selectedLabel}
              </span>
            )}
            <svg className="mr-2 h-3.5 w-3.5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
          </div>
          {dropdownOpen && (
            <ul className="absolute left-0 top-full z-30 max-h-56 w-full overflow-auto rounded-b border border-t-0 border-slate-200 bg-white shadow-md">
              {filteredGroupOptions.length === 0 ? (
                <li className="px-3 py-2 text-xs text-slate-400">No results</li>
              ) : (
                filteredGroupOptions.map(({ key, label }) => (
                  <li
                    key={key}
                    onMouseDown={() => selectGroup(key)}
                    className={`cursor-pointer px-3 py-1.5 text-xs hover:bg-slate-50 ${key === selectedGroupKey ? "font-semibold text-blue-600" : "text-slate-700"}`}
                  >
                    {label}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        <button
          type="button"
          onClick={() => stepGroup(1)}
          disabled={currentIndex >= allOptions.length - 1}
          className="border-l border-slate-200 px-2 py-2 text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next menu title"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>
    )}
    <div className="max-h-[60vh] overflow-auto">
      <table className="min-w-full table-fixed border-collapse">
        <colgroup>
          <col className="w-36" />
          <col className="w-[420px]" />
          <col className="w-60" />
          <col className="w-[320px]" />
          <col className="w-40" />
          <col className="w-72" />
          <col className="w-24" />
        </colgroup>
        <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
          <tr>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">ID</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Name</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Relevancies</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Changed Fields</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Status</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Analysis</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Snapshots</th>
          </tr>
        </thead>
        <tbody>
          {pageEntries.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-4 text-xs text-slate-500">No dish changes to display.</td>
            </tr>
          ) : (
            pageEntries.map(({ dish }) => {
              const item = dish;
              const visibleChangedFields = filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancySet)
                .filter((field) => !shouldHideChangedField(item, field));
              const visibleChangeTypeCounts = getVisibleChangeTypeCounts(visibleChangedFields);
              const shortKey = `${item.id}__${item.type}`;
              const isEligible = eligibleItemKeys?.has(shortKey);

              return (
                <tr key={`dish-${item.id}`} className={`border-b border-slate-100 text-xs text-slate-700 ${rowStyles(item.status)}`}>
                  <td className="px-3 py-2 font-medium text-slate-900">{item.id}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-start gap-1.5">
                      <span className="inline-flex h-4 w-4 items-center justify-center text-slate-300">•</span>
                      <span className="break-words">{item.name || "-"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <ChangeTypeCounts counts={visibleChangeTypeCounts} />
                  </td>
                  <td className="px-3 py-2">
                    <ChangedFieldsCell item={item} selectedRelevancies={selectedRelevancySet} />
                  </td>
                  <td className="px-3 py-2">
                    <AnalysisStatusCell
                      shortKey={shortKey}
                      modelNames={modelNames ?? []}
                      analysisResultsMap={analysisResultsMap}
                      runningKeys={runningKeys}
                      isEligible={isEligible}
                      weights={weights}
                      difficultyThreshold={difficultyThreshold}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {isEligible ? (
                      <AnalysisCell
                        item={item}
                        shortKey={shortKey}
                        job={analysisJobsMap?.[shortKey]}
                        modelNames={modelNames ?? []}
                        analysisResultsMap={analysisResultsMap}
                        runningKeys={runningKeys}
                        onRunOne={onRunOne}
                      />
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <SnapshotsCell item={item} afterRecord={afterRecord} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
    {filteredEntries.length > 0 && (
      <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
        <span className="text-xs text-slate-500">
          {`${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, filteredEntries.length)} of ${filteredEntries.length} dishes`}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage === 0}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-1 text-xs text-slate-600">{safePage + 1} / {totalPages}</span>
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    )}
    </div>
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
  analysisJobsMap,
  runningKeys,
  onRunOne,
  eligibleItemKeys,
  modelNames,
  afterRecord,
}) {
  const { weights, difficultyThreshold } = useWeights();
  const selectedRelevancySet = useMemo(() => new Set(selectedRelevancies), [selectedRelevancies]);
  const { roots, orphanDishes } = useMemo(
    () => buildHierarchy(menuTitleRows, dishRows),
    [menuTitleRows, dishRows],
  );
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

  return (
    <Card className="overflow-visible">
      <Card.Header><span>Menu Structure</span></Card.Header>
      <Card.Toolbar>
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
      </Card.Toolbar>

      <div className="border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Menu Titles</span>
      </div>
      <MenuTitlesTable
        filteredRoots={filteredRoots}
        selectedRelevancySet={selectedRelevancySet}
      />

      <div className="border-y border-slate-200 px-3 py-2">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Dishes</span>
      </div>
      <DishesTable
        filteredRoots={filteredRoots}
        filteredOrphanDishes={filteredOrphanDishes}
        selectedRelevancySet={selectedRelevancySet}
        analysisResultsMap={analysisResultsMap}
        analysisJobsMap={analysisJobsMap}
        runningKeys={runningKeys}
        onRunOne={onRunOne}
        eligibleItemKeys={eligibleItemKeys}
        modelNames={modelNames}
        afterRecord={afterRecord}
        weights={weights}
        difficultyThreshold={difficultyThreshold}
      />
    </Card>
  );
}
