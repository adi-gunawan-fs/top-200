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

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const CUISINE_GROUPS = [
  { key: "curry_house", label: "Curry Houses", target: 131, types: ["curry house"] },
  { key: "pub", label: "Pubs", target: 107, types: ["pub", "gastro pub", "country pub", "brewpub"] },
  { key: "fast_food", label: "Fast Food", target: 76, types: ["fast food"] },
  { key: "pizzeria", label: "Pizzerias", target: 67, types: ["pizzeria"] },
  { key: "chip_shop", label: "Chip Shops", target: 67, types: ["chip shop"] },
  { key: "kebab_shop", label: "Kebab Shops", target: 67, types: ["kebab shop"] },
  { key: "restaurant", label: "General Restaurants", target: 64, types: ["restaurant"] },
  { key: "cafe", label: "Cafes", target: 54, types: ["cafe", "coffee shop"] },
];

const BRAND_SIZE_TARGETS = { individual: 915, small: 62, large: 23 };
const MESSY_TARGET = 50;
const TOTAL_TARGET = 1000;
const OTHER_KEY = "_other";

function cuisineKeyFor(restaurantType) {
  const t = String(restaurantType ?? "").trim().toLowerCase();
  for (const g of CUISINE_GROUPS) {
    if (g.types.includes(t)) return g.key;
  }
  return OTHER_KEY;
}

// Best-effort stratified sample.
//  - Exactly 50 messy rows, exactly 950 non-messy (subject to availability).
//  - brandSize proportions: individual 915, small 62, large 23 — best effort.
//  - Cuisine targets per CUISINE_GROUPS — best effort, "_other" gets the remainder.
// Rows without menuCuratorLocationId are excluded from sampling.
function sampleRows(allRows) {
  const eligible = allRows.filter(
    (r) => r.menuCuratorLocationId !== "" && r.menuCuratorLocationId !== null && r.menuCuratorLocationId !== undefined
  );

  const messyPool = shuffleInPlace(eligible.filter((r) => r.isMessy === "true"));
  const cleanPool = shuffleInPlace(eligible.filter((r) => r.isMessy !== "true"));

  const messyCount = Math.min(MESSY_TARGET, messyPool.length);
  const cleanCount = Math.min(TOTAL_TARGET - messyCount, cleanPool.length);

  // Split each pool's rows into buckets keyed by `${brandSize}|${cuisineKey}`.
  const bucketize = (pool) => {
    const map = new Map();
    for (const r of pool) {
      const size = r.brandSize || "individual";
      const ck = cuisineKeyFor(r.restaurantType);
      const key = `${size}|${ck}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return map;
  };

  // Pull `n` rows from `pool` while trying to respect per-brandSize and per-cuisine quotas.
  // Two-pass: first fill cuisine quotas proportionally; then top up brand-size shortfalls
  // and finally fill remaining slots randomly.
  const drawSubsample = (pool, n) => {
    if (n <= 0 || pool.length === 0) return [];
    const scale = n / TOTAL_TARGET;
    const cuisineQuotas = new Map();
    for (const g of CUISINE_GROUPS) {
      cuisineQuotas.set(g.key, Math.round(g.target * scale));
    }
    const fixedCuisineTotal = [...cuisineQuotas.values()].reduce((s, v) => s + v, 0);
    cuisineQuotas.set(OTHER_KEY, Math.max(0, n - fixedCuisineTotal));

    const sizeQuotas = new Map();
    for (const [size, t] of Object.entries(BRAND_SIZE_TARGETS)) {
      sizeQuotas.set(size, Math.round(t * scale));
    }
    // Adjust so size totals = n.
    const sumSize = [...sizeQuotas.values()].reduce((s, v) => s + v, 0);
    if (sumSize !== n) {
      sizeQuotas.set("individual", (sizeQuotas.get("individual") ?? 0) + (n - sumSize));
    }

    const buckets = bucketize(pool);
    const picked = [];
    const pickedIds = new Set();

    const tryPickFromBucket = (bucketKey) => {
      const arr = buckets.get(bucketKey);
      if (!arr) return null;
      while (arr.length > 0) {
        const r = arr.pop();
        if (!pickedIds.has(r.id)) {
          pickedIds.add(r.id);
          return r;
        }
      }
      return null;
    };

    // Pass 1: for each cuisine quota, draw rows preferring brand-size buckets that still need filling.
    for (const [cKey, cQuota] of cuisineQuotas.entries()) {
      let remaining = cQuota;
      // Try sizes in proportional order: individual, small, large.
      const sizeOrder = shuffleInPlace(["individual", "small", "large"]);
      while (remaining > 0) {
        let drew = false;
        for (const size of sizeOrder) {
          if (remaining <= 0) break;
          if ((sizeQuotas.get(size) ?? 0) <= 0) continue;
          const r = tryPickFromBucket(`${size}|${cKey}`);
          if (r) {
            picked.push(r);
            sizeQuotas.set(size, sizeQuotas.get(size) - 1);
            remaining -= 1;
            drew = true;
          }
        }
        if (!drew) break;
      }
      cuisineQuotas.set(cKey, remaining);
    }

    // Pass 2: top up remaining slots from anywhere in pool, preferring under-filled size quotas.
    if (picked.length < n) {
      const leftover = pool.filter((r) => !pickedIds.has(r.id));
      shuffleInPlace(leftover);
      // Prefer ones whose brandSize still has quota.
      leftover.sort((a, b) => {
        const aq = sizeQuotas.get(a.brandSize) ?? 0;
        const bq = sizeQuotas.get(b.brandSize) ?? 0;
        return bq - aq;
      });
      for (const r of leftover) {
        if (picked.length >= n) break;
        picked.push(r);
        pickedIds.add(r.id);
        if ((sizeQuotas.get(r.brandSize) ?? 0) > 0) {
          sizeQuotas.set(r.brandSize, sizeQuotas.get(r.brandSize) - 1);
        }
      }
    }

    return picked;
  };

  const messySample = drawSubsample(messyPool, messyCount);
  const cleanSample = drawSubsample(cleanPool, cleanCount);
  const combined = [...messySample, ...cleanSample];

  // Build a small report breaking down what we actually got.
  const report = { total: combined.length, messy: messySample.length, clean: cleanSample.length, brandSize: {}, cuisine: {} };
  for (const r of combined) {
    report.brandSize[r.brandSize] = (report.brandSize[r.brandSize] || 0) + 1;
    const ck = cuisineKeyFor(r.restaurantType);
    report.cuisine[ck] = (report.cuisine[ck] || 0) + 1;
  }
  return { rows: combined, report };
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

  async function exportMenusForRows(rows, filenamePrefix, prelude = "", splits = 1) {
    setExportError("");
    setExportStatus(`${prelude}Resolving ${rows.length} location(s)…`);
    const { menus, skippedNoLocation, skippedNoMenu } = await resolveLocationsToMenus(rows);
    if (menus.length === 0) {
      setExportError("No menus found for the selected rows.");
      setExportStatus("");
      return;
    }

    // Bucket CSV rows per menu so we can split the final files by menu, not by dish.
    const perMenuCsvRows = [];
    let totalDishRows = 0;
    for (let i = 0; i < menus.length; i++) {
      const menu = menus[i];
      setExportStatus(`${prelude}Fetching ${menu.brandName || menu.menuId} (${i + 1}/${menus.length}) · ${totalDishRows} dishes`);
      try {
        const data = await fetchMenuDishExport(menu.menuId);
        const meta = {
          brandName: data.brandName ?? menu.brandName ?? "",
          isTop200: data.isTop200 ?? false,
          cuisineType: data.cuisineType ?? "",
          locationType: data.locationType ?? "",
        };
        const csvRowsForMenu = (data.dishes ?? []).map((d) => dishToCsvRow(d, meta));
        perMenuCsvRows.push(csvRowsForMenu);
        totalDishRows += csvRowsForMenu.length;
      } catch (err) {
        console.error(`Failed menu ${menu.menuId}:`, err);
        perMenuCsvRows.push([]);
      }
    }

    const stamp = new Date().toISOString().slice(0, 10);
    const skipParts = [];
    if (skippedNoLocation > 0) skipParts.push(`${skippedNoLocation} without location`);
    if (skippedNoMenu > 0) skipParts.push(`${skippedNoMenu} without menu`);
    const skipNote = skipParts.length > 0 ? ` · skipped ${skipParts.join(", ")}` : "";

    const splitCount = Math.max(1, Math.floor(splits));
    if (splitCount === 1) {
      const allCsvRows = perMenuCsvRows.flat();
      const filename = `${filenamePrefix}_${stamp}.csv`;
      downloadCsv(buildCsv(allCsvRows), filename);
      setExportStatus(`Downloaded ${filename} · ${allCsvRows.length} dishes from ${menus.length} menus${skipNote}.`);
      return;
    }

    // Even split by menu count, not dish count.
    const perSplit = Math.ceil(menus.length / splitCount);
    const filenames = [];
    for (let s = 0; s < splitCount; s++) {
      const start = s * perSplit;
      const end = Math.min(menus.length, start + perSplit);
      if (start >= end) break;
      const chunkMenus = menus.slice(start, end);
      const chunkRows = perMenuCsvRows.slice(start, end).flat();
      const filename = `${filenamePrefix}_part${s + 1}of${splitCount}_${stamp}.csv`;
      downloadCsv(buildCsv(chunkRows), filename);
      filenames.push(`${filename} (${chunkMenus.length} menus · ${chunkRows.length} dishes)`);
    }
    setExportStatus(`Downloaded ${filenames.length} files · total ${totalDishRows} dishes from ${menus.length} menus${skipNote}.`);
  }

  async function handleBulkExport() {
    const selected = filteredRows.filter((r) => selectedIds.has(String(r.id)));
    if (selected.length === 0) return;
    setExportingBulk(true);
    try {
      await exportMenusForRows(selected, "user_review_menus_export");
    } catch (err) {
      setExportError(err.message || "Failed to export menus.");
      setExportStatus("");
    } finally {
      setExportingBulk(false);
    }
  }

  async function handleStratifiedSampleExport() {
    if (!allRows) return;
    setExportingBulk(true);
    setExportError("");
    setExportStatus("Pre-resolving location → menu mapping…");
    try {
      // Pre-resolve every eligible location ID so we only sample rows that will produce a menu.
      const eligible = allRows.filter(
        (r) => r.menuCuratorLocationId !== "" && r.menuCuratorLocationId !== null && r.menuCuratorLocationId !== undefined
      );
      const allLocationIds = [...new Set(eligible.map((r) => r.menuCuratorLocationId))];
      const CHUNK = 2000;
      const resolvableIds = new Set();
      for (let i = 0; i < allLocationIds.length; i += CHUNK) {
        const chunk = allLocationIds.slice(i, i + CHUNK);
        setExportStatus(`Pre-resolving locations… (${Math.min(i + CHUNK, allLocationIds.length)}/${allLocationIds.length})`);
        const resolved = await fetchMenuCuratorLocationMenus(chunk);
        for (const r of resolved) {
          if (r?.menuId) resolvableIds.add(String(r.locationId));
        }
      }

      const resolvableRows = allRows.filter((r) => resolvableIds.has(String(r.menuCuratorLocationId)));
      setExportStatus(`Sampling 1,000 of ${resolvableRows.length.toLocaleString()} resolvable menus…`);

      const { rows, report } = sampleRows(resolvableRows);
      if (rows.length < TOTAL_TARGET) {
        setExportError(`Only ${rows.length} resolvable rows could be sampled (target ${TOTAL_TARGET}).`);
      }
      const cuisineSummary = Object.entries(report.cuisine)
        .map(([k, v]) => `${k}:${v}`)
        .join(" ");
      const sizeSummary = Object.entries(report.brandSize)
        .map(([k, v]) => `${k}:${v}`)
        .join(" ");
      const prelude = `Sample (${report.total}: messy ${report.messy}, sizes ${sizeSummary}, cuisines ${cuisineSummary}) · `;
      // Shuffle so the 4 split CSVs each get an even mix of messy/clean & cuisines.
      const shuffled = shuffleInPlace(rows.slice());
      await exportMenusForRows(shuffled, "user_review_sample_1000_export", prelude, 4);
    } catch (err) {
      setExportError(err.message || "Failed to export sample.");
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
            onClick={handleStratifiedSampleExport}
            disabled={exportingBulk || exportingRowId !== null}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100 disabled:opacity-40"
            title="Sample 1,000 menus by brand-size & cuisine quotas with 50 messy locations, then export"
          >
            {exportingBulk ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Sample 1,000 &amp; Export
          </button>
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
