// CSV export builders. Composes API fetchers + csvHelpers into downloadable rows.

import { saveUpload } from "./csvUploads";
import {
  fetchBrandDishDetails,
  fetchBrandLatestMessageRows,
  fetchDishCurationLinks,
  fetchDishSnapshots,
  fetchMenuCurationTaskAiCuratorExportRows,
  fetchMenuCurationTaskTierOneExportRows,
} from "./api";
import {
  buildMenuTitleChain,
  buildMenuTitlesById,
  escapeCsvValue,
  escapeTaskExportCell,
  findLatestAiSnapshot,
  formatDescriptorTextBlock,
  gzipString,
  withLeafMenuTitleDetails,
  withMenuTitleLevels,
} from "./csvHelpers";

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
      menu_title: withMenuTitleLevels(dish.menuTitleChain ?? []),
      ingredient_free_text: dish.ingredients ?? "",
      diet_descriptors: dish.dietDescriptors ?? "",
      addon_descriptors: formatDescriptorTextBlock(dish.addonDescriptors),
      misc_descriptors: formatDescriptorTextBlock(dish.miscDescriptors),
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

async function buildLatestBrandExportRows({ brandId, brandName, limit, onProgress } = {}) {
  const rows = await fetchBrandLatestMessageRows(brandId);
  const dishMap = new Map();
  const menuTitleChains = new Map();

  for (const row of rows) {
    const message = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
    const menuAutoeatId = message?.menu?.id;
    const menuTitlesById = buildMenuTitlesById(message?.menuTitles ?? []);

    for (const dish of message?.dishes ?? []) {
      if (dish?.id == null) continue;
      dishMap.set(dish.id, menuAutoeatId);
      if (dish.menuTitleId != null) {
        menuTitleChains.set(dish.id, buildMenuTitleChain(dish.menuTitleId, menuTitlesById));
      }
    }
  }

  const autoeatDishIds = [...dishMap.keys()];
  const details = await fetchBrandDishDetails(autoeatDishIds);
  const enriched = details.map((dish) => ({
    ...dish,
    menuAutoeatId: dishMap.get(dish.autoeatDishId),
    menuTitleChain: withLeafMenuTitleDetails(menuTitleChains.get(dish.autoeatDishId) ?? [], dish),
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
    ...allRows.map((row) => LATEST_BRAND_EXPORT_COLUMNS.map((column) => escapeTaskExportCell(column, row[column])).join(",")),
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
  "suggested_dish_type",
  "new_suggested_dish_type",
  "curated_dish_type",
  "suggested_course_type",
  "new_suggested_course_type",
  "curated_course_type",
  "suggested_diet",
  "new_suggested_diet",
  "curated_diet",
  "suggested_allergen",
  "new_suggested_allergen",
  "curated_allergen",
  "suggested_main_ingredient",
  "new_suggested_main_ingredient",
  "curated_main_ingredient",
  "suggested_additional_ingredient",
  "new_suggested_additional_ingredient",
  "curated_additional_ingredient",
  "suggested_choice_ingredient",
  "new_suggested_choice_ingredient",
  "curated_choice_ingredient",
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
  "suggested_additional_ingredient",
  "curated_additional_ingredient",
  "suggested_choice_ingredient",
  "curated_choice_ingredient",
];

function normalizeAiCuratorExportRows(rows) {
  return (rows ?? []).map((row) => ({
    brand_name: row.brandName ?? "",
    cuisine_type: row.cuisineType ?? "",
    location_type: row.locationType ?? "",
    dish_id: row.dishId ?? "",
    menu_title: withMenuTitleLevels(row.menuTitle ?? []),
    dish_name: row.dishName ?? "",
    dish_description: row.dishDescription ?? "",
    ingredient_free_text: row.ingredientFreeText ?? "",
    diet_descriptors: row.dietDescriptors ?? "",
    addon_descriptors: formatDescriptorTextBlock(row.addonDescriptors),
    misc_descriptors: formatDescriptorTextBlock(row.miscDescriptors),
    allergen_descriptors: row.allergenDescriptors ?? "",
    suggested_dish_type: row.dishTypeAI ?? "",
    new_suggested_dish_type: row.dishTypeAINew ?? "",
    curated_dish_type: row.dishTypeCurator ?? "",
    suggested_course_type: row.courseTypeAI ?? "",
    new_suggested_course_type: row.courseTypeAINew ?? "",
    curated_course_type: row.courseTypeCurator ?? "",
    suggested_diet: row.dietAI ?? [],
    new_suggested_diet: row.dietAINew ?? [],
    curated_diet: row.dietCurator ?? [],
    suggested_allergen: row.allergenAI ?? [],
    new_suggested_allergen: row.allergenAINew ?? [],
    curated_allergen: row.allergenCurator ?? [],
    suggested_main_ingredient: row.mainIngredientAI ?? [],
    new_suggested_main_ingredient: row.mainIngredientAINew ?? [],
    curated_main_ingredient: row.mainIngredientCurator ?? [],
    suggested_choice_ingredient: row.choiceIngredientAI ?? [],
    new_suggested_choice_ingredient: row.choiceIngredientAINew ?? [],
    curated_choice_ingredient: row.choiceIngredientCurator ?? [],
    suggested_additional_ingredient: row.additionalIngredientAI ?? [],
    new_suggested_additional_ingredient: row.additionalIngredientAINew ?? [],
    curated_additional_ingredient: row.additionalIngredientCurator ?? [],
  }));
}

function normalizeTierOneExportRows(rows) {
  return (rows ?? []).map((row) => ({
    brand_name: row.brandName ?? "",
    cuisine_type: row.cuisineType ?? "",
    location_type: row.locationType ?? "",
    dish_id: row.dishId ?? "",
    menu_title: withMenuTitleLevels(row.menuTitle ?? []),
    dish_name: row.dishName ?? "",
    dish_description: row.dishDescription ?? "",
    ingredient_free_text: row.ingredientFreeText ?? "",
    diet_descriptors: row.dietDescriptors ?? "",
    addon_descriptors: formatDescriptorTextBlock(row.addonDescriptors),
    misc_descriptors: formatDescriptorTextBlock(row.miscDescriptors),
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
    ...allRows.map((row) => AI_CURATOR_EXPORT_COLUMNS.map((column) => escapeTaskExportCell(column, row[column])).join(",")),
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
    ...allRows.map((row) => TIER_ONE_EXPORT_COLUMNS.map((column) => escapeTaskExportCell(column, row[column])).join(",")),
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
export async function exportSingleBrandToCSV(beforeRecord, afterRecord, brandName, userId, { onProgress } = {}) {
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
    toRow(beforeRecord, undefined),
    toRow(afterRecord, snapshotsMap),
  ].join("\n");
  const csvContent = `${header}\n${body}`;

  const now = new Date();
  const label = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const name = `${String(brandName ?? "Brand").trim()} — ${label}`;

  const compressedBytes = await gzipString(csvContent);
  const file = new File([compressedBytes], `${name}.csv.gz`, { type: "application/gzip" });

  const saved = await saveUpload(name, file, userId);
  return saved;
}
