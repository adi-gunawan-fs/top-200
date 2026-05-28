// CSV exports local to the Large Brand page (single-brand snapshot & compare).
// The combined "all brands" exports live in lib/exports.js.

function escapeCsv(value) {
  const s = value == null ? "" : (typeof value === "object" ? JSON.stringify(value) : String(value));
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function curationListToText(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items.map((item) => item.name).join(", ");
}

function descriptorValueToText(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => descriptorValueToText(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return descriptorValueToText(value.text ?? value.innerText ?? value.name ?? "");
  }
  return "";
}

function menuTitleDescriptorLines(mt) {
  const descriptors = [
    ["Misc Descriptors", descriptorValueToText(mt?.miscDescriptors)],
    ["Addon Descriptors", descriptorValueToText(mt?.addonDescriptors)],
    ["Diet Descriptors", descriptorValueToText(mt?.dietDescriptors)],
    ["Allergen Descriptors", descriptorValueToText(mt?.allergenDescriptors)],
  ];
  return descriptors.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`);
}

export function buildCompareExportRows(dishes, brandName, snapshotPair) {
  const jsonField = (obj, key) => {
    const val = obj?.[key];
    if (val == null) return "";
    if (typeof val === "string") return val;
    return JSON.stringify(val);
  };

  const hasValue = (v) => v !== null && v !== undefined && String(v).trim() !== "";
  const statusFromExactMatch = (beforeVal, afterVal) => {
    if (beforeVal === afterVal) return "EXACT_MATCH";
    if (hasValue(beforeVal) && !hasValue(afterVal)) return "EXACT_MATCH";
    return "";
  };

  return dishes.map((dish) => {
    const beforeDish = snapshotPair?.before?.get(dish.autoeatDishId) ?? null;
    const afterDish = snapshotPair?.after?.get(dish.autoeatDishId) ?? null;
    const beforeName = jsonField(beforeDish, "name");
    const afterName = jsonField(afterDish, "name");
    const beforeDescription = jsonField(beforeDish, "description");
    const afterDescription = jsonField(afterDish, "description");
    const beforeIngredient = jsonField(beforeDish, "ingredients");
    const afterIngredient = jsonField(afterDish, "ingredients");
    const beforeAddons = jsonField(beforeDish, "addons");
    const afterAddons = jsonField(afterDish, "addons");
    const beforeAllergens = jsonField(beforeDish, "allergens");
    const afterAllergens = jsonField(afterDish, "allergens");
    const beforeDiets = jsonField(beforeDish, "diets");
    const afterDiets = jsonField(afterDish, "diets");

    return {
      brand_name: brandName ?? "",
      dish_id: String(dish.dishId ?? ""),
      dish_name: dish.dishName ?? "",
      before_name: beforeName,
      after_name: afterName,
      name_status: statusFromExactMatch(beforeName, afterName),
      before_description: beforeDescription,
      after_description: afterDescription,
      description_status: statusFromExactMatch(beforeDescription, afterDescription),
      before_ingredient: beforeIngredient,
      after_ingredient: afterIngredient,
      ingredient_status: statusFromExactMatch(beforeIngredient, afterIngredient),
      before_addons: beforeAddons,
      after_addons: afterAddons,
      addons_status: statusFromExactMatch(beforeAddons, afterAddons),
      before_allergens: beforeAllergens,
      after_allergens: afterAllergens,
      allergens_status: statusFromExactMatch(beforeAllergens, afterAllergens),
      before_diets: beforeDiets,
      after_diets: afterDiets,
      diets_status: statusFromExactMatch(beforeDiets, afterDiets),
    };
  });
}

export function applyExperimentFieldSelection(rows, selectedFields) {
  const fieldMap = [
    { key: "name", before: "before_name", after: "after_name", status: "name_status" },
    { key: "description", before: "before_description", after: "after_description", status: "description_status" },
    { key: "ingredient", before: "before_ingredient", after: "after_ingredient", status: "ingredient_status" },
    { key: "addons", before: "before_addons", after: "after_addons", status: "addons_status" },
    { key: "allergens", before: "before_allergens", after: "after_allergens", status: "allergens_status" },
    { key: "diets", before: "before_diets", after: "after_diets", status: "diets_status" },
  ];

  return rows.map((row) => {
    const out = { ...row };
    for (const f of fieldMap) {
      if (!selectedFields?.[f.key]) {
        out[f.before] = "";
        out[f.after] = "";
        out[f.status] = "";
      }
    }
    return out;
  });
}

function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportCompareCsv(dishes, curationLinks, brandName, snapshotPair) {
  const headers = [
    "Brand Name", "Dish ID", "Dish Name",
    "Before Name", "After Name", "Name Status",
    "Before Description", "After Description", "Description Status",
    "Before Ingredient", "After Ingredient", "Ingredient Status",
    "Before Addons", "After Addons", "Addons Status",
    "Before Allergens", "After Allergens", "Allergens Status",
    "Before Diets", "After Diets", "Diets Status",
  ];
  const exportRows = buildCompareExportRows(dishes, brandName, snapshotPair);
  const rows = exportRows.map((row) => [
    escapeCsv(row.brand_name),
    escapeCsv(row.dish_id),
    escapeCsv(row.dish_name),
    escapeCsv(row.before_name),
    escapeCsv(row.after_name),
    escapeCsv(row.name_status),
    escapeCsv(row.before_description),
    escapeCsv(row.after_description),
    escapeCsv(row.description_status),
    escapeCsv(row.before_ingredient),
    escapeCsv(row.after_ingredient),
    escapeCsv(row.ingredient_status),
    escapeCsv(row.before_addons),
    escapeCsv(row.after_addons),
    escapeCsv(row.addons_status),
    escapeCsv(row.before_allergens),
    escapeCsv(row.after_allergens),
    escapeCsv(row.allergens_status),
    escapeCsv(row.before_diets),
    escapeCsv(row.after_diets),
    escapeCsv(row.diets_status),
  ].join(","));

  const csv = [headers.map(escapeCsv).join(","), ...rows].join("\n");
  downloadCsv(csv, `${brandName.replace(/[^\w-]+/g, "_")}_compare.csv`);
}

export function exportToCsv(dishes, curationLinks, brandName) {
  const headers = [
    "Brand Name", "Dish ID", "Dish Name", "Description",
    "Menu Title",
    "Ingredient Free Text", "Diet Descriptors", "Addon Descriptors", "Allergen Descriptors",
    "Dish Type", "Course Type",
    "Main Ingredients", "Additional Ingredients", "Choice Ingredients",
    "Diets", "Allergens",
    "Diet Correctness Score", "Diet Correctness Reason",
    "Addon Correctness Score", "Addon Correctness Reason",
    "Dish Type Correctness Score", "Dish Type Correctness Reason",
    "Ingredient Correctness Score", "Ingredient Correctness Reason",
    "Allergen Correctness Score", "Allergen Correctness Reason",
  ];

  const rows = dishes.map((dish) => {
    const link = curationLinks[String(dish.autoeatDishId)] ?? "";
    const dishIdCell = link
      ? `"=HYPERLINK(""${link}"",""${dish.dishId}"")"`
      : escapeCsv(dish.dishId);
    const chain = dish.menuTitleChain ?? [];
    const menuTitleCell = escapeCsv(
      chain
        .map((mt, i) => {
          const lines = [`L${i + 1} Title: ${mt.title ?? ""}`];
          if (mt.description) lines.push(`L${i + 1} Description: ${mt.description}`);
          for (const line of menuTitleDescriptorLines(mt)) {
            lines.push(`L${i + 1} ${line}`);
          }
          return lines.join("\n");
        })
        .join("\n\n"),
    );
    return [
      escapeCsv(brandName),
      dishIdCell,
      escapeCsv(dish.dishName ?? ""),
      escapeCsv(dish.dishDescription ?? ""),
      menuTitleCell,
      escapeCsv(dish.ingredients ?? ""),
      escapeCsv(dish.dietDescriptors ?? ""),
      escapeCsv(dish.addonDescriptors ?? ""),
      escapeCsv(dish.allergenDescriptors ?? ""),
      escapeCsv(dish.dishTypeName ?? ""),
      escapeCsv(dish.courseTypeName ?? ""),
      escapeCsv(curationListToText(dish.mainIngredients)),
      escapeCsv(curationListToText(dish.additionalIngredients)),
      escapeCsv(curationListToText(dish.choiceIngredients)),
      escapeCsv(curationListToText(dish.diets)),
      escapeCsv(curationListToText(dish.allergens)),
      "", "", "", "", "", "", "", "", "", "",
    ].join(",");
  });

  const csv = [headers.map(escapeCsv).join(","), ...rows].join("\n");
  downloadCsv(csv, `${brandName.replace(/[^\w-]+/g, "_")}_dishes.csv`);
}

export { menuTitleDescriptorLines };
