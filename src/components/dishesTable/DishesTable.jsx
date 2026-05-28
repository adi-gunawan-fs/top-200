import { useEffect, useRef, useState } from "react";
import { rowStyles } from "../ui/StatusPill";
import { ChangeTypeCounts } from "../ui/ChangeTypeBadge";
import { fetchDishSnapshots, fetchDishCurationLinks } from "../../lib/api";
import { filterChangedFieldsByRelevancy, shouldHideChangedField, getVisibleChangeTypeCounts } from "../../utils/filterUtils";
import { INLINE_SNAPSHOT_COLUMNS, PAGE_SIZE, formatAddons } from "./constants";
import { ExpandableText, ExpandableJson } from "./Expandable";
import { ChangedFieldsCell, AnalysisCell, AnalysisStatusCell } from "./AnalysisCells";
import { SnapshotCells } from "./SnapshotCells";

// Threshold = sum of column widths between Name (420) and Type:
// dishId(180) + description(360) + menuTitle(360) + ingredients(360) + addons(320) + diet(240) + allergen(240) + relevancies(240) + changedFields(320) + status(160) + analysis(288) = 3068
const TYPE_STICKY_THRESHOLD = 3068;

export function DishesTable({
  filteredDishes,
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
  const tableScrollRef = useRef(null);
  const scrollClassStateRef = useRef({ raf: 0, scrolledX: false, typeStuck: false });
  const [snapshotsByDishId, setSnapshotsByDishId] = useState({});
  const [curationUrlByDishId, setCurationUrlByDishId] = useState({});
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);

  const updateScrollClasses = (scrollEl) => {
    if (!scrollEl) return;
    const nextScrolledX = scrollEl.scrollLeft > 0;
    const nextTypeStuck = scrollEl.scrollLeft >= TYPE_STICKY_THRESHOLD;
    const state = scrollClassStateRef.current;
    if (state.scrolledX !== nextScrolledX) {
      scrollEl.classList.toggle("is-scrolled-x", nextScrolledX);
      state.scrolledX = nextScrolledX;
    }
    if (state.typeStuck !== nextTypeStuck) {
      scrollEl.classList.toggle("is-type-stuck", nextTypeStuck);
      state.typeStuck = nextTypeStuck;
    }
  };

  const handleScroll = (e) => {
    const scrollEl = e.currentTarget;
    const state = scrollClassStateRef.current;
    if (state.raf) return;
    state.raf = window.requestAnimationFrame(() => {
      state.raf = 0;
      updateScrollClasses(scrollEl);
    });
  };

  useEffect(() => {
    updateScrollClasses(tableScrollRef.current);
    return () => {
      const raf = scrollClassStateRef.current.raf;
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => { setPage(0); }, [filteredDishes]);

  const totalPages = Math.max(1, Math.ceil(filteredDishes.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageEntries = filteredDishes.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const pageDishIdsKey = pageEntries.map((dish) => dish.id).join(",");
  useEffect(() => {
    if (afterRecord?.snapshots) {
      const map = {};
      pageEntries.forEach((dish) => {
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
      pageEntries.map((dish) =>
        fetchDishSnapshots(dish.id)
          .then((rows) => ({ id: dish.id, rows, error: null }))
          .catch((err) => ({ id: dish.id, rows: null, error: err.message }))
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

  useEffect(() => {
    let cancelled = false;
    const pairs = pageEntries
      .map((dish) => ({ dishId: dish?.id, menuAutoeatId: dish?.menuId }))
      .filter((pair) => pair.dishId !== null && pair.dishId !== undefined && pair.menuAutoeatId !== null && pair.menuAutoeatId !== undefined);

    if (pairs.length === 0) {
      setCurationUrlByDishId({});
      return () => { cancelled = true; };
    }

    fetchDishCurationLinks(pairs)
      .then((map) => { if (!cancelled) setCurationUrlByDishId(map); })
      .catch(() => { if (!cancelled) setCurationUrlByDishId({}); });

    return () => { cancelled = true; };
  }, [pageDishIdsKey]);

  return (
    <div>
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
          <div ref={tableScrollRef} onScroll={handleScroll} className="dishes-scroll-shell max-h-[80vh] overflow-auto overscroll-y-contain">
            <table className="table-fixed border-collapse" style={{ minWidth: "100%", width: "max-content" }}>
              <colgroup>
                <col style={{ width: "420px" }} />
                <col style={{ width: "180px" }} />
                <col style={{ width: "360px" }} />
                <col style={{ width: "360px" }} />
                <col style={{ width: "360px" }} />
                <col style={{ width: "320px" }} />
                <col style={{ width: "240px" }} />
                <col style={{ width: "240px" }} />
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
                    <span aria-hidden="true" className="name-sticky-shadow pointer-events-none absolute right-[-18px] w-[18px]" style={{ top: "-1px", bottom: "-1px" }} />
                  </th>
                  <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Dish ID</th>
                  <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Description</th>
                  <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Menu Title</th>
                  <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Ingredient Free Text</th>
                  <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Addson Descriptor</th>
                  <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Diet Descriptor</th>
                  <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">ALLERGEN DESCRIPTOR</th>
                  <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Relevancies</th>
                  <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Changed Fields</th>
                  <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Status</th>
                  <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Analysis</th>
                  {INLINE_SNAPSHOT_COLUMNS.map((col) => (
                    col.key === "type" ? (
                      <th
                        key={col.key}
                        className="type-sticky-cell sticky top-0 z-30 bg-slate-100 px-3 py-2 relative"
                        style={{ left: "420px" }}
                      >
                        {col.label}
                        <span aria-hidden="true" className="type-sticky-shadow pointer-events-none absolute right-[-18px] w-[18px]" style={{ top: "-1px", bottom: "-1px" }} />
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
                    <td colSpan={12 + INLINE_SNAPSHOT_COLUMNS.length} className="px-3 py-4 text-xs text-slate-500">No dish changes to display.</td>
                  </tr>
                ) : (
                  pageEntries.flatMap((dish) => {
                    const item = dish;
                    const visibleChangedFields = filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancySet)
                      .filter((field) => !shouldHideChangedField(item, field));
                    const visibleChangeTypeCounts = getVisibleChangeTypeCounts(visibleChangedFields);
                    const shortKey = `${item.id}__${item.type}`;
                    const isEligible = eligibleItemKeys?.has(shortKey);
                    const dishDescription = item.after?.description ?? item.before?.description ?? "";
                    const menuTitleName = item.menuTitleName ?? "";
                    const menuTitleDescription = item.menuTitleDescription ?? "";
                    const ingredientFreeText = item.after?.ingredients ?? item.before?.ingredients ?? "";
                    const addonDescriptor = formatAddons(item.after?.addons ?? item.before?.addons);
                    const dietData = item.after?.diets ?? item.before?.diets;
                    const allergenData = item.after?.allergens ?? item.before?.allergens;

                    const result = snapshotsByDishId[item.id];
                    const snapshots = result?.rows ?? null;
                    const error = result?.error ?? null;

                    const stickyBg = item.status === "new"
                      ? "bg-emerald-50"
                      : item.status === "updated"
                        ? "bg-amber-50"
                        : item.status === "deleted"
                          ? "bg-rose-50"
                          : "bg-white";

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
                      const trClass = isLast ? rowClass : `text-xs text-slate-700 ${rowStyles(item.status)}`;

                      return (
                        <tr key={`dish-${item.id}-${snapshot?.id ?? snapIdx}`} className={trClass}>
                          {isFirst && (
                            <>
                              <td rowSpan={rowSpan} className={`sticky left-0 z-10 px-3 py-2 font-medium text-slate-900 relative align-top ${stickyBg}`}>
                                <div className="flex items-start gap-1.5">
                                  <span className="break-words">{item.name || "-"}</span>
                                </div>
                                <span aria-hidden="true" className="name-sticky-shadow pointer-events-none absolute right-[-18px] w-[18px]" style={{ top: "-1px", bottom: "-1px" }} />
                              </td>
                              <td rowSpan={rowSpan} className="px-3 py-2 align-top">
                                {curationUrlByDishId[String(item.id)] ? (
                                  <a
                                    href={curationUrlByDishId[String(item.id)]}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-700 hover:text-blue-900 hover:underline break-all"
                                  >
                                    {item.id}
                                  </a>
                                ) : (
                                  <span className="text-slate-500">{item.id}</span>
                                )}
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
                                <ExpandableJson data={dietData} />
                              </td>
                              <td rowSpan={rowSpan} className="px-3 py-2 align-top">
                                <ExpandableJson data={allergenData} />
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
                          />
                        </tr>
                      );
                    });
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredDishes.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
              <span className="text-xs text-slate-500">
                {`${safePage * PAGE_SIZE + 1}–${Math.min((safePage + 1) * PAGE_SIZE, filteredDishes.length)} of ${filteredDishes.length} dishes`}
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
