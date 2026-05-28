// Pure dish comparison logic — text normalization, deep equality, and status derivation.
// No React, no fetch — safe to unit test.

export const STATUS_NEW = "new";
export const STATUS_UPDATED = "updated";
export const STATUS_DELETED = "deleted";
export const STATUS_NO_CHANGE = "no-change";

export const STATUS_LABEL = {
  [STATUS_NEW]: "New",
  [STATUS_UPDATED]: "Updated",
  [STATUS_DELETED]: "Deleted",
  [STATUS_NO_CHANGE]: "No Change",
};

export const STATUS_ROW_CLASS = {
  [STATUS_NEW]: "bg-emerald-50 hover:bg-emerald-100",
  [STATUS_UPDATED]: "bg-amber-50 hover:bg-amber-100",
  [STATUS_DELETED]: "bg-rose-50 hover:bg-rose-100",
  [STATUS_NO_CHANGE]: "bg-slate-50 hover:bg-slate-100",
};

export function normalizeText(value) {
  if (value == null) return "";
  let s = String(value);
  s = s.normalize("NFKC");
  s = s
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—―−]/g, "-")
    .replace(/[   ]/g, " ");
  s = s.replace(/<[^>]*>/g, "");
  s = s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");
  s = s.replace(/\\\//g, "/").replace(/\\"/g, '"').replace(/\\'/g, "'");
  s = s.replace(/[*_~`#>•·●◦▪■□◆◇★☆♦♣♥♠※]/g, "");
  s = s.replace(/[\p{Extended_Pictographic}]/gu, "");
  s = s.replace(/[\p{P}\p{S}]/gu, "");
  s = s.replace(/\s+/g, " ").trim();
  return s.toLowerCase();
}

export function isEmptyish(value) {
  if (value == null) return true;
  if (typeof value === "string") return normalizeText(value) === "";
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value).length === 0;
  return false;
}

function deepNormalize(value) {
  if (isEmptyish(value)) return null;
  if (typeof value === "string") return normalizeText(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const items = value.map(deepNormalize).filter((v) => v !== null);
    if (items.length === 0) return null;
    const sorted = items
      .map((v) => JSON.stringify(v))
      .sort()
      .map((s) => JSON.parse(s));
    return sorted;
  }
  if (typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      const norm = deepNormalize(value[key]);
      if (norm !== null) out[key] = norm;
    }
    return Object.keys(out).length === 0 ? null : out;
  }
  return value;
}

// modifiedAt is a timestamp; ignore it entirely when comparing content
const IGNORED_DISH_KEYS = new Set(["modifiedAt"]);

function canonicalKey(value) {
  return JSON.stringify(deepNormalize(value));
}

export function diffDishFields(beforeDish, afterDish) {
  const keys = new Set([...Object.keys(beforeDish ?? {}), ...Object.keys(afterDish ?? {})]);
  const changed = [];
  let allRegex = true;
  for (const key of keys) {
    if (IGNORED_DISH_KEYS.has(key)) continue;
    const b = beforeDish?.[key];
    const a = afterDish?.[key];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    const regexEquivalent = canonicalKey(b) === canonicalKey(a);
    if (!regexEquivalent) allRegex = false;
    changed.push({ field: key, before: b, after: a, regexEquivalent });
  }
  return { changed, allRegex: allRegex && changed.length > 0 };
}

export function computeDishStatus(beforeDish, afterDish) {
  const hasBefore = beforeDish != null;
  const hasAfter = afterDish != null;
  if (!hasBefore && hasAfter) return STATUS_NEW;
  if (hasBefore && !hasAfter) return STATUS_DELETED;
  if (!hasBefore && !hasAfter) return STATUS_NO_CHANGE;

  const beforeMod = beforeDish.modifiedAt ?? null;
  const afterMod = afterDish.modifiedAt ?? null;
  if (beforeMod === afterMod) return STATUS_NO_CHANGE;

  const { changed } = diffDishFields(beforeDish, afterDish);
  if (changed.length === 0) return STATUS_NO_CHANGE;
  return STATUS_UPDATED;
}

export function hasExactFieldChange(beforeDish, afterDish, field) {
  const beforeVal = beforeDish?.[field];
  const afterVal = afterDish?.[field];
  return JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
}

export function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function detectRegexCategories(before, after) {
  const a = before == null ? "" : typeof before === "string" ? before : JSON.stringify(before);
  const b = after == null ? "" : typeof after === "string" ? after : JSON.stringify(after);
  const tags = [];

  if (a !== b && a.replace(/\s+/g, " ").trim() !== b.replace(/\s+/g, " ").trim()) {
    // whitespace will also be flagged; check separately below
  }
  if (/\s{2,}|^\s|\s$|\t/.test(a) !== /\s{2,}|^\s|\s$|\t/.test(b) || a.replace(/\s+/g, "") === b.replace(/\s+/g, "") && a !== b) {
    tags.push("Whitespace");
  }
  if (/[\r\n]/.test(a) !== /[\r\n]/.test(b)) tags.push("Line breaks");
  if (a.toLowerCase() === b.toLowerCase() && a !== b) tags.push("Capitalization");
  if (a.replace(/[\p{P}\p{S}]/gu, "") === b.replace(/[\p{P}\p{S}]/gu, "") && a !== b) tags.push("Punctuation/Symbols");
  if (a.normalize("NFKC") === b.normalize("NFKC") && a !== b) tags.push("Unicode");
  if (/<[^>]+>|&[a-z]+;/i.test(a) !== /<[^>]+>|&[a-z]+;/i.test(b)) tags.push("HTML/Markup");
  if (/\\["/'\\]/.test(a) !== /\\["/'\\]/.test(b)) tags.push("Escaping");
  if (Array.isArray(before) && Array.isArray(after) && before.length === after.length) {
    const sa = [...before].map((v) => JSON.stringify(v)).sort().join("|");
    const sb = [...after].map((v) => JSON.stringify(v)).sort().join("|");
    if (sa === sb && JSON.stringify(before) !== JSON.stringify(after)) tags.push("Reordered");
  }
  if (isEmptyish(before) && isEmptyish(after) && JSON.stringify(before) !== JSON.stringify(after)) {
    tags.push("Null/empty equivalence");
  }

  return [...new Set(tags)];
}

// Word-level diff using longest common subsequence.
function tokenize(str) {
  return str.match(/\s+|\S+/g) ?? [];
}

export function diffTokens(beforeStr, afterStr) {
  const a = tokenize(beforeStr);
  const b = tokenize(afterStr);
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const beforeOps = [];
  const afterOps = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      beforeOps.push({ type: "same", text: a[i] });
      afterOps.push({ type: "same", text: b[j] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      beforeOps.push({ type: "del", text: a[i] });
      i++;
    } else {
      afterOps.push({ type: "ins", text: b[j] });
      j++;
    }
  }
  while (i < m) { beforeOps.push({ type: "del", text: a[i++] }); }
  while (j < n) { afterOps.push({ type: "ins", text: b[j++] }); }

  const merge = (ops) => {
    const out = [];
    for (const op of ops) {
      const last = out[out.length - 1];
      if (last && last.type === op.type) last.text += op.text;
      else out.push({ ...op });
    }
    return out;
  };
  return { before: merge(beforeOps), after: merge(afterOps) };
}

export function formatDiffValue(v) {
  if (v == null) return "∅ (null)";
  if (v === "") return '"" (empty)';
  if (Array.isArray(v) || typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}
