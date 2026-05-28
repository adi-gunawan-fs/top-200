// CSV stringification + descriptor formatting helpers shared by export builders.
// Pure functions — no fetch, no React.

export function stringifyCell(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value.map((entry) => stringifyCell(entry)).filter(Boolean).join(", ");
  }
  if (typeof value === "object") {
    return stringifyCell(value.text ?? value.innerText ?? value.name ?? JSON.stringify(value));
  }
  return String(value);
}

export function descriptorObjectToPlain(value, { omitImageSrc = false } = {}) {
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

function sanitizeJsonExportValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") return value.trim() === "" ? undefined : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const next = value
      .map((entry) => sanitizeJsonExportValue(entry))
      .filter((entry) => entry !== undefined);
    return next.length > 0 ? next : undefined;
  }
  if (typeof value === "object") {
    const next = Object.entries(value).reduce((acc, [key, entryValue]) => {
      const sanitizedEntry = sanitizeJsonExportValue(entryValue);
      if (sanitizedEntry !== undefined) acc[key] = sanitizedEntry;
      return acc;
    }, {});
    return Object.keys(next).length > 0 ? next : undefined;
  }
  return value;
}

export function stringifyJsonCell(value) {
  const sanitized = sanitizeJsonExportValue(value);
  if (sanitized === undefined) return "";
  if (typeof sanitized === "string") return sanitized;
  return JSON.stringify(sanitized);
}

export function escapeCsvJsonValue(value) {
  const text = stringifyJsonCell(value);
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function escapeCsvValue(value) {
  const text = stringifyCell(value);
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function escapeTaskExportCell(column, value) {
  return column === "menu_title"
    || column === "diet_descriptors"
    || column === "addon_descriptors"
    || column === "misc_descriptors"
    || column === "allergen_descriptors"
    ? escapeCsvJsonValue(value)
    : escapeCsvValue(value);
}

export function extractDescriptorTextValues(value) {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry) => extractDescriptorTextValues(entry));
  }
  if (typeof value === "object") {
    if (typeof value.text === "string" && value.text.trim() !== "") {
      return [value.text];
    }
    return Object.values(value).flatMap((entry) => extractDescriptorTextValues(entry));
  }
  return [String(value)];
}

export function formatDescriptorTextBlock(value) {
  return extractDescriptorTextValues(value).join("\n\n");
}

export function withMenuTitleLevels(menuTitle) {
  if (!Array.isArray(menuTitle) || menuTitle.length === 0) return [];
  return menuTitle.map((entry, index) => ({
    level: index + 1,
    ...(entry ?? {}),
    addonDescriptors: formatDescriptorTextBlock(entry?.addonDescriptors),
    miscDescriptors: formatDescriptorTextBlock(entry?.miscDescriptors),
  }));
}

function descriptorValueToText(value, { omitImageSrc = false } = {}) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return descriptorObjectToPlain(value, { omitImageSrc });
}

export function menuTitleDescriptorLines(mt) {
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

// Builds the menu title chain (root → leaf) by walking parentId pointers.
export function buildMenuTitleChain(menuTitleId, menuTitlesById) {
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

export function buildMenuTitlesById(menuTitles) {
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

// Merges dish-level leaf menu-title details into the leaf node of the chain.
export function withLeafMenuTitleDetails(chain, dish) {
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

export function findLatestAiSnapshot(rows) {
  return (rows ?? []).find((row) => String(row?.type ?? "").toUpperCase() === "AI") ?? null;
}

export function buildAiCuratorMenuTitleCell(menuTitle) {
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

export function buildLatestMenuTitleCell(chain) {
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

// Gzip helper used by Supabase storage uploads.
export async function gzipString(text) {
  const bytes = new TextEncoder().encode(text);
  const compressionStream = new CompressionStream("gzip");
  const writer = compressionStream.writable.getWriter();
  writer.write(bytes);
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
  return compressedBytes;
}
