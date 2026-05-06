import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { useWeights } from "../contexts/WeightsContext";
import { rowStyles } from "./ui/StatusPill";
import { Badge } from "./ui/Badge";
import { Button, IconButton } from "./ui/Button";
import { Card } from "./ui/Card";
import { ChangeTypeCounts } from "./ui/ChangeTypeBadge";
import { ChangedFieldsModal } from "./ui/ChangedFieldsModal";
import { AnalysisCompareModal } from "./ui/AnalysisCompareModal";
import { fetchDishSnapshots } from "../lib/dbFetch";
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

function cleanHtmlText(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatAddons(value) {
  if (value == null) return "";
  if (Array.isArray(value)) {
    const parts = value
      .map((v) => (v && typeof v === "object" ? v.text ?? v.innerText ?? null : v))
      .filter((v) => v != null);
    return cleanHtmlText(parts.join(" "));
  }
  if (typeof value === "object") return cleanHtmlText(value.text ?? value.innerText ?? "");
  return cleanHtmlText(value);
}

const TRUNCATE_LIMIT = 200;

function ExpandableText({ text }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return <span className="text-slate-400">—</span>;
  const isLong = text.length > TRUNCATE_LIMIT;
  if (!isLong) return <span className="break-words text-slate-700">{text}</span>;
  return (
    <span className="break-words text-slate-700">
      {expanded ? text : `${text.slice(0, TRUNCATE_LIMIT).trimEnd()}… `}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="ml-1 text-blue-700 hover:text-blue-900 hover:underline focus:outline-none"
      >
        {expanded ? "See less" : "See more"}
      </button>
    </span>
  );
}

const INLINE_SNAPSHOT_COLUMNS = [
  { key: "type", label: "Type", nowrap: true },
  { key: "createdAt", label: "Created At", nowrap: true },
  { key: "dishType", label: "Dish Type", narrow: true },
  { key: "courseType", label: "Course Type", narrow: true },
  { key: "diets", label: "Diets", narrow: true },
  { key: "allergens", label: "Allergens", narrow: true },
  { key: "mainIngredients", label: "Main Ingredients", wide: true },
  { key: "choiceIngredients", label: "Choice Ingredients", wide: true },
  { key: "additionalIngredients", label: "Additional Ingredients", wide: true },
  { key: "certainty", label: "Certainty", nowrap: true, pct: true },
  { key: "miscAndChoiceCertainty", label: "Misc & Choice", nowrap: true, pct: true },
  { key: "dishTypeCertainty", label: "Dish Type Cert.", nowrap: true, pct: true },
  { key: "courseTypeCertainty", label: "Course Type Cert.", nowrap: true, pct: true },
  { key: "dietsCertainty", label: "Diets Cert.", nowrap: true, pct: true },
  { key: "allergensCertainty", label: "Allergens Cert.", nowrap: true, pct: true },
  { key: "ingredientsCertainty", label: "Ingredients Cert.", nowrap: true, pct: true },
];

function formatSnapshotValue(value, pct = false) {
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  if (Array.isArray(value)) return value.length === 0 ? <span className="text-slate-400">—</span> : value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && value.includes("T") && value.includes("Z")) return new Date(value).toLocaleString();
  if (pct && typeof value === "number") return `${(value * 100).toFixed(2)}%`;
  return String(value);
}

function SnapshotValue({ col, value }) {
  return formatSnapshotValue(value, col.pct);
}

// Renders the inline snapshot <td> cells for a single snapshot row (or a placeholder/error/empty state).
// `snapshot` is the snapshot row object, or null when rendering a placeholder.
// `placeholder` is one of: "noAfter", "error", "loading", "empty", or null (real snapshot).
function SnapshotCells({ snapshot, placeholder, errorMessage, stickyBg, isScrolledX }) {
  const cellShadow = isScrolledX ? { boxShadow: "8px 0 12px -4px rgba(15, 23, 42, 0.25)" } : undefined;
  const stickyStyle = { left: "420px", ...cellShadow };

  const renderTypeSeparator = () => (
    isScrolledX ? <span aria-hidden="true" className="pointer-events-none absolute right-0 w-px bg-slate-400" style={{ top: "-1px", bottom: "-1px" }} /> : null
  );

  const placeholderContent = (() => {
    if (placeholder === "noAfter") return { text: "-", cls: "text-slate-400" };
    if (placeholder === "error") return { text: errorMessage, cls: "text-rose-500 text-xs" };
    if (placeholder === "loading") return { text: "", cls: "" };
    if (placeholder === "empty") return { text: "No snapshots", cls: "text-slate-400 text-xs" };
    return null;
  })();

  if (placeholderContent) {
    return INLINE_SNAPSHOT_COLUMNS.map((col) => {
      if (col.key === "type") {
        return (
          <td
            key={col.key}
            className={`sticky z-[5] px-3 py-2 align-top relative ${stickyBg ?? "bg-white"} ${placeholderContent.cls}`}
            style={stickyStyle}
          >
            {placeholderContent.text}
            {renderTypeSeparator()}
          </td>
        );
      }
      return (
        <td key={col.key} className={`px-3 py-2 align-top ${placeholderContent.cls}`}>
          {col.key === INLINE_SNAPSHOT_COLUMNS[1]?.key && placeholder !== "loading" ? "" : ""}
        </td>
      );
    });
  }

  return INLINE_SNAPSHOT_COLUMNS.map((col) => {
    if (col.key === "type") {
      return (
        <td
          key={col.key}
          className={`sticky z-[5] px-3 py-2 text-xs text-slate-700 align-top whitespace-nowrap relative ${stickyBg ?? "bg-white"}`}
          style={stickyStyle}
        >
          <SnapshotValue col={col} value={snapshot[col.key]} />
          {renderTypeSeparator()}
        </td>
      );
    }
    return (
      <td key={col.key} className={`px-3 py-2 text-xs text-slate-700 align-top${col.nowrap ? " whitespace-nowrap" : col.narrow ? " w-40" : ""}`}>
        <SnapshotValue col={col} value={snapshot[col.key]} />
      </td>
    );
  });
}

// Collect all menu titles in depth-first order (flattened hierarchy), skipping context-only nodes
function flattenTitles(nodes, depth = 0, out = []) {
  nodes.forEach((node) => {
    if (!node.contextOnly) {
      out.push({ node, depth });
    }
    flattenTitles(node.children, depth + 1, out);
  });
  return out;
}

function MenuTitlesTable({ filteredRoots, selectedRelevancySet, analysisResultsMap, analysisJobsMap, runningKeys, onRunOne, eligibleItemKeys, modelNames, weights, difficultyThreshold }) {
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
          <col className="w-40" />
        </colgroup>
        <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
          <tr>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">ID</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Title</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Relevancies</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Changed Fields</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Status</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Analysis</th>
          </tr>
        </thead>
        <tbody>
          {titleRows.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-4 text-xs text-slate-500">No menu title changes to display.</td>
            </tr>
          ) : (
            titleRows.map(({ node, depth }) => {
              const item = node.item;
              const indentPx = depth * 20;
              const visibleChangedFields = filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancySet)
                .filter((field) => !shouldHideChangedField(item, field));
              const visibleChangeTypeCounts = getVisibleChangeTypeCounts(visibleChangedFields);

              const shortKey = `${item.id}__${item.type}`;
              const isEligible = eligibleItemKeys?.has(shortKey);

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
  const [scrollLeft, setScrollLeft] = useState(0);
  const [snapshotsByDishId, setSnapshotsByDishId] = useState({});
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  // Threshold = sum of column widths between Name (420) and Type:
  // description(360) + menuTitle(360) + ingredients(360) + addons(320) + relevancies(240) + changedFields(320) + status(160) + analysis(288) = 2408
  const TYPE_STICKY_THRESHOLD = 2408;

  const isScrolledX = scrollLeft >= TYPE_STICKY_THRESHOLD;
  const showNameLine = scrollLeft > 0 && !isScrolledX;
  const showTypeLine = isScrolledX;

  const handleScroll = (e) => {
    const next = e.currentTarget.scrollLeft;
    setScrollLeft((prev) => (prev === next ? prev : next));
  };

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
        entries.push({ dish, menuTitleItem: node.item, groupKey: `group-${node.id}`, groupLabel: node.item.title || `Menu Title ${node.item.id}` });
      });

      node.children.forEach(walkTitles);
    };

    filteredRoots.forEach(walkTitles);

    filteredOrphanDishes.forEach((dish) => {
      entries.push({ dish, menuTitleItem: null, groupKey: "group-orphan", groupLabel: "No Menu Title" });
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

  const pageDishIdsKey = pageEntries.map((e) => e.dish.id).join(",");
  useEffect(() => {
    // If afterRecord already has baked-in snapshots (from CSV export), use them directly
    if (afterRecord?.snapshots) {
      const map = {};
      pageEntries.forEach(({ dish }) => {
        const rows = afterRecord.snapshots[dish.id];
        map[dish.id] = rows !== undefined ? { rows, error: null } : { rows: [], error: null };
      });
      setSnapshotsByDishId(map);
      setSnapshotsLoading(false);
      return;
    }

    if (!afterRecord || pageEntries.length === 0) {
      setSnapshotsByDishId({});
      setSnapshotsLoading(false);
      return;
    }
    let cancelled = false;
    setSnapshotsLoading(true);
    setSnapshotsByDishId({});
    Promise.all(
      pageEntries.map((entry) =>
        fetchDishSnapshots(entry.dish.id, afterRecord.createdAt)
          .then((rows) => ({ id: entry.dish.id, rows, error: null }))
          .catch((err) => ({ id: entry.dish.id, rows: null, error: err.message }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map = {};
      results.forEach((r) => { map[r.id] = r; });
      setSnapshotsByDishId(map);
      setSnapshotsLoading(false);
    });
    return () => { cancelled = true; };
  }, [pageDishIdsKey, afterRecord]);

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
      <div className="relative z-[70] flex items-center gap-0 border-b border-slate-200 bg-white">
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
            <ul className="absolute left-0 top-full z-[100] max-h-56 w-full overflow-auto rounded-b border border-t-0 border-slate-200 bg-white shadow-md">
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
    {snapshotsLoading ? (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    ) : (
    <>
    <div onScroll={handleScroll} className="max-h-[80vh] overflow-auto overscroll-y-contain">
      <table className="table-fixed border-collapse" style={{ minWidth: "100%", width: "max-content" }}>
        <colgroup>
          <col style={{ width: "420px" }} />
          <col style={{ width: "360px" }} />
          <col style={{ width: "360px" }} />
          <col style={{ width: "360px" }} />
          <col style={{ width: "320px" }} />
          <col style={{ width: "240px" }} />
          <col style={{ width: "320px" }} />
          <col style={{ width: "160px" }} />
          <col style={{ width: "288px" }} />
          {INLINE_SNAPSHOT_COLUMNS.map((col) => <col key={col.key} style={{ width: col.wide ? "500px" : col.narrow ? "160px" : "180px" }} />)}
        </colgroup>
        <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
          <tr>
            <th className="sticky top-0 left-0 z-30 bg-slate-100 px-3 py-2 relative">
              Name
              {showNameLine && <span aria-hidden="true" className="pointer-events-none absolute right-0 w-px bg-slate-400" style={{ top: "-1px", bottom: "-1px" }} />}
            </th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Description</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Menu Title</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Ingredient Free Text</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Addson Descriptor</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Relevancies</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Changed Fields</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Status</th>
            <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Analysis</th>
            {INLINE_SNAPSHOT_COLUMNS.map((col) => (
              col.key === "type" ? (
                <th
                  key={col.key}
                  className="sticky top-0 z-30 bg-slate-100 px-3 py-2 transition-shadow relative"
                  style={isScrolledX ? { left: "420px", boxShadow: "8px 0 12px -4px rgba(15, 23, 42, 0.25)" } : { left: "420px" }}
                >
                  {col.label}
                  {isScrolledX && <span aria-hidden="true" className="pointer-events-none absolute right-0 w-px bg-slate-400" style={{ top: "-1px", bottom: "-1px" }} />}
                </th>
              ) : (
                <th key={col.key} className="sticky top-0 z-20 bg-slate-100 px-3 py-2">{col.label}</th>
              )
            ))}
          </tr>
        </thead>
        <tbody>
          {pageEntries.length === 0 ? (
            <tr>
              <td colSpan={9 + INLINE_SNAPSHOT_COLUMNS.length} className="px-3 py-4 text-xs text-slate-500">No dish changes to display.</td>
            </tr>
          ) : (
            pageEntries.flatMap(({ dish, menuTitleItem }) => {
              const item = dish;
              const visibleChangedFields = filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancySet)
                .filter((field) => !shouldHideChangedField(item, field));
              const visibleChangeTypeCounts = getVisibleChangeTypeCounts(visibleChangedFields);
              const shortKey = `${item.id}__${item.type}`;
              const isEligible = eligibleItemKeys?.has(shortKey);
              const dishDescription = item.after?.description ?? item.before?.description ?? "";
              const menuTitleName = menuTitleItem?.title ?? menuTitleItem?.after?.title ?? menuTitleItem?.before?.title ?? "";
              const menuTitleDescription = menuTitleItem?.after?.description ?? menuTitleItem?.before?.description ?? "";
              const ingredientFreeText = item.after?.ingredients ?? item.before?.ingredients ?? "";
              const addonDescriptor = formatAddons(item.after?.addons ?? item.before?.addons);

              const stickyBg = item.status === "new"
                ? "bg-emerald-50"
                : item.status === "updated"
                  ? "bg-amber-50"
                  : item.status === "deleted"
                    ? "bg-rose-50"
                    : "bg-white";

              const result = snapshotsByDishId[item.id];
              const snapshots = result?.rows ?? null;
              const error = result?.error ?? null;

              let placeholder = null;
              if (!afterRecord) placeholder = "noAfter";
              else if (error) placeholder = "error";
              else if (snapshots === null) placeholder = "loading";
              else if (snapshots.length === 0) placeholder = "empty";

              const snapshotRows = placeholder ? [null] : snapshots;
              const rowSpan = snapshotRows.length;
              const rowClass = `border-b border-slate-100 text-xs text-slate-700 ${rowStyles(item.status)}`;

              return snapshotRows.map((snapshot, snapIdx) => {
                const isFirst = snapIdx === 0;
                const isLast = snapIdx === snapshotRows.length - 1;
                // Hide the inter-snapshot border so a multi-snapshot dish reads as one row block
                const trClass = isLast ? rowClass : `text-xs text-slate-700 ${rowStyles(item.status)}`;

                return (
                  <tr key={`dish-${item.id}-${snapshot?.id ?? snapIdx}`} className={trClass}>
                    {isFirst && (
                      <>
                        <td rowSpan={rowSpan} className={`sticky left-0 z-10 px-3 py-2 font-medium text-slate-900 relative align-top ${stickyBg}`}>
                          <div className="flex items-start gap-1.5">
                            <span className="break-words">{item.name || "-"}</span>
                          </div>
                          {showNameLine && <span aria-hidden="true" className="pointer-events-none absolute right-0 w-px bg-slate-400" style={{ top: "-1px", bottom: "-1px" }} />}
                        </td>
                        <td rowSpan={rowSpan} className="px-3 py-2 align-top">
                          <span className="break-words text-slate-700">
                            {dishDescription || <span className="text-slate-400">—</span>}
                          </span>
                        </td>
                        <td rowSpan={rowSpan} className="px-3 py-2 align-top">
                          {menuTitleName || menuTitleDescription ? (
                            <div className="flex flex-col gap-0.5">
                              {menuTitleName && <span className="font-medium text-slate-900 break-words">{menuTitleName}</span>}
                              {menuTitleDescription && <span className="text-slate-500 break-words">{menuTitleDescription}</span>}
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td rowSpan={rowSpan} className="px-3 py-2 align-top">
                          <ExpandableText text={ingredientFreeText} />
                        </td>
                        <td rowSpan={rowSpan} className="px-3 py-2 align-top">
                          <ExpandableText text={addonDescriptor} />
                        </td>
                        <td rowSpan={rowSpan} className="px-3 py-2 align-top">
                          <ChangeTypeCounts counts={visibleChangeTypeCounts} />
                        </td>
                        <td rowSpan={rowSpan} className="px-3 py-2 align-top">
                          <ChangedFieldsCell item={item} selectedRelevancies={selectedRelevancySet} />
                        </td>
                        <td rowSpan={rowSpan} className="px-3 py-2 align-top">
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
                        <td rowSpan={rowSpan} className="px-3 py-2 align-top">
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
                      </>
                    )}
                    <SnapshotCells
                      snapshot={snapshot}
                      placeholder={placeholder}
                      errorMessage={error}
                      stickyBg={stickyBg}
                      isScrolledX={isScrolledX}
                    />
                  </tr>
                );
              });
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
    </>
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
        analysisResultsMap={analysisResultsMap}
        analysisJobsMap={analysisJobsMap}
        runningKeys={runningKeys}
        onRunOne={onRunOne}
        eligibleItemKeys={eligibleItemKeys}
        modelNames={modelNames}
        weights={weights}
        difficultyThreshold={difficultyThreshold}
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
