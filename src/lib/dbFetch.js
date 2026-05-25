import { saveUpload } from "./csvUploads";

const API_BASE = "http://localhost:3000";

export async function fetchBrands() {
  const res = await fetch(`${API_BASE}/api/brands`);
  if (!res.ok) throw new Error(`Failed to fetch brands: ${res.statusText}`);
  return res.json();
}

// Fetches all overview rows (all top-200 INCLUDED menus with latest message date).
// Paginates internally and returns the full flat array.
export async function fetchOverview() {
  const res = await fetch(`${API_BASE}/api/overview`);
  if (!res.ok) throw new Error(`Failed to fetch overview: ${res.statusText}`);
  const { rows } = await res.json();
  return rows;
}

// Fetches all messages for a single menu (newest first), returns them as parsed rows.
export async function fetchMenuMessages(menuId) {
  const res = await fetch(`${API_BASE}/api/menu-messages?menuId=${menuId}`);
  if (!res.ok) throw new Error(`Failed to fetch menu messages: ${res.statusText}`);
  const { rows } = await res.json();
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    createdAtMs: row.createdAt ? Date.parse(row.createdAt) : 0,
    updatedAt: row.updatedAt,
    updatedAtMs: row.updatedAt ? Date.parse(row.updatedAt) : 0,
    message: typeof row.message === "string" ? JSON.parse(row.message) : row.message,
  }));
}

// Fetches all pages of 2-latest-per-menu messages for a brand or single menu.
// Pass { brandId } for all menus of a brand, or { menuId } for a single menu (menus.id).
// Calls onRow for each row as pages arrive so the grouper processes incrementally.
export async function streamMessages({ brandId, menuId } = {}, { onRow, onProgress } = {}) {
  let cursor = 0;
  let totalRows = 0;

  while (true) {
    const params = new URLSearchParams({ cursor, pageSize: 500 });
    if (menuId) params.set("menuId", menuId);
    else params.set("brandId", brandId);
    const res = await fetch(`${API_BASE}/api/messages?${params}`);
    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.statusText}`);

    const { rows, nextCursor } = await res.json();

    for (const row of rows) {
      const message = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
      onRow?.({
        id: row.id,
        createdAt: row.createdAt,
        createdAtMs: row.createdAt ? Date.parse(row.createdAt) : 0,
        updatedAt: row.updatedAt,
        updatedAtMs: row.updatedAt ? Date.parse(row.updatedAt) : 0,
        message,
      });
    }

    totalRows += rows.length;
    onProgress?.({ totalRows, done: !nextCursor });

    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return { totalRows };
}

// Fetches dishSnapshots for a given dishId.
// If afterDate is provided, only returns snapshots created after that date.
export async function fetchDishSnapshots(dishId, afterDate) {
  const params = new URLSearchParams({ dishId });
  if (afterDate) params.set("afterDate", afterDate);
  const res = await fetch(`${API_BASE}/api/dish-snapshots?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch dish snapshots: ${res.statusText}`);
  const { rows } = await res.json();
  return rows;
}

export async function fetchDishCurationLinks(dishMenuPairs) {
  const cleanedPairs = (dishMenuPairs ?? [])
    .filter((pair) => pair && pair.dishId !== null && pair.dishId !== undefined && pair.menuAutoeatId !== null && pair.menuAutoeatId !== undefined)
    .map((pair) => ({ dishId: String(pair.dishId), menuAutoeatId: String(pair.menuAutoeatId) }));

  if (cleanedPairs.length === 0) return {};

  const res = await fetch(`${API_BASE}/api/dish-curation-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairs: cleanedPairs }),
  });
  if (!res.ok) throw new Error(`Failed to fetch dish curation links: ${res.statusText}`);
  const { rows } = await res.json();

  const map = {};
  (rows ?? []).forEach((row) => {
    const key = String(row?.dishId ?? "");
    if (!key) return;
    map[key] = row?.url ?? null;
  });
  return map;
}

export async function fetchPublishedDishIds(dishIds) {
  const cleanedDishIds = (dishIds ?? [])
    .filter((id) => id !== null && id !== undefined)
    .map((id) => String(id));

  if (cleanedDishIds.length === 0) return new Set();

  const res = await fetch(`${API_BASE}/api/published-dishes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dishIds: cleanedDishIds }),
  });
  if (!res.ok) throw new Error(`Failed to fetch published dishes: ${res.statusText}`);
  const { dishIds: publishedDishIds } = await res.json();
  return new Set((publishedDishIds ?? []).map((id) => String(id)));
}

async function fetchMenuCurationTaskAiCuratorExportRows(taskId, limitPerTask) {
  const params = new URLSearchParams({ taskId: String(taskId) });
  if (Number.isFinite(limitPerTask) && limitPerTask > 0) {
    params.set("limit", String(limitPerTask));
  }
  const res = await fetch(`${API_BASE}/api/menu-curation-task-ai-curator-export?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch task export rows: ${res.statusText}`);
  const { rows } = await res.json();
  return rows ?? [];
}

async function fetchMenuCurationTaskTierOneExportRows(taskId, limitPerTask) {
  const params = new URLSearchParams({ taskId: String(taskId) });
  if (Number.isFinite(limitPerTask) && limitPerTask > 0) {
    params.set("limit", String(limitPerTask));
  }
  const res = await fetch(`${API_BASE}/api/menu-curation-task-tier-one-export?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch tier 1 task export rows: ${res.statusText}`);
  const { rows } = await res.json();
  return rows ?? [];
}

function stringifyCell(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((entry) => stringifyCell(entry)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return stringifyCell(value.text ?? value.innerText ?? value.name ?? JSON.stringify(value));
  }
  return String(value);
}

function descriptorObjectToPlain(value, { omitImageSrc = false } = {}) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => descriptorObjectToPlain(item, { omitImageSrc }))
      .filter(Boolean)
      .join("\n");
  }
  if (typeof value === "object") {
    return Object.entries(value)
      .filter(([key]) => !(omitImageSrc && key === "imageSrc"))
      .map(([, entryValue]) => descriptorObjectToPlain(entryValue, { omitImageSrc }))
      .filter(Boolean)
      .join("\n");
  }
  return String(value);
}

function stringifyJsonCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function escapeCsvValue(value) {
  const text = stringifyCell(value);
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function escapeCsvDescriptorValue(value, { omitImageSrc = false } = {}) {
  const text = descriptorObjectToPlain(value, { omitImageSrc });
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

function buildAiCuratorMenuTitleCell(menuTitle) {
  if (!Array.isArray(menuTitle) || menuTitle.length === 0) return "";
  return menuTitle
    .map((item, index) => {
      const lines = [`L${index + 1} Title: ${item?.title ?? ""}`];
      if (item?.description) lines.push(`L${index + 1} Description: ${item.description}`);
      for (const line of menuTitleDescriptorLines(item)) {
        lines.push(`L${index + 1} ${line}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function findLatestAiSnapshot(rows) {
  return (rows ?? []).find((row) => String(row?.type ?? "").toUpperCase() === "AI") ?? null;
}

async function fetchBrandLatestMessageRows(brandId) {
  const res = await fetch(`${API_BASE}/api/brand-latest-message?brandId=${brandId}`);
  if (!res.ok) throw new Error(`Failed to fetch latest brand messages: ${res.statusText}`);
  const { rows } = await res.json();
  return rows ?? [];
}

async function fetchBrandDishDetails(autoeatDishIds) {
  const res = await fetch(`${API_BASE}/api/brand-dish-details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autoeatDishIds }),
  });
  if (!res.ok) throw new Error(`Failed to fetch dish details: ${res.statusText}`);
  const { rows } = await res.json();
  return rows ?? [];
}

function buildLatestMenuTitleChain(menuTitleId, menuTitlesById) {
  const chain = [];
  const seen = new Set();
  let current = menuTitlesById.get(String(menuTitleId));
  while (current) {
    const currentKey = String(current.autoeatId ?? current.id ?? "");
    if (currentKey && seen.has(currentKey)) break;
    if (currentKey) seen.add(currentKey);
    chain.unshift({
      title: current.title ?? null,
      description: current.description ?? null,
      miscDescriptors: current.miscDescriptors ?? current.miscInfo ?? [],
      addonDescriptors: current.addonDescriptors ?? current.addons ?? [],
      dietDescriptors: current.dietDescriptors ?? current.diets ?? [],
      allergenDescriptors: current.allergenDescriptors ?? current.allergens ?? [],
    });
    current = current.parentId != null ? menuTitlesById.get(String(current.parentId)) : null;
  }
  return chain;
}

function buildLatestMenuTitlesById(menuTitles) {
  const map = new Map();
  for (const menuTitle of menuTitles ?? []) {
    if (menuTitle?.id != null) map.set(String(menuTitle.id), menuTitle);
    if (menuTitle?.autoeatId != null) map.set(String(menuTitle.autoeatId), menuTitle);
  }
  return map;
}

function hasMeaningfulMenuTitleValue(value) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function withLatestLeafMenuTitleDetails(chain, dish) {
  const leafDetails = {
    title: dish?.menuTitleName ?? null,
    description: dish?.menuTitleDescription ?? null,
    miscDescriptors: dish?.menuTitleMiscDescriptors ?? [],
    addonDescriptors: dish?.menuTitleAddonDescriptors ?? [],
    dietDescriptors: dish?.menuTitleDietDescriptors ?? [],
    allergenDescriptors: dish?.menuTitleAllergenDescriptors ?? [],
  };

  if (chain.length === 0) {
    return hasMeaningfulMenuTitleValue(leafDetails.title)
      || hasMeaningfulMenuTitleValue(leafDetails.description)
      || hasMeaningfulMenuTitleValue(leafDetails.miscDescriptors)
      || hasMeaningfulMenuTitleValue(leafDetails.addonDescriptors)
      || hasMeaningfulMenuTitleValue(leafDetails.dietDescriptors)
      || hasMeaningfulMenuTitleValue(leafDetails.allergenDescriptors)
      ? [leafDetails]
      : [];
  }

  const next = [...chain];
  const lastIndex = next.length - 1;
  next[lastIndex] = {
    ...next[lastIndex],
    title: next[lastIndex].title ?? leafDetails.title,
    description: next[lastIndex].description ?? leafDetails.description,
    miscDescriptors: hasMeaningfulMenuTitleValue(next[lastIndex].miscDescriptors) ? next[lastIndex].miscDescriptors : leafDetails.miscDescriptors,
    addonDescriptors: hasMeaningfulMenuTitleValue(next[lastIndex].addonDescriptors) ? next[lastIndex].addonDescriptors : leafDetails.addonDescriptors,
    dietDescriptors: hasMeaningfulMenuTitleValue(next[lastIndex].dietDescriptors) ? next[lastIndex].dietDescriptors : leafDetails.dietDescriptors,
    allergenDescriptors: hasMeaningfulMenuTitleValue(next[lastIndex].allergenDescriptors) ? next[lastIndex].allergenDescriptors : leafDetails.allergenDescriptors,
  };
  return next;
}

function descriptorValueToText(value, { omitImageSrc = false } = {}) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return descriptorObjectToPlain(value, { omitImageSrc });
}

function menuTitleDescriptorLines(mt) {
  const descriptors = [
    ["Misc Descriptors", descriptorValueToText(mt?.miscDescriptors)],
    ["Addon Descriptors", descriptorValueToText(mt?.addonDescriptors)],
    ["Diet Descriptors", descriptorValueToText(mt?.dietDescriptors, { omitImageSrc: true })],
    ["Allergen Descriptors", descriptorValueToText(mt?.allergenDescriptors)],
  ];

  return descriptors
    .filter(([, value]) => value)
    .map(([label, value]) => `${label}: ${value}`);
}

function buildLatestMenuTitleCell(chain) {
  return (chain ?? [])
    .map((mt, i) => {
      const lines = [`L${i + 1} Title: ${mt.title ?? ""}`];
      if (mt.description) lines.push(`L${i + 1} Description: ${mt.description}`);
      for (const line of menuTitleDescriptorLines(mt)) {
        lines.push(`L${i + 1} ${line}`);
      }
      return lines.join("\n");
    })
    .join("\n\n");
}

function buildLatestBrandCsvRows(dishes, curationLinks, brandName) {
  return (dishes ?? []).map((dish) => {
    const link = curationLinks[String(dish.autoeatDishId)] ?? "";
    const dishIdCell = link
      ? `=HYPERLINK("${link}","${dish.dishId}")`
      : dish.dishId;

    return {
      brand_name: brandName ?? "",
      dish_id: dishIdCell,
      dish_name: dish.dishName ?? "",
      description: dish.dishDescription ?? "",
      menu_title: buildLatestMenuTitleCell(dish.menuTitleChain ?? []),
      ingredient_free_text: dish.ingredients ?? "",
      diet_descriptors: dish.dietDescriptors ?? "",
      addon_descriptors: dish.addonDescriptors ?? "",
      misc_descriptors: dish.miscDescriptors ?? "",
      allergen_descriptors: dish.allergenDescriptors ?? "",
      dish_type: dish.dishTypeName ?? "",
      course_type: dish.courseTypeName ?? "",
      main_ingredients: (dish.mainIngredients ?? []).map((item) => item?.name).filter(Boolean),
      additional_ingredients: (dish.additionalIngredients ?? []).map((item) => item?.name).filter(Boolean),
      choice_ingredients: (dish.choiceIngredients ?? []).map((item) => item?.name).filter(Boolean),
      diets: (dish.diets ?? []).map((item) => item?.name).filter(Boolean),
      allergens: (dish.allergens ?? []).map((item) => item?.name).filter(Boolean),
      diet_correctness_score: "",
      diet_correctness_reason: "",
      addon_correctness_score: "",
      addon_correctness_reason: "",
      dish_type_correctness_score: "",
      dish_type_correctness_reason: "",
      ingredient_correctness_score: "",
      ingredient_correctness_reason: "",
      allergen_correctness_score: "",
      allergen_correctness_reason: "",
    };
  });
}

const LATEST_BRAND_EXPORT_COLUMNS = [
  "brand_name",
  "dish_id",
  "dish_name",
  "description",
  "menu_title",
  "ingredient_free_text",
  "diet_descriptors",
  "addon_descriptors",
  "misc_descriptors",
  "allergen_descriptors",
  "dish_type",
  "course_type",
  "main_ingredients",
  "additional_ingredients",
  "choice_ingredients",
  "diets",
  "allergens",
  "diet_correctness_score",
  "diet_correctness_reason",
  "addon_correctness_score",
  "addon_correctness_reason",
  "dish_type_correctness_score",
  "dish_type_correctness_reason",
  "ingredient_correctness_score",
  "ingredient_correctness_reason",
  "allergen_correctness_score",
  "allergen_correctness_reason",
];

async function buildLatestBrandExportRows({ brandId, brandName, limit, onProgress } = {}) {
  const rows = await fetchBrandLatestMessageRows(brandId);
  const dishMap = new Map();
  const menuTitleChains = new Map();

  for (const row of rows) {
    const message = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
    const menuAutoeatId = message?.menu?.id;
    const menuTitlesById = buildLatestMenuTitlesById(message?.menuTitles ?? []);

    for (const dish of message?.dishes ?? []) {
      if (dish?.id == null) continue;
      dishMap.set(dish.id, menuAutoeatId);
      if (dish.menuTitleId != null) {
        menuTitleChains.set(dish.id, buildLatestMenuTitleChain(dish.menuTitleId, menuTitlesById));
      }
    }
  }

  const autoeatDishIds = [...dishMap.keys()];
  const details = await fetchBrandDishDetails(autoeatDishIds);
  const enriched = details.map((dish) => ({
    ...dish,
    menuAutoeatId: dishMap.get(dish.autoeatDishId),
    menuTitleChain: withLatestLeafMenuTitleDetails(menuTitleChains.get(dish.autoeatDishId) ?? [], dish),
  }));

  const targetDishes = Number.isFinite(limit) && limit > 0
    ? enriched.slice(0, limit)
    : enriched;

  const pairs = targetDishes.map((dish) => ({
    dishId: String(dish.autoeatDishId),
    menuAutoeatId: String(dish.menuAutoeatId ?? ""),
  }));
  const curationLinks = await fetchDishCurationLinks(pairs);

  const exportRows = buildLatestBrandCsvRows(targetDishes, curationLinks, brandName);
  const total = exportRows.length;
  exportRows.forEach((_, index) => onProgress?.({ done: index + 1, total }));

  return exportRows;
}

export async function buildLatestBrandExportCsv({ brandId, brandName, limit, onProgress } = {}) {
  const exportRows = await buildLatestBrandExportRows({ brandId, brandName, limit, onProgress });
  const total = exportRows.length;

  const csvLines = [
    LATEST_BRAND_EXPORT_COLUMNS.map((column) => escapeCsvValue(column)).join(","),
    ...exportRows.map((row) => LATEST_BRAND_EXPORT_COLUMNS.map((column) => (
      column === "diet_descriptors"
        ? escapeCsvDescriptorValue(row[column], { omitImageSrc: true })
        : column === "addon_descriptors"
        || column === "misc_descriptors"
        || column === "allergen_descriptors"
          ? escapeCsvDescriptorValue(row[column])
          : escapeCsvValue(row[column])
    )).join(",")),
  ];

  const safeBrand = String(brandName ?? "brand")
    .trim()
    .replace(/[^\w-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "brand";

  return {
    csvContent: csvLines.join("\n"),
    filename: `${safeBrand}_dishes.csv`,
    totalRows: total,
  };
}

export async function buildCombinedLatestBrandsExportCsv({ brands, onProgress } = {}) {
  const selectedBrands = Array.isArray(brands) ? brands : [];
  const allRows = [];
  let completedBrands = 0;

  for (const brand of selectedBrands) {
    const brandRows = await buildLatestBrandExportRows({
      brandId: brand.brandId,
      brandName: brand.brandName,
    });
    allRows.push(...brandRows);
    completedBrands += 1;
    onProgress?.({
      currentBrand: brand.brandName,
      doneBrands: completedBrands,
      totalBrands: selectedBrands.length,
      totalRows: allRows.length,
    });
  }

  const csvLines = [
    LATEST_BRAND_EXPORT_COLUMNS.map((column) => escapeCsvValue(column)).join(","),
    ...allRows.map((row) => LATEST_BRAND_EXPORT_COLUMNS.map((column) => (
      column === "diet_descriptors"
        ? escapeCsvDescriptorValue(row[column], { omitImageSrc: true })
        : column === "addon_descriptors"
        || column === "misc_descriptors"
        || column === "allergen_descriptors"
          ? escapeCsvDescriptorValue(row[column])
          : escapeCsvValue(row[column])
    )).join(",")),
  ];

  const stamp = new Date().toISOString().slice(0, 10);

  return {
    csvContent: csvLines.join("\n"),
    filename: `latest_brands_export_${stamp}.csv`,
    totalRows: allRows.length,
  };
}

const AI_CURATOR_EXPORT_COLUMNS = [
  "brand_name",
  "cuisine_type",
  "location_type",
  "dish_id",
  "menu_title",
  "dish_name",
  "dish_description",
  "ingredient_free_text",
  "diet_descriptors",
  "addon_descriptors",
  "misc_descriptors",
  "allergen_descriptors",
  "dish_type_ai",
  "dish_type_ai_new",
  "dish_type_curator",
  "course_type_ai",
  "course_type_ai_new",
  "course_type_curator",
  "diet_ai",
  "diet_ai_new",
  "diet_curator",
  "allergen_ai",
  "allergen_ai_new",
  "allergen_curator",
  "main_ingredient_ai",
  "main_ingredient_ai_new",
  "main_ingredient_curator",
  "choice_ingredient_ai",
  "choice_ingredient_ai_new",
  "choice_ingredient_curator",
  "additional_ingredient_ai",
  "additional_ingredient_ai_new",
  "additional_ingredient_curator",
  "ai_created_at",
  "ai_created_at_new",
  "curator_created_at",
];

const TIER_ONE_EXPORT_COLUMNS = [
  "brand_name",
  "cuisine_type",
  "location_type",
  "dish_id",
  "menu_title",
  "dish_name",
  "dish_description",
  "ingredient_free_text",
  "diet_descriptors",
  "addon_descriptors",
  "misc_descriptors",
  "allergen_descriptors",
  "suggested_tier",
  "curated_tier",
  "suggested_dish_type",
  "curated_dish_type",
  "suggested_course_type",
  "curated_course_type",
  "suggested_diet",
  "curated_diet",
  "suggested_allergen",
  "curated_allergen",
  "suggested_main_ingredient",
  "curated_main_ingredient",
  "suggested_choice_ingredient",
  "curated_choice_ingredient",
  "suggested_additional_ingredient",
  "curated_additional_ingredient",
  "ai_created_at",
  "curator_created_at",
];

function normalizeAiCuratorExportRows(rows) {
  return (rows ?? []).map((row) => ({
    brand_name: row.brandName ?? "",
    cuisine_type: row.cuisineType ?? "",
    location_type: row.locationType ?? "",
    dish_id: row.dishId ?? "",
    menu_title: buildAiCuratorMenuTitleCell(row.menuTitle),
    dish_name: row.dishName ?? "",
    dish_description: row.dishDescription ?? "",
    ingredient_free_text: row.ingredientFreeText ?? "",
    diet_descriptors: row.dietDescriptors ?? "",
    addon_descriptors: row.addonDescriptors ?? "",
    misc_descriptors: row.miscDescriptors ?? "",
    allergen_descriptors: row.allergenDescriptors ?? "",
    dish_type_ai: row.dishTypeAI ?? "",
    dish_type_ai_new: row.dishTypeAINew ?? "",
    dish_type_curator: row.dishTypeCurator ?? "",
    course_type_ai: row.courseTypeAI ?? "",
    course_type_ai_new: row.courseTypeAINew ?? "",
    course_type_curator: row.courseTypeCurator ?? "",
    diet_ai: row.dietAI ?? [],
    diet_ai_new: row.dietAINew ?? [],
    diet_curator: row.dietCurator ?? [],
    allergen_ai: row.allergenAI ?? [],
    allergen_ai_new: row.allergenAINew ?? [],
    allergen_curator: row.allergenCurator ?? [],
    main_ingredient_ai: row.mainIngredientAI ?? [],
    main_ingredient_ai_new: row.mainIngredientAINew ?? [],
    main_ingredient_curator: row.mainIngredientCurator ?? [],
    choice_ingredient_ai: row.choiceIngredientAI ?? [],
    choice_ingredient_ai_new: row.choiceIngredientAINew ?? [],
    choice_ingredient_curator: row.choiceIngredientCurator ?? [],
    additional_ingredient_ai: row.additionalIngredientAI ?? [],
    additional_ingredient_ai_new: row.additionalIngredientAINew ?? [],
    additional_ingredient_curator: row.additionalIngredientCurator ?? [],
    ai_created_at: row.aiCreatedAt ?? "",
    ai_created_at_new: row.aiCreatedAtNew ?? "",
    curator_created_at: row.curatorCreatedAt ?? "",
  }));
}

function normalizeTierOneExportRows(rows) {
  return (rows ?? []).map((row) => ({
    brand_name: row.brandName ?? "",
    cuisine_type: row.cuisineType ?? "",
    location_type: row.locationType ?? "",
    dish_id: row.dishId ?? "",
    menu_title: buildAiCuratorMenuTitleCell(row.menuTitle),
    dish_name: row.dishName ?? "",
    dish_description: row.dishDescription ?? "",
    ingredient_free_text: row.ingredientFreeText ?? "",
    diet_descriptors: row.dietDescriptors ?? "",
    addon_descriptors: row.addonDescriptors ?? "",
    misc_descriptors: row.miscDescriptors ?? "",
    allergen_descriptors: row.allergenDescriptors ?? "",
    suggested_tier: row.suggestedTier ?? 1,
    curated_tier: row.curatedTier ?? "",
    suggested_dish_type: row.dishTypeAI ?? "",
    curated_dish_type: row.dishTypeCurator ?? "",
    suggested_course_type: row.courseTypeAI ?? "",
    curated_course_type: row.courseTypeCurator ?? "",
    suggested_diet: row.dietAI ?? [],
    curated_diet: row.dietCurator ?? [],
    suggested_allergen: row.allergenAI ?? [],
    curated_allergen: row.allergenCurator ?? [],
    suggested_main_ingredient: row.mainIngredientAI ?? [],
    curated_main_ingredient: row.mainIngredientCurator ?? [],
    suggested_choice_ingredient: row.choiceIngredientAI ?? [],
    curated_choice_ingredient: row.choiceIngredientCurator ?? [],
    suggested_additional_ingredient: row.additionalIngredientAI ?? [],
    curated_additional_ingredient: row.additionalIngredientCurator ?? [],
    ai_created_at: row.aiCreatedAt ?? "",
    curator_created_at: row.curatorCreatedAt ?? "",
  }));
}

export async function buildCombinedAiCuratorTaskExportCsv({ brands, limitPerTask, onProgress } = {}) {
  const selectedBrands = (Array.isArray(brands) ? brands : []).filter((brand) => brand?.menuCurationTaskId);
  const allRows = [];
  let completedBrands = 0;

  for (const brand of selectedBrands) {
    const taskRows = await fetchMenuCurationTaskAiCuratorExportRows(brand.menuCurationTaskId, limitPerTask);
    const normalizedRows = normalizeAiCuratorExportRows(taskRows);
    allRows.push(...normalizedRows);
    completedBrands += 1;
    onProgress?.({
      currentBrand: brand.brandName,
      doneBrands: completedBrands,
      totalBrands: selectedBrands.length,
      totalRows: allRows.length,
    });
  }

  const csvLines = [
    AI_CURATOR_EXPORT_COLUMNS.map((column) => escapeCsvValue(column)).join(","),
    ...allRows.map((row) => AI_CURATOR_EXPORT_COLUMNS.map((column) => (
      column === "diet_descriptors"
        ? escapeCsvDescriptorValue(row[column], { omitImageSrc: true })
        : column === "addon_descriptors"
        || column === "misc_descriptors"
        || column === "allergen_descriptors"
          ? escapeCsvDescriptorValue(row[column])
          : escapeCsvValue(row[column])
    )).join(",")),
  ];

  const stamp = new Date().toISOString().slice(0, 10);

  return {
    csvContent: csvLines.join("\n"),
    filename: `ai_curator_task_export_${stamp}.csv`,
    totalRows: allRows.length,
    totalBrands: selectedBrands.length,
  };
}

export async function buildCombinedTierOneTaskExportCsv({ brands, limitPerTask, onProgress } = {}) {
  const selectedBrands = (Array.isArray(brands) ? brands : []).filter((brand) => brand?.menuCurationTaskId);
  const allRows = [];
  let completedBrands = 0;

  for (const brand of selectedBrands) {
    const taskRows = await fetchMenuCurationTaskTierOneExportRows(brand.menuCurationTaskId, limitPerTask);
    const normalizedRows = normalizeTierOneExportRows(taskRows);
    allRows.push(...normalizedRows);
    completedBrands += 1;
    onProgress?.({
      currentBrand: brand.brandName,
      doneBrands: completedBrands,
      totalBrands: selectedBrands.length,
      totalRows: allRows.length,
    });
  }

  const csvLines = [
    TIER_ONE_EXPORT_COLUMNS.map((column) => escapeCsvValue(column)).join(","),
    ...allRows.map((row) => TIER_ONE_EXPORT_COLUMNS.map((column) => (
      column === "diet_descriptors"
        ? escapeCsvDescriptorValue(row[column], { omitImageSrc: true })
        : column === "addon_descriptors"
        || column === "misc_descriptors"
        || column === "allergen_descriptors"
          ? escapeCsvDescriptorValue(row[column])
          : escapeCsvValue(row[column])
    )).join(",")),
  ];

  const stamp = new Date().toISOString().slice(0, 10);

  return {
    csvContent: csvLines.join("\n"),
    filename: `tier_one_task_export_${stamp}.csv`,
    totalRows: allRows.length,
    totalBrands: selectedBrands.length,
  };
}

export async function buildFilteredDishesExportCsv({
  beforeRecord,
  afterRecord,
  brandName,
  filteredDishIds,
  onProgress,
}) {
  const afterMessage = afterRecord?.message ?? {};
  const menuTitles = Array.isArray(afterMessage.menuTitles) ? afterMessage.menuTitles : [];
  const menuTitleById = new Map(menuTitles.map((title) => [String(title?.id ?? ""), title]));
  const dishes = Array.isArray(afterMessage.dishes) ? afterMessage.dishes : [];
  const filteredDishIdSet = new Set((filteredDishIds ?? []).map((id) => String(id)));
  const targetDishes = dishes.filter((dish) => filteredDishIdSet.has(String(dish?.id ?? "")));

  const total = targetDishes.length;
  let done = 0;
  const rows = [];

  for (const dish of targetDishes) {
    const dishId = dish?.id;
    let latestAiSnapshot = null;
    if (dishId !== null && dishId !== undefined) {
      try {
        const snapshots = await fetchDishSnapshots(dishId, beforeRecord?.createdAt ?? undefined);
        latestAiSnapshot = findLatestAiSnapshot(snapshots);
      } catch {
        latestAiSnapshot = null;
      }
    }

    const menuTitle = menuTitleById.get(String(dish?.menuTitleId ?? "")) ?? null;
    rows.push({
      brand_name: brandName ?? "",
      dish_name: dish?.name ?? "",
      dish_description: dish?.description ?? "",
      menu_title: menuTitle?.title ?? "",
      menu_title_description: menuTitle?.description ?? "",
      ingredient_free_text: dish?.ingredients ?? "",
      addson_descriptor: dish?.addons ?? [],
      diet_descriptor: dish?.diets ?? [],
      allergen_descriptor: dish?.allergens ?? [],
      dish_type: latestAiSnapshot?.dishType ?? "",
      course_type: latestAiSnapshot?.courseType ?? "",
      diets: latestAiSnapshot?.diets ?? [],
      allergens: latestAiSnapshot?.allergens ?? [],
      main_ingredients: latestAiSnapshot?.mainIngredients ?? [],
      choice_ingredients: latestAiSnapshot?.choiceIngredients ?? [],
      additional_ingredients: latestAiSnapshot?.additionalIngredients ?? [],
      type: latestAiSnapshot?.type ?? "",
    });

    done += 1;
    onProgress?.({ done, total });
  }

  const columns = [
    "brand_name",
    "dish_name",
    "dish_description",
    "menu_title",
    "menu_title_description",
    "ingredient_free_text",
    "addson_descriptor",
    "diet_descriptor",
    "allergen_descriptor",
    "dish_type",
    "course_type",
    "diets",
    "allergens",
    "main_ingredients",
    "choice_ingredients",
    "additional_ingredients",
    "type",
  ];

  const csvLines = [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => escapeCsvValue(row[column])).join(",")),
  ];

  const safeBrand = String(brandName ?? "brand")
    .trim()
    .replace(/[^\w-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "brand";
  const filename = `${safeBrand}_export_sheets.csv`;

  return {
    csvContent: csvLines.join("\n"),
    filename,
  };
}

// Builds a CSV from the two selected records (beforeRecord, afterRecord) and saves to Supabase.
// Fetches all dish snapshots (created after beforeRecord.createdAt) and bakes them into the after row.
// Returns the saved upload record.
export async function exportSingleBrandToCSV(beforeRecord, afterRecord, brandName, userId, { onProgress } = {}) {
  // Collect all dish autoeat IDs from the after message
  const dishes = afterRecord.message?.dishes ?? [];
  const total = dishes.length;
  let done = 0;

  const snapshotsMap = {};
  await Promise.all(
    dishes.map(async (dish) => {
      if (!dish?.id) return;
      try {
        const rows = await fetchDishSnapshots(dish.id, beforeRecord.createdAt);
        snapshotsMap[dish.id] = rows;
      } catch {
        snapshotsMap[dish.id] = [];
      } finally {
        done += 1;
        onProgress?.({ done, total });
      }
    })
  );

  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const toRow = (r, snapshots) => {
    const cols = [r.id, r.createdAt ?? "", r.updatedAt ?? "", JSON.stringify(r.message)];
    if (snapshots !== undefined) cols.push(JSON.stringify(snapshots));
    return cols.map(escape).join(",");
  };

  const header = "id,createdAt,updatedAt,message,snapshots";
  const body = [
    toRow(beforeRecord, undefined),   // before row — no snapshots column value
    toRow(afterRecord, snapshotsMap), // after row — snapshots baked in
  ].join("\n");
  const csvContent = `${header}\n${body}`;

  const now = new Date();
  const label = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const name = `${String(brandName ?? "Brand").trim()} — ${label}`;

  const csvBytes = new TextEncoder().encode(csvContent);
  const compressionStream = new CompressionStream("gzip");
  const writer = compressionStream.writable.getWriter();
  writer.write(csvBytes);
  writer.close();
  const compressedChunks = [];
  const reader = compressionStream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    compressedChunks.push(value);
  }
  const compressedBytes = new Uint8Array(compressedChunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const chunk of compressedChunks) { compressedBytes.set(chunk, offset); offset += chunk.length; }
  const file = new File([compressedBytes], `${name}.csv.gz`, { type: "application/gzip" });

  const saved = await saveUpload(name, file, userId);
  return saved;
}

// Streams messages for every top-200 brand, builds a CSV, and saves it to Supabase.
// onProgress({ done, brandsDone, brandsTotal, totalRows }) fires as work proceeds.
// Returns the saved upload record.
export async function exportAllBrandsToCSV(userId, { onProgress } = {}) {
  const overviewRes = await fetch(`${API_BASE}/api/overview`);
  if (!overviewRes.ok) throw new Error("Failed to fetch overview");
  const { rows: overviewRows } = await overviewRes.json();

  // Deduplicate brand IDs while preserving order
  const seen = new Set();
  const brands = [];
  for (const r of overviewRows) {
    if (!seen.has(r.brandId)) {
      seen.add(r.brandId);
      brands.push({ id: r.brandId, name: r.brandName });
    }
  }

  const brandsTotal = brands.length;
  let brandsDone = 0;
  let totalRows = 0;
  const csvRows = [];

  // Process brands in batches of 10 in parallel
  const BATCH = 10;
  for (let i = 0; i < brands.length; i += BATCH) {
    const batch = brands.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (brand) => {
        await streamMessages({ brandId: brand.id }, {
          onRow: (row) => {
            csvRows.push({
              id: row.id,
              createdAt: row.createdAt ?? "",
              updatedAt: row.updatedAt ?? "",
              message: JSON.stringify(row.message),
            });
          },
        });
        brandsDone += 1;
        totalRows = csvRows.length;
        onProgress?.({ done: false, brandsDone, brandsTotal, totalRows });
      }),
    );
  }

  // Build CSV string
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = "id,createdAt,updatedAt,message";
  const body = csvRows.map((r) => [r.id, r.createdAt, r.updatedAt, r.message].map(escape).join(",")).join("\n");
  const csvContent = `${header}\n${body}`;

  const now = new Date();
  const label = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const name = `All Brands — ${label}`;

  // Gzip before upload — repetitive JSON compresses ~10:1, keeping well under the 50MB limit
  const csvBytes = new TextEncoder().encode(csvContent);
  const compressionStream = new CompressionStream("gzip");
  const writer = compressionStream.writable.getWriter();
  writer.write(csvBytes);
  writer.close();
  const compressedChunks = [];
  const reader = compressionStream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    compressedChunks.push(value);
  }
  const compressedBytes = new Uint8Array(compressedChunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const chunk of compressedChunks) { compressedBytes.set(chunk, offset); offset += chunk.length; }
  const file = new File([compressedBytes], `${name}.csv.gz`, { type: "application/gzip" });

  const saved = await saveUpload(name, file, userId);
  onProgress?.({ done: true, brandsDone, brandsTotal, totalRows });
  return saved;
}
