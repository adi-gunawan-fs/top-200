import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import datasetRaw from "../../dataset/user-review-dataset-big-2026-04-27.jsonl?raw";
import { fetchMenuCuratorLocationMenus, fetchMenuDishExport } from "../lib/api";
import { escapeCsvValue } from "../lib/csvHelpers";

const PAGE_SIZE = 50;

const COLUMNS = [
  { key: "id", label: "ID" },
  { key: "brandName", label: "Brand" },
  { key: "restaurantType", label: "Restaurant Type" },
  { key: "cuisine", label: "Cuisine" },
  { key: "totalReviewCount", label: "Reviews" },
  { key: "totalReviewCountCategory", label: "Reviews Cat." },
  { key: "overallRating", label: "Rating" },
  { key: "overallRatingCategory", label: "Rating Cat." },
  { key: "brandSize", label: "Brand Size" },
  { key: "brandLocationCount", label: "Locations" },
  { key: "isMessy", label: "Messy" },
  { key: "autoeatLocationId", label: "Autoeat Loc ID" },
  { key: "menuCuratorLocationId", label: "Menu Curator Loc ID" },
];

const EXPORT_COLUMNS = [
  "dish_id",
  "brand_name",
  "dish_name",
  "addon_desc",
  "misc_descriptors",
  "allergen_descriptors",
  "diet_descriptors",
  "grandparent_menu_title",
  "grandparent_menu_desc",
  "grandparent_menu_addon_desc",
  "grandparent_menu_diet_desc",
  "parent_menu_title",
  "parent_menu_desc",
  "parent_menu_addon_desc",
  "parent_menu_diet_desc",
  "menu_title",
  "menu_desc",
  "menu_addon_desc",
  "menu_diet_desc",
  "dish_desc",
  "ingredients_text",
  "current_diet",
  "suggested_diet",
  "curated_diet",
  "diet_certainty",
];

function toJsonCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function menuTitleLevel(chain, fromEnd) {
  // chain is ordered root-first (grandparent → parent → child).
  // fromEnd: 0 = leaf (child), 1 = parent, 2 = grandparent.
  if (!Array.isArray(chain) || chain.length === 0) return null;
  const idx = chain.length - 1 - fromEnd;
  return idx >= 0 ? chain[idx] : null;
}

function dishToCsvRow(dish, meta) {
  const chain = dish.menuTitle ?? [];
  const child = menuTitleLevel(chain, 0);
  const parent = menuTitleLevel(chain, 1);
  const grandParent = menuTitleLevel(chain, 2);

  return {
    dish_id: dish.menuCurationTaskId
      ? `=HYPERLINK("https://menu-curator.foodstyles.com/menu-curation-tasks/${dish.menuCurationTaskId}?dishIds%5B0%5D=${dish.dishId}&shouldScrollToDish=true","${dish.dishId}")`
      : dish.dishId,
    brand_name: meta.brandName ?? "",
    dish_name: dish.name ?? "",
    addon_desc: toJsonCell(dish.addonDescriptors),
    misc_descriptors: toJsonCell(dish.miscDescriptors),
    allergen_descriptors: toJsonCell(dish.allergenDescriptors),
    diet_descriptors: toJsonCell(dish.dietDescriptors),
    grandparent_menu_title: grandParent?.title ?? "",
    grandparent_menu_desc: grandParent?.description ?? "",
    grandparent_menu_addon_desc: toJsonCell(grandParent?.addonDescriptors),
    grandparent_menu_diet_desc: toJsonCell(grandParent?.dietDescriptors),
    parent_menu_title: parent?.title ?? "",
    parent_menu_desc: parent?.description ?? "",
    parent_menu_addon_desc: toJsonCell(parent?.addonDescriptors),
    parent_menu_diet_desc: toJsonCell(parent?.dietDescriptors),
    menu_title: child?.title ?? "",
    menu_desc: child?.description ?? "",
    menu_addon_desc: toJsonCell(child?.addonDescriptors),
    menu_diet_desc: toJsonCell(child?.dietDescriptors),
    dish_desc: dish.description ?? "",
    ingredients_text: toJsonCell(dish.ingredients),
    current_diet: dish.currentDiets ?? dish.diets ?? "",
    suggested_diet: dish.suggestedDiets ?? "",
    curated_diet: dish.curatedDiets ?? "",
    diet_certainty: dish.dietsCertainty ?? "",
  };
}

function buildCsv(rows) {
  return [
    EXPORT_COLUMNS.map((c) => escapeCsvValue(c)).join(","),
    ...rows.map((row) => EXPORT_COLUMNS.map((c) => escapeCsvValue(row[c])).join(",")),
  ].join("\n");
}

function downloadCsv(csvContent, filename) {
  const blob = new Blob([csvContent], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function safeFilenameSegment(value, fallback) {
  const s = String(value ?? "").trim().replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "");
  return s || fallback;
}

function parseDataset(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      const m = obj.metadata ?? {};
      rows.push({
        id: obj.id,
        input: obj.input ?? "",
        brandName: m.brandName ?? "",
        restaurantType: m.restaurantType ?? "",
        cuisine: m.cuisine ?? "",
        totalReviewCount: m.totalReviewCount ?? "",
        totalReviewCountCategory: m.totalReviewCountCategory ?? "",
        overallRating: m.overallRating ?? "",
        overallRatingCategory: m.overallRatingCategory ?? "",
        brandSize: m.brandSize ?? "",
        brandLocationCount: m.brandLocationCount ?? "",
        isMessy: m.isMessy === true ? "true" : m.isMessy === false ? "false" : "",
        autoeatLocationId: m.autoeatLocationId ?? "",
        menuCuratorLocationId: m.menuCuratorLocationId ?? "",
      });
    } catch {
      // skip malformed line
    }
  }
  return rows;
}

function UserReviewDatasetPage() {
  const [allRows, setAllRows] = useState(null);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [exportingBulk, setExportingBulk] = useState(false);
  const [exportingRowId, setExportingRowId] = useState(null);
  const [exportStatus, setExportStatus] = useState("");
  const [exportError, setExportError] = useState("");

  useEffect(() => {
    const id = setTimeout(() => {
      setAllRows(parseDataset(datasetRaw));
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const filteredRows = useMemo(() => {
    if (!allRows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) =>
      [r.brandName, r.cuisine, r.restaurantType, String(r.id)]
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [allRows, search]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filteredRows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const pageRowKeys = useMemo(() => pageRows.map((r) => String(r.id)), [pageRows]);
  const allPageSelected = pageRowKeys.length > 0 && pageRowKeys.every((k) => selectedIds.has(k));

  const onSubmitSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  function toggleRow(rowId) {
    const key = String(rowId);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function togglePageSelection() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allPageSelected) pageRowKeys.forEach((k) => next.delete(k));
      else pageRowKeys.forEach((k) => next.add(k));
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  async function resolveLocationsToMenus(rows) {
    const withLocation = rows.filter((r) =>
      r.menuCuratorLocationId !== "" && r.menuCuratorLocationId !== null && r.menuCuratorLocationId !== undefined
    );
    if (withLocation.length === 0) return { menus: [], skippedNoLocation: rows.length, skippedNoMenu: 0 };

    const locationIds = withLocation.map((r) => r.menuCuratorLocationId);
    const resolved = await fetchMenuCuratorLocationMenus(locationIds);
    const byLocation = new Map(resolved.map((r) => [String(r.locationId), r]));

    const menus = [];
    let skippedNoMenu = 0;
    for (const r of withLocation) {
      const lookup = byLocation.get(String(r.menuCuratorLocationId));
      if (lookup?.menuId) {
        menus.push({
          menuId: lookup.menuId,
          brandName: lookup.brandName ?? r.brandName,
          locationId: r.menuCuratorLocationId,
          sourceRowId: r.id,
        });
      } else {
        skippedNoMenu += 1;
      }
    }
    return { menus, skippedNoLocation: rows.length - withLocation.length, skippedNoMenu };
  }

  async function handleRowExport(row) {
    setExportingRowId(String(row.id));
    setExportError("");
    setExportStatus(`Resolving location ${row.menuCuratorLocationId}…`);
    try {
      const { menus, skippedNoLocation, skippedNoMenu } = await resolveLocationsToMenus([row]);
      if (menus.length === 0) {
        setExportError(
          skippedNoLocation > 0
            ? "Row has no menu curator location ID."
            : "No menu found for this location."
        );
        setExportStatus("");
        return;
      }
      const menu = menus[0];
      setExportStatus(`Fetching dishes for menu ${menu.menuId}…`);
      const data = await fetchMenuDishExport(menu.menuId);
      const meta = {
        brandName: data.brandName ?? menu.brandName ?? "",
        isTop200: data.isTop200 ?? false,
        cuisineType: data.cuisineType ?? "",
        locationType: data.locationType ?? "",
      };
      const csvRows = (data.dishes ?? []).map((d) => dishToCsvRow(d, meta));
      const brandSegment = safeFilenameSegment(menu.brandName, "menu");
      const filename = `menu_${menu.menuId}_${brandSegment}_loc_${row.menuCuratorLocationId}_dishes.csv`;
      downloadCsv(buildCsv(csvRows), filename);
      const skipNote = skippedNoMenu > 0 ? " (no menu)" : "";
      setExportStatus(`Downloaded ${filename} · ${csvRows.length} dishes${skipNote}.`);
    } catch (err) {
      setExportError(err.message || "Failed to export menu.");
      setExportStatus("");
    } finally {
      setExportingRowId(null);
    }
  }

  async function handleBulkExport() {
    const selected = filteredRows.filter((r) => selectedIds.has(String(r.id)));
    if (selected.length === 0) return;
    setExportingBulk(true);
    setExportError("");
    setExportStatus(`Resolving ${selected.length} location(s)…`);
    try {
      const { menus, skippedNoLocation, skippedNoMenu } = await resolveLocationsToMenus(selected);
      if (menus.length === 0) {
        setExportError("No menus found for the selected rows.");
        setExportStatus("");
        return;
      }

      const allCsvRows = [];
      for (let i = 0; i < menus.length; i++) {
        const menu = menus[i];
        setExportStatus(`Fetching ${menu.brandName || menu.menuId} (${i + 1}/${menus.length}) · ${allCsvRows.length} dishes`);
        try {
          const data = await fetchMenuDishExport(menu.menuId);
          const meta = {
            brandName: data.brandName ?? menu.brandName ?? "",
            isTop200: data.isTop200 ?? false,
            cuisineType: data.cuisineType ?? "",
            locationType: data.locationType ?? "",
          };
          for (const dish of data.dishes ?? []) {
            allCsvRows.push(dishToCsvRow(dish, meta));
          }
        } catch (err) {
          console.error(`Failed menu ${menu.menuId}:`, err);
        }
      }

      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `user_review_menus_export_${stamp}.csv`;
      downloadCsv(buildCsv(allCsvRows), filename);
      const skipParts = [];
      if (skippedNoLocation > 0) skipParts.push(`${skippedNoLocation} without location`);
      if (skippedNoMenu > 0) skipParts.push(`${skippedNoMenu} without menu`);
      const skipNote = skipParts.length > 0 ? ` · skipped ${skipParts.join(", ")}` : "";
      setExportStatus(`Downloaded ${filename} · ${allCsvRows.length} dishes from ${menus.length} menus${skipNote}.`);
    } catch (err) {
      setExportError(err.message || "Failed to export menus.");
      setExportStatus("");
    } finally {
      setExportingBulk(false);
    }
  }

  if (allRows === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading dataset…
      </div>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">User Review Dataset</h2>
          <p className="text-[11px] text-slate-500">
            {total.toLocaleString()} {total === 1 ? "row" : "rows"}
            {search ? ` (filtered from ${allRows.length.toLocaleString()})` : ""}
          </p>
        </div>
        <form onSubmit={onSubmitSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search brand, cuisine, type, id…"
              className="w-72 rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs text-slate-700 outline-none focus:border-blue-400"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setPage(0);
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600">{selectedCount} selected</span>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear selection
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {exportStatus && <span className="text-[11px] text-slate-500">{exportStatus}</span>}
          {exportError && <span className="text-[11px] text-red-600">{exportError}</span>}
          <button
            type="button"
            onClick={handleBulkExport}
            disabled={selectedCount === 0 || exportingBulk || exportingRowId !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {exportingBulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export Menus ({selectedCount})
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={togglePageSelection}
                  aria-label="Select page"
                />
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-medium">
                  {c.label}
                </th>
              ))}
              <th className="border-b border-slate-200 px-3 py-2 font-medium">Export</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, idx) => {
              const key = String(row.id);
              const isSelected = selectedIds.has(key);
              const isRowExporting = exportingRowId === key;
              const hasLocation = row.menuCuratorLocationId !== "" && row.menuCuratorLocationId !== null && row.menuCuratorLocationId !== undefined;
              return (
                <tr key={`${row.id}-${idx}`} className={`border-b border-slate-100 hover:bg-slate-50 ${isSelected ? "bg-blue-50/40" : ""}`}>
                  <td className="px-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(row.id)}
                      aria-label={`Select row ${row.id}`}
                    />
                  </td>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                      {row[c.key] === "" || row[c.key] === null || row[c.key] === undefined ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        String(row[c.key])
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-1.5">
                    <button
                      type="button"
                      onClick={() => handleRowExport(row)}
                      disabled={!hasLocation || isRowExporting || exportingBulk || exportingRowId !== null}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      title={hasLocation ? "Export menu dishes CSV for this row" : "No menu curator location ID"}
                    >
                      {isRowExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                      Export
                    </button>
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-3 py-6 text-center text-xs text-slate-400">
                  No rows match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>
          Page {currentPage + 1} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 disabled:opacity-40 hover:bg-slate-50"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserReviewDatasetPage;
