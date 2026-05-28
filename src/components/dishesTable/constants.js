export const STATUS_FILTER_OPTIONS = [
  { value: "new", label: "New" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "unchanged", label: "No Changes" },
];

export const RELEVANCY_FILTER_OPTIONS = [
  { value: "Relevant", label: "Relevant", defaultChecked: true },
  { value: "Not Relevant", label: "Not Relevant", defaultChecked: false },
];

export const DEFAULT_SELECTED_STATUSES = STATUS_FILTER_OPTIONS
  .filter((option) => option.value !== "deleted" && option.value !== "unchanged")
  .map((option) => option.value);

export const DEFAULT_SELECTED_RELEVANCIES = RELEVANCY_FILTER_OPTIONS
  .filter((option) => option.defaultChecked)
  .map((option) => option.value);

export const INLINE_SNAPSHOT_COLUMNS = [
  { key: "type", label: "Type", nowrap: true },
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

export const PAGE_SIZE = 20;

export function cleanHtmlText(str) {
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

export function formatAddons(value) {
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

export function formatSnapshotValue(value, pct = false) {
  if (value === null || value === undefined) return null; // caller renders em-dash
  if (Array.isArray(value)) return value.length === 0 ? null : value.join(", ");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && value.includes("T") && value.includes("Z")) return new Date(value).toLocaleString();
  if (pct && typeof value === "number") return `${(value * 100).toFixed(2)}%`;
  return String(value);
}
