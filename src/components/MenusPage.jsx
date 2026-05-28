import { useEffect, useState } from "react";
import { Loader2, Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { fetchMenus, fetchMenuFilterOptions, fetchMenuDishExport, fetchMenusRandomSample } from "../lib/api";
import { escapeCsvValue } from "../lib/csvHelpers";

const EXPORT_COLUMNS = [
  "brand_name",
  "is_top_200",
  "cuisine_type",
  "location_type",
  "dish_id",
  "menu_title",
  "name",
  "description",
  "ingredients_free_text",
  "diet_descriptors",
  "addon_descriptors",
  "misc_descriptors",
  "allergen_descriptors",
  "dish_type",
  "is_ignored_dish_type",
  "course_type",
  "is_ignored_course_type",
  "diets",
  "allergens",
  "main_ingredients",
  "choice_ingredients",
  "additional_ingredients",
  "tier",
  "dish_type_certainty",
  "course_type_certainty",
  "diets_certainty",
  "allergens_certainty",
  "ingredients_certainty",
];

function toJsonCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function dishToCsvRow(dish, meta) {
  return {
    brand_name: meta.brandName ?? "",
    is_top_200: meta.isTop200 ? "true" : "false",
    cuisine_type: meta.cuisineType ?? "",
    location_type: meta.locationType ?? "",
    dish_id: dish.menuCurationTaskId
      ? `=HYPERLINK("https://menu-curator.foodstyles.com/menu-curation-tasks/${dish.menuCurationTaskId}?dishIds%5B0%5D=${dish.dishId}&shouldScrollToDish=true","${dish.dishId}")`
      : dish.dishId,
    menu_title: JSON.stringify(dish.menuTitle ?? []),
    name: dish.name,
    description: dish.description,
    ingredients_free_text: toJsonCell(dish.ingredients),
    diet_descriptors: toJsonCell(dish.dietDescriptors),
    addon_descriptors: toJsonCell(dish.addonDescriptors),
    misc_descriptors: toJsonCell(dish.miscDescriptors),
    allergen_descriptors: toJsonCell(dish.allergenDescriptors),
    dish_type: dish.dishType,
    is_ignored_dish_type: dish.dishTypeIsIgnored ? "true" : "false",
    course_type: dish.courseType,
    is_ignored_course_type: dish.courseTypeIsIgnored ? "true" : "false",
    diets: dish.diets,
    allergens: dish.allergens,
    main_ingredients: dish.mainIngredients,
    choice_ingredients: dish.choiceIngredients,
    additional_ingredients: dish.additionalIngredients,
    tier: dish.tier ?? "",
    dish_type_certainty: dish.dishTypeCertainty ?? "",
    course_type_certainty: dish.courseTypeCertainty ?? "",
    diets_certainty: dish.dietsCertainty ?? "",
    allergens_certainty: dish.allergensCertainty ?? "",
    ingredients_certainty: dish.ingredientsCertainty ?? "",
  };
}

const PAGE_SIZE = 50;

function MenusPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [brandCount, setBrandCount] = useState(0);
  const [dishTotal, setDishTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [cuisineTypeId, setCuisineTypeId] = useState("");
  const [locationTypeId, setLocationTypeId] = useState("");
  const [top200, setTop200] = useState("");
  const [cuisineOptions, setCuisineOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exportingMenuId, setExportingMenuId] = useState(null);
  const [bulkExporting, setBulkExporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkLog, setBulkLog] = useState([]);

  const appendBulkLog = (msg) => {
    const stamp = new Date().toLocaleTimeString();
    setBulkLog((prev) => [...prev, `[${stamp}] ${msg}`]);
  };

  const handleExport = async (menuId, brandName) => {
    setExportingMenuId(menuId);
    try {
      const data = await fetchMenuDishExport(menuId);
      const meta = {
        brandName: data.brandName ?? brandName ?? "",
        isTop200: data.isTop200 ?? false,
        cuisineType: data.cuisineType ?? "",
        locationType: data.locationType ?? "",
      };
      const rows = (data.dishes ?? []).map((d) => dishToCsvRow(d, meta));
      const csvLines = [
        EXPORT_COLUMNS.map((c) => escapeCsvValue(c)).join(","),
        ...rows.map((row) => EXPORT_COLUMNS.map((c) => escapeCsvValue(row[c])).join(",")),
      ];
      const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const safeBrand = String(brandName ?? "menu").trim().replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "menu";
      a.href = url;
      a.download = `menu_${menuId}_${safeBrand}_dishes.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export failed:", err);
      alert(`Export failed: ${err.message}`);
    } finally {
      setExportingMenuId(null);
    }
  };

  const handleBulkExport = async () => {
    const MAX_MENUS = 500;
    const MAX_DISHES = 5000;
    const MAX_DISHES_PER_MENU = 20;
    setBulkExporting(true);
    setBulkProgress({ done: 0, total: 0 });
    setBulkLog([]);
    setBulkStatus("Starting…");
    try {
      const filters = {
        search,
        cuisineTypeId: cuisineTypeId ? Number(cuisineTypeId) : null,
        locationTypeId: locationTypeId ? Number(locationTypeId) : null,
        isTop200: top200 === "" ? null : top200 === "true",
      };

      setBulkStatus("Sampling menus…");
      appendBulkLog(`Filters: ${JSON.stringify(filters)}`);
      appendBulkLog(`Caps: max ${MAX_MENUS} menus (1 random menu per brand), max ${MAX_DISHES} dishes`);
      const sampleData = await fetchMenusRandomSample({ ...filters, limit: MAX_MENUS });
      const sampledMenus = sampleData.rows ?? [];
      if (sampledMenus.length === 0) {
        setBulkStatus("No menus match the current filters.");
        appendBulkLog("No menus to export.");
        return;
      }
      appendBulkLog(`Server returned ${sampledMenus.length} random menus (one per brand)`);

      setBulkProgress({ done: 0, total: sampledMenus.length });
      setBulkStatus(`Exporting up to ${sampledMenus.length} menus (cap ${MAX_DISHES} dishes)…`);

      // Sequential to enforce the dish cap deterministically.
      const allCsvRows = [];
      let dishCapHit = false;
      let menusProcessed = 0;
      for (let i = 0; i < sampledMenus.length; i++) {
        if (dishCapHit) break;
        const menu = sampledMenus[i];
        try {
          const data = await fetchMenuDishExport(menu.menuId);
          const meta = {
            brandName: data.brandName ?? menu.brandName ?? "",
            isTop200: data.isTop200 ?? menu.isTop200 ?? false,
            cuisineType: data.cuisineType ?? menu.cuisineType ?? "",
            locationType: data.locationType ?? menu.locationType ?? "",
          };
          const dishes = data.dishes ?? [];
          // Per-menu cap: sample up to MAX_DISHES_PER_MENU random dishes from this menu.
          let perMenuDishes = dishes;
          if (dishes.length > MAX_DISHES_PER_MENU) {
            const shuf = dishes.slice();
            for (let k = shuf.length - 1; k > 0; k--) {
              const j = Math.floor(Math.random() * (k + 1));
              [shuf[k], shuf[j]] = [shuf[j], shuf[k]];
            }
            perMenuDishes = shuf.slice(0, MAX_DISHES_PER_MENU);
          }
          const remaining = MAX_DISHES - allCsvRows.length;
          const toAdd = perMenuDishes.slice(0, remaining);
          for (const dish of toAdd) {
            allCsvRows.push(dishToCsvRow(dish, meta));
          }
          if (toAdd.length < perMenuDishes.length) {
            appendBulkLog(`Menu ${menu.menuId}: included ${toAdd.length}/${perMenuDishes.length} dishes (cap ${MAX_DISHES} reached).`);
            dishCapHit = true;
          } else if (dishes.length === 0) {
            appendBulkLog(`Menu ${menu.menuId} (${menu.brandName}): 0 dishes available.`);
          }
        } catch (err) {
          appendBulkLog(`✗ menu ${menu.menuId} (${menu.brandName}): ${err.message}`);
        } finally {
          menusProcessed = i + 1;
          setBulkProgress({ done: menusProcessed, total: sampledMenus.length });
        }
      }

      setBulkStatus(`Building CSV (${allCsvRows.length} dish rows)…`);
      appendBulkLog(`Done fetching. Total dish rows: ${allCsvRows.length}`);
      console.log(`[bulk export] done. total dish rows: ${allCsvRows.length}`);

      const csvLines = [
        EXPORT_COLUMNS.map((c) => escapeCsvValue(c)).join(","),
        ...allCsvRows.map((row) => EXPORT_COLUMNS.map((c) => escapeCsvValue(row[c])).join(",")),
      ];
      const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `menus_bulk_export_${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setBulkProgress({ done: menusProcessed, total: menusProcessed });
      setBulkStatus(`Done. Downloaded ${allCsvRows.length} dish rows from ${menusProcessed} menus.`);
      appendBulkLog("CSV downloaded.");
    } catch (err) {
      setBulkStatus(`Failed: ${err.message}`);
      appendBulkLog(`FATAL: ${err.message}`);
      console.error("Bulk export failed:", err);
    } finally {
      setBulkExporting(false);
    }
  };

  useEffect(() => {
    fetchMenuFilterOptions()
      .then((data) => {
        setCuisineOptions(data.cuisineTypes ?? []);
        setLocationOptions(data.locationTypes ?? []);
      })
      .catch((err) => console.error("Failed to fetch filter options:", err));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchMenus({
      page,
      pageSize: PAGE_SIZE,
      search,
      cuisineTypeId: cuisineTypeId ? Number(cuisineTypeId) : null,
      locationTypeId: locationTypeId ? Number(locationTypeId) : null,
      isTop200: top200 === "" ? null : top200 === "true",
    })
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
        setBrandCount(data.brandCount ?? 0);
        setDishTotal(data.dishTotal ?? 0);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to fetch menus:", err);
        setError(err.message || "Failed to load menus.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, cuisineTypeId, locationTypeId, top200]);

  useEffect(() => {
    setPage(0);
  }, [search, cuisineTypeId, locationTypeId, top200]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIdx = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const endIdx = Math.min(total, (page + 1) * PAGE_SIZE);

  const handleSubmitSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const selectClass =
    "rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Menus</h1>
          <p className="text-xs text-slate-500">
            Read-only list of INCLUDED menus.
            <span className="ml-2 text-slate-400">·</span>
            <span className="ml-2 tabular-nums">
              <span className="font-medium text-slate-700">{total.toLocaleString()}</span> menus
            </span>
            <span className="ml-2 text-slate-400">·</span>
            <span className="ml-2 tabular-nums">
              <span className="font-medium text-slate-700">{brandCount.toLocaleString()}</span> brands
            </span>
            <span className="ml-2 text-slate-400">·</span>
            <span className="ml-2 tabular-nums">
              <span className="font-medium text-slate-700">{dishTotal.toLocaleString()}</span> dishes
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={cuisineTypeId}
            onChange={(e) => setCuisineTypeId(e.target.value)}
            className={selectClass}
          >
            <option value="">All cuisines</option>
            {cuisineOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
          <select
            value={locationTypeId}
            onChange={(e) => setLocationTypeId(e.target.value)}
            className={selectClass}
          >
            <option value="">All locations</option>
            {locationOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
          <select
            value={top200}
            onChange={(e) => setTop200(e.target.value)}
            className={selectClass}
          >
            <option value="">All brands</option>
            <option value="true">Top 200 only</option>
            <option value="false">Not Top 200</option>
          </select>
          <button
            type="button"
            onClick={handleBulkExport}
            disabled={bulkExporting}
            className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs text-blue-700 enabled:hover:bg-blue-100 disabled:opacity-50"
          >
            {bulkExporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {bulkProgress.total > 0
                  ? `Exporting ${bulkProgress.done}/${bulkProgress.total}…`
                  : "Preparing…"}
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Bulk export
              </>
            )}
          </button>
          <form onSubmit={handleSubmitSearch} className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search brand..."
              className="w-56 rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
            />
          </form>
        </div>
      </div>

      {(bulkExporting || bulkStatus || bulkLog.length > 0) && (
        <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-medium text-blue-800">
              {bulkExporting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{bulkStatus || "Bulk export"}</span>
              {bulkProgress.total > 0 && (
                <span className="font-normal text-blue-600">
                  ({bulkProgress.done}/{bulkProgress.total} menus)
                </span>
              )}
            </div>
            {!bulkExporting && (
              <button
                type="button"
                onClick={() => { setBulkStatus(""); setBulkLog([]); setBulkProgress({ done: 0, total: 0 }); }}
                className="text-blue-600 hover:text-blue-800"
              >
                clear
              </button>
            )}
          </div>
          {bulkProgress.total > 0 && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%` }}
              />
            </div>
          )}
          {bulkLog.length > 0 && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-white/70 p-2 font-mono text-[10px] leading-tight text-slate-700">
              {bulkLog.slice(-100).join("\n")}
            </pre>
          )}
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Menu ID</th>
              <th className="px-3 py-2.5">Brand</th>
              <th className="px-3 py-2.5">Cuisine Type</th>
              <th className="px-3 py-2.5">Location Type</th>
              <th className="px-3 py-2.5">Dish Count</th>
              <th className="px-3 py-2.5">Top 200</th>
              <th className="px-3 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-rose-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                  No menus found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.menuId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{row.menuId}</td>
                  <td className="px-3 py-2">{row.brandName}</td>
                  <td className="px-3 py-2">{row.cuisineType ?? "—"}</td>
                  <td className="px-3 py-2">{row.locationType ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{row.dishCount ?? 0}</td>
                  <td className="px-3 py-2">
                    {row.isTop200 ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => handleExport(row.menuId, row.brandName)}
                      disabled={exportingMenuId === row.menuId}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-40"
                    >
                      {exportingMenuId === row.menuId ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3" />
                      )}
                      Export
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div>
          {total === 0 ? "0 results" : `${startIdx}–${endIdx} of ${total}`}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>
          <span className="tabular-nums">
            Page {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1 || loading}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MenusPage;
