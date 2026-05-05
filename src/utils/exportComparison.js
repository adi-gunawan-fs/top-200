import { getFieldRelevancy, shouldHideChangedField } from "./filterUtils";

const TEXT_ONLY_FIELDS = new Set(["addons", "nutritions", "allergens", "diets", "miscInfo"]);

function extractTextValue(path, value) {
  const root = path.split(/[.[]/)[0];
  if (!TEXT_ONLY_FIELDS.has(root)) {
    return value;
  }
  if (Array.isArray(value)) {
    const texts = value.map((item) => (item && typeof item === "object" ? item.text ?? item.innerText ?? null : item)).filter((t) => t != null);
    return texts.length === 1 ? texts[0] : texts.length > 1 ? texts.join("\n") : null;
  }
  if (value && typeof value === "object") {
    return value.text ?? value.innerText ?? null;
  }
  return value;
}

function normalizeExportValue(value) {
  return value === undefined ? null : value;
}

function isExportPlaceholder(value) {
  return value === "-" || value === undefined || value === null;
}

function getExportItemNameByVersion(item, versionKey) {
  const versionItem = versionKey === "before" ? item.before : item.after;
  const raw = item.type === "dish"
    ? versionItem?.name ?? null
    : versionItem?.title ?? null;

  return isExportPlaceholder(raw) ? null : normalizeExportValue(raw);
}

function getRelevantExportFields(item) {
  return (item.changedFields ?? [])
    .filter((field) => getFieldRelevancy(field) === "Relevant")
    .filter((field) => !shouldHideChangedField(item, field));
}

function buildChangeField(fields, versionKey) {
  const out = {};

  fields.forEach((field) => {
    const path = field?.path ?? "";
    if (!path || path.startsWith("(")) {
      return;
    }

    const rawValue = versionKey === "before" ? field.beforeValue : field.afterValue;
    if (isExportPlaceholder(rawValue)) {
      return;
    }

    const extracted = extractTextValue(path, rawValue);
    if (isExportPlaceholder(extracted)) {
      return;
    }

    out[path] = normalizeExportValue(extracted);
  });

  return out;
}

export function toBeforeAfterExport(item) {
  const type = item.type === "dish" ? "dishes" : "menuTitle";
  const beforeName = getExportItemNameByVersion(item, "before");
  const afterName = getExportItemNameByVersion(item, "after");
  const relevantFields = getRelevantExportFields(item);
  const beforeChangeField = buildChangeField(relevantFields, "before");
  const afterChangeField = buildChangeField(relevantFields, "after");

  return {
    before: { type, name: beforeName, changeField: beforeChangeField },
    after: { type, name: afterName, changeField: afterChangeField },
  };
}

export function hasRelevantExportChange(item) {
  const relevantFields = getRelevantExportFields(item);
  return relevantFields.some((field) => {
    const path = field?.path ?? "";
    if (!path || path.startsWith("(")) {
      return false;
    }
    return !isExportPlaceholder(field.beforeValue) || !isExportPlaceholder(field.afterValue);
  });
}

export function buildComparisonExport({ visibleMenuTitleRows, visibleDishRows }) {
  return [
    ...visibleMenuTitleRows
      .filter(hasRelevantExportChange)
      .map(toBeforeAfterExport),
    ...visibleDishRows
      .filter(hasRelevantExportChange)
      .map(toBeforeAfterExport),
  ];
}

export function downloadExportFile(content, mimeType, filename) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
