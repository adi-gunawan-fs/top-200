import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Loader2, Search, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { Modal } from "./ui/Modal";
import { fetchDishCurationLinks } from "../lib/dbFetch";

const API_BASE = "http://localhost:3000";
const PAGE_SIZE = 50;

const STATUS_NEW = "new";
const STATUS_UPDATED = "updated";
const STATUS_REGEX = "regex";
const STATUS_DELETED = "deleted";
const STATUS_NO_CHANGE = "no-change";

const STATUS_LABEL = {
  [STATUS_NEW]: "New",
  [STATUS_UPDATED]: "Updated",
  [STATUS_REGEX]: "Regex Changes",
  [STATUS_DELETED]: "Deleted",
  [STATUS_NO_CHANGE]: "No Change",
};

const STATUS_ROW_CLASS = {
  [STATUS_NEW]: "bg-emerald-50 hover:bg-emerald-100",
  [STATUS_UPDATED]: "bg-amber-50 hover:bg-amber-100",
  [STATUS_REGEX]: "bg-blue-50 hover:bg-blue-100",
  [STATUS_DELETED]: "bg-rose-50 hover:bg-rose-100",
  [STATUS_NO_CHANGE]: "bg-slate-50 hover:bg-slate-100",
};

function buildMenuTitleChain(menuTitleId, menuTitlesById) {
  const chain = [];
  let current = menuTitlesById.get(menuTitleId);
  while (current) {
    chain.unshift({ title: current.title ?? null, description: current.description ?? null });
    current = current.parentId != null ? menuTitlesById.get(current.parentId) : null;
  }
  return chain;
}

async function fetchLatestAutoeatDishes(brandId) {
  const res = await fetch(`${API_BASE}/api/brand-latest-message?brandId=${brandId}`);
  if (!res.ok) throw new Error(`Failed to fetch dishes: ${res.statusText}`);
  const { rows } = await res.json();

  // Returns { autoeatDishId -> menuAutoeatId } and { autoeatDishId -> menuTitleChain }
  const dishMap = new Map();
  const menuTitleChains = new Map();
  for (const row of rows) {
    const message = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
    const menuAutoeatId = message?.menu?.id;

    const menuTitlesById = new Map((message?.menuTitles ?? []).map((mt) => [mt.id, mt]));

    for (const dish of message?.dishes ?? []) {
      if (dish.id != null) {
        dishMap.set(dish.id, menuAutoeatId);
        if (dish.menuTitleId != null) {
          menuTitleChains.set(dish.id, buildMenuTitleChain(dish.menuTitleId, menuTitlesById));
        }
      }
    }
  }
  return { dishMap, menuTitleChains };
}

async function fetchDishDetails(autoeatDishIds) {
  const res = await fetch(`${API_BASE}/api/brand-dish-details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autoeatDishIds }),
  });
  if (!res.ok) throw new Error(`Failed to fetch dish details: ${res.statusText}`);
  const { rows } = await res.json();
  return rows;
}

async function fetchBrandMessageTimestamps(brandId) {
  const res = await fetch(`${API_BASE}/api/brand-message-timestamps?brandId=${brandId}`);
  if (!res.ok) throw new Error(`Failed to fetch timestamps: ${res.statusText}`);
  const { rows } = await res.json();
  return rows;
}

async function fetchBrandSnapshotAsOf(brandId, asOf) {
  const res = await fetch(`${API_BASE}/api/brand-message-asof?brandId=${brandId}&asOf=${encodeURIComponent(asOf)}`);
  if (!res.ok) throw new Error(`Failed to fetch snapshot: ${res.statusText}`);
  const { rows } = await res.json();

  const dishMap = new Map();
  const menuTitleChains = new Map();
  const dishById = new Map();
  for (const row of rows) {
    const message = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
    const menuAutoeatId = message?.menu?.id;
    const menuTitlesById = new Map((message?.menuTitles ?? []).map((mt) => [mt.id, mt]));

    for (const dish of message?.dishes ?? []) {
      if (dish.id != null) {
        dishMap.set(dish.id, menuAutoeatId);
        dishById.set(dish.id, dish);
        if (dish.menuTitleId != null) {
          menuTitleChains.set(dish.id, buildMenuTitleChain(dish.menuTitleId, menuTitlesById));
        }
      }
    }
  }
  return { dishMap, menuTitleChains, dishById };
}

function normalizeText(value) {
  if (value == null) return "";
  let s = String(value);
  // Unicode normalization (NFKC folds compatibility forms)
  s = s.normalize("NFKC");
  // Smart quotes / dashes / NBSP → ASCII equivalents
  s = s
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[–—―−]/g, "-")
    .replace(/[   ]/g, " ");
  // Strip HTML tags
  s = s.replace(/<[^>]*>/g, "");
  // Decode common HTML entities
  s = s
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");
  // Unescape JSON-style escapes
  s = s.replace(/\\\//g, "/").replace(/\\"/g, '"').replace(/\\'/g, "'");
  // Strip decorative / formatting symbols and emoji
  s = s.replace(/[*_~`#>•·●◦▪■□◆◇★☆♦♣♥♠※]/g, "");
  s = s.replace(/[\p{Extended_Pictographic}]/gu, "");
  // Strip all punctuation
  s = s.replace(/[\p{P}\p{S}]/gu, "");
  // Collapse all whitespace (incl. \r, \n, \t) into a single space
  s = s.replace(/\s+/g, " ").trim();
  // Lowercase
  return s.toLowerCase();
}

function isEmptyish(value) {
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
    // Order-insensitive comparison: sort by canonical JSON
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

function diffDishFields(beforeDish, afterDish) {
  const keys = new Set([
    ...Object.keys(beforeDish ?? {}),
    ...Object.keys(afterDish ?? {}),
  ]);
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

function computeDishStatus(beforeDish, afterDish) {
  const hasBefore = beforeDish != null;
  const hasAfter = afterDish != null;
  if (!hasBefore && hasAfter) return STATUS_NEW;
  if (hasBefore && !hasAfter) return STATUS_DELETED;
  if (!hasBefore && !hasAfter) return STATUS_NO_CHANGE;

  const beforeMod = beforeDish.modifiedAt ?? null;
  const afterMod = afterDish.modifiedAt ?? null;
  if (beforeMod === afterMod) return STATUS_NO_CHANGE;

  const { changed, allRegex } = diffDishFields(beforeDish, afterDish);
  if (changed.length === 0) return STATUS_NO_CHANGE;
  return allRegex ? STATUS_REGEX : STATUS_UPDATED;
}

function formatTimestamp(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function str(v) {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length === 0 ? "—" : JSON.stringify(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function curationListToText(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items.map((item) => item.name).join(", ");
}

function escapeCsv(value) {
  const s = value == null ? "" : (typeof value === "object" ? JSON.stringify(value) : String(value));
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportToCsv(dishes, curationLinks, brandName) {
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
      "", "",
      "", "",
      "", "",
      "", "",
      "", "",
    ].join(",");
  });

  const csv = [headers.map(escapeCsv).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${brandName.replace(/[^\w-]+/g, "_")}_dishes.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function MenuTitleChain({ chain }) {
  if (!Array.isArray(chain) || chain.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {chain.map((mt, idx) => (
        <div key={idx}>
          <div className="font-semibold text-slate-800">{mt.title ?? "—"}</div>
          {mt.description && <div className="text-slate-500 text-[11px]">{mt.description}</div>}
        </div>
      ))}
    </div>
  );
}

function CurationList({ items }) {
  if (!Array.isArray(items) || items.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <span>
      {items.map((item, idx) => (
        <span key={idx}>
          {idx > 0 && <span className="text-slate-400">, </span>}
          <span className={item.isCurationEnabled === false ? "text-slate-300" : ""}>{item.name}</span>
        </span>
      ))}
    </span>
  );
}

function detectRegexCategories(before, after) {
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

function formatDiffValue(v) {
  if (v == null) return "∅ (null)";
  if (v === "") return '"" (empty)';
  if (Array.isArray(v) || typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

// Word-level diff using longest common subsequence.
// Splits by whitespace boundaries but keeps separators as their own tokens
// so whitespace differences are visible.
function tokenize(str) {
  return str.match(/\s+|\S+/g) ?? [];
}

function diffTokens(beforeStr, afterStr) {
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

  // Merge consecutive ops of the same type
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

function renderTokenSegment(seg, side) {
  if (seg.type === "same") return seg.text;
  // Make whitespace-only diffs visible with a subtle background
  const isWhitespace = /^\s+$/.test(seg.text);
  const baseClass = side === "before"
    ? "bg-rose-200 text-rose-900"
    : "bg-emerald-200 text-emerald-900";
  const cls = isWhitespace ? `${baseClass} rounded` : `${baseClass} rounded px-0.5`;
  const display = isWhitespace ? seg.text.replace(/ /g, "·").replace(/\t/g, "→").replace(/\n/g, "↵\n") : seg.text;
  return <mark className={cls}>{display}</mark>;
}

function HighlightedDiff({ before, after, side }) {
  const beforeStr = formatDiffValue(before);
  const afterStr = formatDiffValue(after);
  const { before: beforeOps, after: afterOps } = diffTokens(beforeStr, afterStr);
  const ops = side === "before" ? beforeOps : afterOps;
  return (
    <pre className="whitespace-pre-wrap break-words text-[11px] text-slate-700">
      {ops.map((seg, idx) => (
        <span key={idx}>{renderTokenSegment(seg, side)}</span>
      ))}
    </pre>
  );
}

function RegexDiffModal({ open, onClose, dish, beforeDish, afterDish }) {
  if (!open || !beforeDish || !afterDish) return null;
  const { changed } = diffDishFields(beforeDish, afterDish);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={`Regex Changes — ${dish?.dishName ?? dish?.dishId ?? ""}`}
      subtitle={`${changed.length} field${changed.length === 1 ? "" : "s"} changed (formatting only)`}
    >
      <div className="flex flex-col gap-3 p-4">
        {changed.length === 0 ? (
          <p className="text-xs text-slate-500">No field-level differences detected.</p>
        ) : (
          changed.map(({ field, before, after }) => {
            const categories = detectRegexCategories(before, after);
            return (
              <div key={field} className="rounded-md border border-slate-200 bg-white">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="text-xs font-semibold text-slate-800">{field}</span>
                  {categories.map((tag) => (
                    <span key={tag} className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-2 divide-x divide-slate-100">
                  <div className="p-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600">Before</p>
                    <HighlightedDiff before={before} after={after} side="before" />
                  </div>
                  <div className="p-3">
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">After</p>
                    <HighlightedDiff before={before} after={after} side="after" />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}

function LargeBrandDishPage({ brand, viewMode = "latest", onBack }) {
  const isCompare = viewMode === "compare";

  const [dishes, setDishes] = useState([]);
  const [statusByDishId, setStatusByDishId] = useState({});
  const [snapshotPair, setSnapshotPair] = useState({ before: null, after: null });
  const [regexModalDishId, setRegexModalDishId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [curationLinks, setCurationLinks] = useState({});
  const [exportPrompt, setExportPrompt] = useState(false);
  const [exportLimit, setExportLimit] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [timestamps, setTimestamps] = useState([]);
  const [beforeAt, setBeforeAt] = useState("");
  const [afterAt, setAfterAt] = useState("");

  useEffect(() => {
    if (!isCompare) return;
    setLoading(true);
    setError("");
    fetchBrandMessageTimestamps(brand.brandId)
      .then((rows) => {
        setTimestamps(rows);
        const distinct = [...new Set(rows.map((r) => r.createdAt))].sort((a, b) => b.localeCompare(a));
        if (distinct.length >= 2) {
          setAfterAt(distinct[0]);
          setBeforeAt(distinct[1]);
        } else if (distinct.length === 1) {
          setAfterAt(distinct[0]);
          setBeforeAt(distinct[0]);
        }
      })
      .catch((err) => setError(err.message ?? "Failed to load timestamps."))
      .finally(() => setLoading(false));
  }, [brand.brandId, isCompare]);

  useEffect(() => {
    if (isCompare) return;
    setLoading(true);
    setError("");

    fetchLatestAutoeatDishes(brand.brandId)
      .then(async ({ dishMap, menuTitleChains }) => {
        if (dishMap.size === 0) {
          setDishes([]);
          return;
        }

        const autoeatIds = [...dishMap.keys()];
        const details = await fetchDishDetails(autoeatIds);

        const enriched = details.map((d) => ({
          ...d,
          menuAutoeatId: dishMap.get(d.autoeatDishId),
          menuTitleChain: menuTitleChains.get(d.autoeatDishId) ?? [],
        }));
        setDishes(enriched);

        const pairs = enriched.map((d) => ({
          dishId: String(d.autoeatDishId),
          menuAutoeatId: String(d.menuAutoeatId),
        }));
        fetchDishCurationLinks(pairs).then(setCurationLinks).catch(() => {});
      })
      .catch((err) => setError(err.message ?? "Failed to load dishes."))
      .finally(() => setLoading(false));
  }, [brand.brandId, isCompare]);

  useEffect(() => {
    if (!isCompare || !beforeAt || !afterAt) return;
    setLoading(true);
    setError("");
    setStatusByDishId({});

    Promise.all([
      fetchBrandSnapshotAsOf(brand.brandId, beforeAt),
      fetchBrandSnapshotAsOf(brand.brandId, afterAt),
    ])
      .then(async ([before, after]) => {
        const allDishIds = new Set([...before.dishById.keys(), ...after.dishById.keys()]);

        const statusMap = {};
        for (const dishId of allDishIds) {
          statusMap[dishId] = computeDishStatus(
            before.dishById.get(dishId) ?? null,
            after.dishById.get(dishId) ?? null,
          );
        }
        setStatusByDishId(statusMap);
        setSnapshotPair({ before: before.dishById, after: after.dishById });

        if (allDishIds.size === 0) {
          setDishes([]);
          return;
        }

        const dishMap = new Map(after.dishMap);
        const menuTitleChains = new Map(after.menuTitleChains);
        for (const dishId of allDishIds) {
          if (!dishMap.has(dishId) && before.dishMap.has(dishId)) {
            dishMap.set(dishId, before.dishMap.get(dishId));
          }
          if (!menuTitleChains.has(dishId) && before.menuTitleChains.has(dishId)) {
            menuTitleChains.set(dishId, before.menuTitleChains.get(dishId));
          }
        }

        const details = await fetchDishDetails([...allDishIds]);
        const enriched = details.map((d) => ({
          ...d,
          menuAutoeatId: dishMap.get(d.autoeatDishId),
          menuTitleChain: menuTitleChains.get(d.autoeatDishId) ?? [],
        }));
        setDishes(enriched);

        const pairs = enriched
          .filter((d) => d.menuAutoeatId != null)
          .map((d) => ({ dishId: String(d.autoeatDishId), menuAutoeatId: String(d.menuAutoeatId) }));
        fetchDishCurationLinks(pairs).then(setCurationLinks).catch(() => {});
      })
      .catch((err) => setError(err.message ?? "Failed to load comparison."))
      .finally(() => setLoading(false));
  }, [brand.brandId, isCompare, beforeAt, afterAt]);

  useEffect(() => { setPage(0); }, [search, statusFilter]);

  const visibleDishes = useMemo(() => {
    let list = dishes;
    if (isCompare && statusFilter !== "all") {
      list = list.filter((d) => statusByDishId[d.autoeatDishId] === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((d) => (d.dishName ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [dishes, search, isCompare, statusFilter, statusByDishId]);

  const statusCounts = useMemo(() => {
    if (!isCompare) return null;
    const counts = { [STATUS_NEW]: 0, [STATUS_UPDATED]: 0, [STATUS_REGEX]: 0, [STATUS_DELETED]: 0, [STATUS_NO_CHANGE]: 0 };
    for (const d of dishes) {
      const s = statusByDishId[d.autoeatDishId];
      if (s && counts[s] !== undefined) counts[s] += 1;
    }
    return counts;
  }, [dishes, isCompare, statusByDishId]);

  const totalPages = Math.ceil(visibleDishes.length / PAGE_SIZE);
  const paginated = visibleDishes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading dishes for {brand.brandName}…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col gap-4">
        <Button onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" />Back</Button>
        <EmptyState message={error} tone="danger" />
      </section>
    );
  }

  const distinctTimestamps = [...new Set(timestamps.map((r) => r.createdAt))].sort((a, b) => b.localeCompare(a));

  const regexModalDish = regexModalDishId != null
    ? dishes.find((d) => d.autoeatDishId === regexModalDishId) ?? null
    : null;

  return (
    <>
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" />Back</Button>
          <div>
            <h2 className="text-sm font-semibold text-slate-700">{brand.brandName}</h2>
            <p className="text-[11px] text-slate-400">
              {isCompare ? `Compare · ${visibleDishes.length} dishes` : `Latest snapshot · ${visibleDishes.length} dishes`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search dish name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            />
          </div>
          {exportPrompt ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                placeholder={`Limit (max ${visibleDishes.length})`}
                value={exportLimit}
                onChange={(e) => setExportLimit(e.target.value)}
                className="w-36 rounded-md border border-slate-300 bg-white py-1.5 px-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
              />
              <Button
                variant="tonal"
                tone="info"
                onClick={() => {
                  const limit = exportLimit ? Math.min(parseInt(exportLimit, 10), visibleDishes.length) : visibleDishes.length;
                  exportToCsv(visibleDishes.slice(0, limit), curationLinks, brand.brandName);
                  setExportPrompt(false);
                  setExportLimit("");
                }}
              >
                <Download className="h-3.5 w-3.5" />
                {exportLimit ? `Export ${Math.min(parseInt(exportLimit, 10) || 0, visibleDishes.length)} rows` : `Export all ${visibleDishes.length}`}
              </Button>
              <button
                type="button"
                onClick={() => { setExportPrompt(false); setExportLimit(""); }}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Cancel
              </button>
            </div>
          ) : (
            <Button
              variant="tonal"
              tone="info"
              onClick={() => setExportPrompt(true)}
              disabled={visibleDishes.length === 0}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
          )}
        </div>
      </div>

      {isCompare && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">Before</span>
            <select
              value={beforeAt}
              onChange={(e) => setBeforeAt(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {distinctTimestamps.map((ts) => (
                <option key={ts} value={ts}>{formatTimestamp(ts)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">After</span>
            <select
              value={afterAt}
              onChange={(e) => setAfterAt(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {distinctTimestamps.map((ts) => (
                <option key={ts} value={ts}>{formatTimestamp(ts)}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-medium">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All</option>
              <option value={STATUS_NEW}>New {statusCounts ? `(${statusCounts[STATUS_NEW]})` : ""}</option>
              <option value={STATUS_UPDATED}>Updated {statusCounts ? `(${statusCounts[STATUS_UPDATED]})` : ""}</option>
              <option value={STATUS_REGEX}>Regex Changes {statusCounts ? `(${statusCounts[STATUS_REGEX]})` : ""}</option>
              <option value={STATUS_DELETED}>Deleted {statusCounts ? `(${statusCounts[STATUS_DELETED]})` : ""}</option>
              <option value={STATUS_NO_CHANGE}>No Change {statusCounts ? `(${statusCounts[STATUS_NO_CHANGE]})` : ""}</option>
            </select>
          </label>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Dish ID</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Dish Name</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Description</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Menu Title</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Diet Descriptors</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Addon Descriptors</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Allergen Descriptors</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Dish Type</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Course Type</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Main Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Additional Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Choice Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Diets</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Allergens</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-4 py-6 text-center text-slate-400">No dishes found.</td>
                </tr>
              ) : (
                paginated.map((dish) => {
                  const link = curationLinks[String(dish.autoeatDishId)] ?? null;
                  const status = statusByDishId[dish.autoeatDishId];
                  const rowHighlight = isCompare && status ? STATUS_ROW_CLASS[status] ?? "" : "";
                  const isRegexRow = status === STATUS_REGEX;
                  return (
                    <tr
                      key={dish.dishId}
                      className={`border-b border-slate-100 last:border-b-0 text-slate-700 align-top ${rowHighlight} ${isRegexRow ? "cursor-pointer" : ""}`}
                      onClick={isRegexRow ? () => setRegexModalDishId(dish.autoeatDishId) : undefined}
                      title={isRegexRow ? "Click to view regex changes" : undefined}
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                        {link ? (
                          <a
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-blue-600 hover:underline"
                          >
                            {dish.dishId}
                          </a>
                        ) : (
                          dish.dishId
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">{str(dish.dishName)}</td>
                      <td className="px-3 py-2 max-w-xs text-slate-600">{str(dish.dishDescription)}</td>
                      <td className="px-3 py-2 min-w-[160px]"><MenuTitleChain chain={dish.menuTitleChain} /></td>
                      <td className="px-3 py-2">{str(dish.ingredients)}</td>
                      <td className="px-3 py-2">{str(dish.dietDescriptors)}</td>
                      <td className="px-3 py-2">{str(dish.addonDescriptors)}</td>
                      <td className="px-3 py-2">{str(dish.allergenDescriptors)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{str(dish.dishTypeName)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{str(dish.courseTypeName)}</td>
                      <td className="px-3 py-2"><CurationList items={dish.mainIngredients} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.additionalIngredients} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.choiceIngredients} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.diets} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.allergens} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2">
            <p className="text-[11px] text-slate-400">Page {page + 1} of {totalPages} · {visibleDishes.length} dishes</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
    <RegexDiffModal
      open={regexModalDishId != null}
      onClose={() => setRegexModalDishId(null)}
      dish={regexModalDish}
      beforeDish={regexModalDishId != null ? snapshotPair.before?.get(regexModalDishId) ?? null : null}
      afterDish={regexModalDishId != null ? snapshotPair.after?.get(regexModalDishId) ?? null : null}
    />
    </>
  );
}

export default LargeBrandDishPage;
