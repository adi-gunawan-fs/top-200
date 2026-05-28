import { useEffect, useState, useMemo } from "react";
import { Loader2, Search, ChevronLeft, ChevronRight, Download, FlaskConical } from "lucide-react";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { fetchDishCurationLinks } from "../../lib/api";
import { saveExperimentRows } from "../../lib/experiments";
import {
  fetchLatestAutoeatDishes,
  fetchDishDetails,
  fetchBrandMessageTimestamps,
  fetchBrandSnapshotAsOf,
  withLeafMenuTitleDetails,
} from "./dataFetchers";
import {
  STATUS_NEW,
  STATUS_UPDATED,
  STATUS_DELETED,
  STATUS_NO_CHANGE,
  STATUS_ROW_CLASS,
  computeDishStatus,
  hasExactFieldChange,
  formatTimestamp,
} from "./dishDiff";
import {
  buildCompareExportRows,
  applyExperimentFieldSelection,
  exportCompareCsv,
  exportToCsv,
} from "./csvExport";
import { MenuTitleChain, CurationList, dishCellText } from "./cells";

const PAGE_SIZE = 50;

function LargeBrandDishPage({ brand, viewMode = "latest", onBack, sessionUserId }) {
  const isCompare = viewMode === "compare";

  const [dishes, setDishes] = useState([]);
  const [statusByDishId, setStatusByDishId] = useState({});
  const [snapshotPair, setSnapshotPair] = useState({ before: null, after: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [curationLinks, setCurationLinks] = useState({});
  const [exportPrompt, setExportPrompt] = useState(false);
  const [exportLimit, setExportLimit] = useState("");
  const [sendingExperiment, setSendingExperiment] = useState(false);
  const [experimentToast, setExperimentToast] = useState("");
  const [sendPrompt, setSendPrompt] = useState(false);
  const [sendLimit, setSendLimit] = useState("");
  const [sendFields, setSendFields] = useState({
    name: true,
    description: true,
    ingredient: true,
    addons: true,
    allergens: true,
    diets: true,
  });
  const [selectedExperimentIds, setSelectedExperimentIds] = useState(() => new Set());
  const [statusFilter, setStatusFilter] = useState("all");

  const [timestamps, setTimestamps] = useState([]);
  const [beforeAt, setBeforeAt] = useState("");
  const [afterAt, setAfterAt] = useState("");

  useEffect(() => {
    if (!isCompare) return;
    setLoading(true);
    setError("");
    fetchBrandMessageTimestamps(brand.brandId)
      .then((rows) => {
        setTimestamps(rows);
        const distinct = [...new Set(rows.map((r) => r.createdAt))].sort((a, b) => b.localeCompare(a));
        if (distinct.length >= 2) {
          setAfterAt(distinct[0]);
          setBeforeAt(distinct[1]);
        } else if (distinct.length === 1) {
          setAfterAt(distinct[0]);
          setBeforeAt(distinct[0]);
        }
      })
      .catch((err) => setError(err.message ?? "Failed to load timestamps."))
      .finally(() => setLoading(false));
  }, [brand.brandId, isCompare]);

  useEffect(() => {
    if (isCompare) return;
    setLoading(true);
    setError("");

    fetchLatestAutoeatDishes(brand.brandId)
      .then(async ({ dishMap, menuTitleChains }) => {
        if (dishMap.size === 0) {
          setDishes([]);
          return;
        }

        const autoeatIds = [...dishMap.keys()];
        const details = await fetchDishDetails(autoeatIds);

        const enriched = details.map((d) => ({
          ...d,
          menuAutoeatId: dishMap.get(d.autoeatDishId),
          menuTitleChain: withLeafMenuTitleDetails(menuTitleChains.get(d.autoeatDishId) ?? [], d),
        }));
        setDishes(enriched);

        const pairs = enriched.map((d) => ({
          dishId: String(d.autoeatDishId),
          menuAutoeatId: String(d.menuAutoeatId),
        }));
        fetchDishCurationLinks(pairs).then(setCurationLinks).catch(() => {});
      })
      .catch((err) => setError(err.message ?? "Failed to load dishes."))
      .finally(() => setLoading(false));
  }, [brand.brandId, isCompare]);

  useEffect(() => {
    if (!isCompare || !beforeAt || !afterAt) return;
    setLoading(true);
    setError("");
    setStatusByDishId({});

    Promise.all([
      fetchBrandSnapshotAsOf(brand.brandId, beforeAt),
      fetchBrandSnapshotAsOf(brand.brandId, afterAt),
    ])
      .then(async ([before, after]) => {
        const allDishIds = new Set([...before.dishById.keys(), ...after.dishById.keys()]);

        const statusMap = {};
        for (const dishId of allDishIds) {
          statusMap[dishId] = computeDishStatus(
            before.dishById.get(dishId) ?? null,
            after.dishById.get(dishId) ?? null,
          );
        }
        setStatusByDishId(statusMap);
        setSnapshotPair({ before: before.dishById, after: after.dishById });

        if (allDishIds.size === 0) {
          setDishes([]);
          return;
        }

        const dishMap = new Map(after.dishMap);
        const menuTitleChains = new Map(after.menuTitleChains);
        for (const dishId of allDishIds) {
          if (!dishMap.has(dishId) && before.dishMap.has(dishId)) {
            dishMap.set(dishId, before.dishMap.get(dishId));
          }
          if (!menuTitleChains.has(dishId) && before.menuTitleChains.has(dishId)) {
            menuTitleChains.set(dishId, before.menuTitleChains.get(dishId));
          }
        }

        const details = await fetchDishDetails([...allDishIds]);
        const enriched = details.map((d) => ({
          ...d,
          menuAutoeatId: dishMap.get(d.autoeatDishId),
          menuTitleChain: withLeafMenuTitleDetails(menuTitleChains.get(d.autoeatDishId) ?? [], d),
        }));
        setDishes(enriched);

        const pairs = enriched
          .filter((d) => d.menuAutoeatId != null)
          .map((d) => ({ dishId: String(d.autoeatDishId), menuAutoeatId: String(d.menuAutoeatId) }));
        fetchDishCurationLinks(pairs).then(setCurationLinks).catch(() => {});
      })
      .catch((err) => setError(err.message ?? "Failed to load comparison."))
      .finally(() => setLoading(false));
  }, [brand.brandId, isCompare, beforeAt, afterAt]);

  useEffect(() => { setPage(0); }, [search, statusFilter]);

  const visibleDishes = useMemo(() => {
    let list = dishes;
    if (isCompare && statusFilter !== "all") {
      list = list.filter((d) => statusByDishId[d.autoeatDishId] === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => (d.dishName ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [dishes, search, isCompare, statusFilter, statusByDishId]);

  const statusCounts = useMemo(() => {
    if (!isCompare) return null;
    const counts = { [STATUS_NEW]: 0, [STATUS_UPDATED]: 0, [STATUS_DELETED]: 0, [STATUS_NO_CHANGE]: 0 };
    for (const d of dishes) {
      const s = statusByDishId[d.autoeatDishId];
      if (s && counts[s] !== undefined) counts[s] += 1;
    }
    return counts;
  }, [dishes, isCompare, statusByDishId]);

  const totalPages = Math.ceil(visibleDishes.length / PAGE_SIZE);
  const paginated = visibleDishes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectedFilteredCount = visibleDishes.filter((d) => selectedExperimentIds.has(String(d.autoeatDishId))).length;

  async function handleSendToExperiment() {
    if (!isCompare || !sessionUserId || visibleDishes.length === 0) return;
    const selectedRows = visibleDishes.filter((d) => selectedExperimentIds.has(String(d.autoeatDishId)));
    if (selectedRows.length === 0) {
      setError("Select at least one row before sending to Experiment.");
      return;
    }
    const limit = sendLimit ? Math.min(parseInt(sendLimit, 10) || 0, selectedRows.length) : selectedRows.length;
    const selectedCount = Object.values(sendFields).filter(Boolean).length;
    if (selectedCount === 0) {
      setError("Select at least one field before sending to Experiment.");
      return;
    }
    const slice = selectedRows.slice(0, limit);
    setSendingExperiment(true);
    setError("");
    setExperimentToast("");
    try {
      const rows = buildCompareExportRows(slice, brand.brandName, snapshotPair);
      const selectedFieldRows = applyExperimentFieldSelection(rows, sendFields);
      const result = await saveExperimentRows(sessionUserId, selectedFieldRows);
      setExperimentToast(`Sent ${result?.inserted ?? selectedFieldRows.length} rows to Experiment.`);
      setSendPrompt(false);
      setSendLimit("");
    } catch (err) {
      setError(err?.message ?? "Failed to send rows to Experiment.");
    } finally {
      setSendingExperiment(false);
    }
  }

  useEffect(() => {
    if (!experimentToast) return;
    const timer = setTimeout(() => setExperimentToast(""), 2600);
    return () => clearTimeout(timer);
  }, [experimentToast]);

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading dishes for {brand.brandName}…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col gap-4">
        <EmptyState message={error} tone="danger" />
      </section>
    );
  }

  const distinctTimestamps = [...new Set(timestamps.map((r) => r.createdAt))].sort((a, b) => b.localeCompare(a));

  return (
    <>
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div>
            <h2 className="text-sm font-semibold text-slate-700">{brand.brandName}</h2>
            <p className="text-[11px] text-slate-400">
              {isCompare ? `Compare · ${visibleDishes.length} dishes` : `Latest snapshot · ${visibleDishes.length} dishes`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search dish name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            />
          </div>
          {exportPrompt ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                placeholder={`Limit (max ${visibleDishes.length})`}
                value={exportLimit}
                onChange={(e) => setExportLimit(e.target.value)}
                className="w-36 rounded-md border border-slate-300 bg-white py-1.5 px-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <Button
                variant="tonal"
                tone="info"
                onClick={() => {
                  const limit = exportLimit ? Math.min(parseInt(exportLimit, 10), visibleDishes.length) : visibleDishes.length;
                  const slice = visibleDishes.slice(0, limit);
                  if (isCompare) {
                    const withStatus = slice.map((d) => ({ ...d, _status: statusByDishId[d.autoeatDishId] ?? "" }));
                    exportCompareCsv(withStatus, curationLinks, brand.brandName, snapshotPair);
                  } else {
                    exportToCsv(slice, curationLinks, brand.brandName);
                  }
                  setExportPrompt(false);
                  setExportLimit("");
                }}
              >
                <Download className="h-3.5 w-3.5" />
                {exportLimit ? `Export ${Math.min(parseInt(exportLimit, 10) || 0, visibleDishes.length)} rows` : `Export all ${visibleDishes.length}`}
              </Button>
              <button
                type="button"
                onClick={() => { setExportPrompt(false); setExportLimit(""); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              {isCompare && (
                sendPrompt ? (
                  <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
                    <input
                      type="number"
                      min="1"
                      placeholder={`Limit (max ${selectedFilteredCount})`}
                      value={sendLimit}
                      onChange={(e) => setSendLimit(e.target.value)}
                      className="w-36 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                    />
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      {[
                        ["name", "Name"],
                        ["description", "Desc"],
                        ["ingredient", "Ing"],
                        ["addons", "Add"],
                        ["allergens", "Allg"],
                        ["diets", "Diet"],
                      ].map(([key, label]) => (
                        <label key={key} className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={!!sendFields[key]}
                            onChange={(e) => setSendFields((prev) => ({ ...prev, [key]: e.target.checked }))}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <span className="text-[11px] text-slate-500">{selectedFilteredCount} selected</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(selectedExperimentIds);
                        visibleDishes.forEach((d) => next.add(String(d.autoeatDishId)));
                        setSelectedExperimentIds(next);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Select all filtered
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const next = new Set(selectedExperimentIds);
                        visibleDishes.forEach((d) => next.delete(String(d.autoeatDishId)));
                        setSelectedExperimentIds(next);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Clear filtered
                    </button>
                    <Button
                      variant="tonal"
                      tone="warning"
                      onClick={handleSendToExperiment}
                      disabled={selectedFilteredCount === 0 || sendingExperiment}
                    >
                      <FlaskConical className="h-3.5 w-3.5" />
                      {sendingExperiment ? "Sending…" : "Send"}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setSendPrompt(false); setSendLimit(""); }}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="tonal"
                    tone="warning"
                    onClick={() => setSendPrompt(true)}
                    disabled={visibleDishes.length === 0 || sendingExperiment}
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    Send to Experiment
                  </Button>
                )
              )}
              <Button
                variant="tonal"
                tone="info"
                onClick={() => setExportPrompt(true)}
                disabled={visibleDishes.length === 0}
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </>
          )}
        </div>
      </div>
      {isCompare && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">Before</span>
            <select
              value={beforeAt}
              onChange={(e) => setBeforeAt(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {distinctTimestamps.map((ts) => (
                <option key={ts} value={ts}>{formatTimestamp(ts)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">After</span>
            <select
              value={afterAt}
              onChange={(e) => setAfterAt(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {distinctTimestamps.map((ts) => (
                <option key={ts} value={ts}>{formatTimestamp(ts)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All</option>
              <option value={STATUS_NEW}>New {statusCounts ? `(${statusCounts[STATUS_NEW]})` : ""}</option>
              <option value={STATUS_UPDATED}>Updated {statusCounts ? `(${statusCounts[STATUS_UPDATED]})` : ""}</option>
              <option value={STATUS_DELETED}>Deleted {statusCounts ? `(${statusCounts[STATUS_DELETED]})` : ""}</option>
              <option value={STATUS_NO_CHANGE}>No Change {statusCounts ? `(${statusCounts[STATUS_NO_CHANGE]})` : ""}</option>
            </select>
          </label>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                {isCompare && sendPrompt ? (
                  <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Pick</th>
                ) : null}
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Dish ID</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Dish Name</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Description</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Menu Title</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Diet Descriptors</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Addon Descriptors</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Allergen Descriptors</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Dish Type</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Course Type</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Main Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Additional Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Choice Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Diets</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Allergens</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={isCompare && sendPrompt ? 16 : 15} className="px-4 py-6 text-center text-slate-400">No dishes found.</td>
                </tr>
              ) : (
                paginated.map((dish) => {
                  const link = curationLinks[String(dish.autoeatDishId)] ?? null;
                  const status = statusByDishId[dish.autoeatDishId];
                  const rowHighlight = isCompare && status ? STATUS_ROW_CLASS[status] ?? "" : "";
                  const beforeDish = isCompare ? snapshotPair.before?.get(dish.autoeatDishId) ?? null : null;
                  const afterDish = isCompare ? snapshotPair.after?.get(dish.autoeatDishId) ?? null : null;
                  const highlightChangedCell = (field) =>
                    isCompare && status === STATUS_UPDATED && hasExactFieldChange(beforeDish, afterDish, field)
                      ? "bg-rose-100"
                      : "";
                  return (
                    <tr
                      key={dish.dishId}
                      className={`border-b border-slate-100 last:border-b-0 text-slate-700 align-top ${rowHighlight}`}
                    >
                      {isCompare && sendPrompt ? (
                        <td className="px-3 py-2 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedExperimentIds.has(String(dish.autoeatDishId))}
                            onChange={(e) => {
                              const next = new Set(selectedExperimentIds);
                              const key = String(dish.autoeatDishId);
                              if (e.target.checked) next.add(key);
                              else next.delete(key);
                              setSelectedExperimentIds(next);
                            }}
                          />
                        </td>
                      ) : null}
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:underline"
                          >
                            {dish.dishId}
                          </a>
                        ) : (
                          dish.dishId
                        )}
                      </td>
                      <td className={`px-3 py-2 font-medium text-slate-900 whitespace-nowrap ${highlightChangedCell("name")}`}>{dishCellText(dish.dishName)}</td>
                      <td className={`px-3 py-2 max-w-xs text-slate-600 ${highlightChangedCell("description")}`}>{dishCellText(dish.dishDescription)}</td>
                      <td className="px-3 py-2 min-w-[160px]"><MenuTitleChain chain={dish.menuTitleChain} /></td>
                      <td className={`px-3 py-2 ${highlightChangedCell("ingredients")}`}>{dishCellText(dish.ingredients)}</td>
                      <td className={`px-3 py-2 ${highlightChangedCell("diets")}`}>{dishCellText(dish.dietDescriptors)}</td>
                      <td className={`px-3 py-2 ${highlightChangedCell("addons")}`}>{dishCellText(dish.addonDescriptors)}</td>
                      <td className={`px-3 py-2 ${highlightChangedCell("allergens")}`}>{dishCellText(dish.allergenDescriptors)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{dishCellText(dish.dishTypeName)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{dishCellText(dish.courseTypeName)}</td>
                      <td className="px-3 py-2"><CurationList items={dish.mainIngredients} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.additionalIngredients} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.choiceIngredients} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.diets} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.allergens} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2">
            <p className="text-[11px] text-slate-400">Page {page + 1} of {totalPages} · {visibleDishes.length} dishes</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
    {experimentToast ? (
      <div className="fixed right-4 top-16 z-[350] rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 shadow-md">
        {experimentToast}
      </div>
    ) : null}
    </>
  );
}

export default LargeBrandDishPage;
