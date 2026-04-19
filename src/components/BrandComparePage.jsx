import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CircleHelp, Download } from "lucide-react";
import { CHANGE_TYPE_RULES, CHALLENGE_RULES, compareMessages } from "../utils/compareMessages";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const normalized = normalizeDateInput(value);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.valueOf())) {
    return value;
  }

  return parsed.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace(",", "");
}

function normalizeDateInput(value) {
  return String(value)
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T")
    .replace(/\s+([+-]\d{2}(?::?\d{2})?)$/, "$1")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
    .replace(/([+-]\d{2})$/, "$1:00");
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const normalized = normalizeDateInput(value);
  const timestamp = Date.parse(normalized);

  return Number.isNaN(timestamp) ? null : timestamp;
}

function statusStyles(status) {
  if (status === "new") {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (status === "updated") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (status === "deleted") {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  return "bg-slate-50 text-slate-700 border-slate-200";
}

function rowStyles(status) {
  if (status === "new") {
    return "bg-emerald-50/40";
  }
  if (status === "updated") {
    return "bg-amber-50/50";
  }
  if (status === "deleted") {
    return "bg-rose-50/40";
  }
  return "bg-white";
}

function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyles(status)}`}>
      {status}
    </span>
  );
}

function CurationPill({ required }) {
  if (required) {
    return (
      <span className="inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
        Require Curation
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
      No Curation
    </span>
  );
}

function formatValue(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function isStructuredValue(value) {
  return value !== null && typeof value === "object";
}

function renderDiffValue(value, toneClass) {
  if (value === null || value === undefined) {
    return <p className={`text-[11px] break-words ${toneClass}`}>&nbsp;</p>;
  }

  if (isStructuredValue(value)) {
    return (
      <pre className={`overflow-x-auto whitespace-pre-wrap break-words bg-transparent p-0 text-[11px] ${toneClass}`}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <p className={`text-[11px] break-words ${toneClass}`}>{formatValue(value)}</p>;
}

function RecordSelect({ label, value, onChange, records, getOptionDisableReason }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-700">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none"
      >
        <option value="">Select a record</option>
        {records.map((record) => {
          const key = String(record.id);
          const disableReason = getOptionDisableReason ? getOptionDisableReason(record) : null;
          const disabled = Boolean(disableReason);
          const optionLabel = `${formatDate(record.updatedAt)} | #${record.id}${disableReason ? ` (${disableReason})` : ""}`;
          return (
            <option
              key={key}
              value={key}
              disabled={disabled}
              className={disabled ? "text-slate-400" : ""}
            >
              {optionLabel}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function ChangeTypeBadge({ type }) {
  if (type === "Relevant") {
    return <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Relevant</span>;
  }
  return <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Not Relevant</span>;
}

function ChallengeBadge({ challenge }) {
  if (challenge === "Hard") {
    return <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Hard</span>;
  }
  if (challenge === "Easy") {
    return <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">Easy</span>;
  }
  return <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Not Relevant</span>;
}

function RulesTable({ itemType }) {
  const typeRules = CHANGE_TYPE_RULES[itemType] ?? {};
  const challengeRules = CHALLENGE_RULES[itemType] ?? {};
  const schemas = Array.from(new Set([...Object.keys(typeRules), ...Object.keys(challengeRules)]));

  return (
    <div className="rounded border border-slate-200 bg-white p-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Rules</p>
      <div className="overflow-x-auto">
        <table className="min-w-[340px] text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-1 py-1">Schema</th>
              <th className="px-1 py-1">Type</th>
              <th className="px-1 py-1">Challenge</th>
            </tr>
          </thead>
          <tbody>
            {schemas.map((schema) => (
              <tr key={schema} className="border-b border-slate-100 last:border-b-0">
                <td className="px-1 py-1 font-medium text-slate-700">{schema}</td>
                <td className="px-1 py-1">
                  <ChangeTypeBadge type={typeRules[schema]} />
                </td>
                <td className="px-1 py-1">
                  <ChallengeBadge challenge={challengeRules[schema]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-600">
        <p>Challenge label rule:</p>
        <p>Only shown when Require Curation is true.</p>
        <p>If changed fields include Hard, label Hard. Else if Easy exists, label Easy.</p>
        <p>Parent rule: if a Menu Title is Hard, all its curation-required dishes are Hard.</p>
      </div>
    </div>
  );
}

function ColorCodeTable() {
  return (
    <div className="rounded border border-slate-200 bg-white p-2">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Color Code</p>
      <div className="overflow-x-auto">
        <table className="min-w-[280px] text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-1 py-1">Status</th>
              <th className="px-1 py-1">Row Highlight</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100">
              <td className="px-1 py-1"><span className="font-medium text-slate-700">New</span></td>
              <td className="px-1 py-1">
                <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Light Green
                </span>
              </td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-1 py-1"><span className="font-medium text-slate-700">Updated</span></td>
              <td className="px-1 py-1">
                <span className="inline-flex items-center rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  Light Yellow
                </span>
              </td>
            </tr>
            <tr className="border-b border-slate-100">
              <td className="px-1 py-1"><span className="font-medium text-slate-700">Deleted</span></td>
              <td className="px-1 py-1">
                <span className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                  Light Red
                </span>
              </td>
            </tr>
            <tr>
              <td className="px-1 py-1"><span className="font-medium text-slate-700">Unchanged</span></td>
              <td className="px-1 py-1">
                <span className="inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                  White
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChangeTypeCounts({ counts }) {
  const safeCounts = counts ?? { Relevant: 0, "Not Relevant": 0 };

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
        Relevant: {safeCounts.Relevant ?? 0}
      </span>
      <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
        Not Relevant: {safeCounts["Not Relevant"] ?? 0}
      </span>
    </div>
  );
}

function RulesTooltip({ itemType, label = "?", align = "center", content = null }) {
  const isIcon = label === "?";
  const panelPositionClass = align === "left"
    ? "left-0 translate-x-0"
    : "left-1/2 -translate-x-1/2";

  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        className={
          isIcon
            ? "inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            : "inline-flex items-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        }
        aria-label="Show field type rules"
      >
        {isIcon ? <CircleHelp className="h-3.5 w-3.5" /> : label}
      </button>
      <div className={`pointer-events-none invisible absolute top-[calc(100%+6px)] z-50 w-[min(90vw,380px)] opacity-0 transition-all group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 ${panelPositionClass}`}>
        {content ?? <RulesTable itemType={itemType} />}
      </div>
    </div>
  );
}

function SummaryTriple({ label, deleted, added, updated }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
      <p className="text-slate-500">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">
          Deleted: {deleted}
        </span>
        <span className="inline-flex items-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">
          New: {added}
        </span>
        <span className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-700">
          Updated: {updated}
        </span>
      </div>
    </div>
  );
}

function SummarySingle({ label, value }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
      <p className="text-slate-500">{label}</p>
      <p className="mt-1 text-base font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  const escaped = text.replace(/"/g, "\"\"");
  return `"${escaped}"`;
}

function serializeJsonb(value) {
  if (value === undefined || value === null) {
    return "";
  }

  try {
    return JSON.stringify(value ?? null);
  } catch {
    return JSON.stringify(String(value));
  }
}

function getMenuTitleParentId(item) {
  const value = item?.after?.parentId ?? item?.before?.parentId;
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return String(value);
}

function sortById(a, b) {
  return Number(a.id) - Number(b.id);
}

function buildHierarchy(menuTitleRows, dishRows) {
  const nodesById = new Map();

  menuTitleRows.forEach((item) => {
    nodesById.set(String(item.id), {
      id: String(item.id),
      item,
      children: [],
      dishes: [],
    });
  });

  const roots = [];

  nodesById.forEach((node) => {
    const parentId = getMenuTitleParentId(node.item);
    const parent = nodesById.get(parentId);

    if (parent) {
      parent.children.push(node);
      return;
    }

    roots.push(node);
  });

  const orphanDishes = [];

  dishRows.forEach((dish) => {
    const menuTitleId = String(dish.menuTitleId ?? "");
    const node = nodesById.get(menuTitleId);
    if (!node) {
      orphanDishes.push(dish);
      return;
    }
    node.dishes.push(dish);
  });

  const sortNode = (node) => {
    node.children.sort((a, b) => sortById(a.item, b.item));
    node.dishes.sort(sortById);
    node.children.forEach(sortNode);
  };

  roots.sort((a, b) => sortById(a.item, b.item));
  roots.forEach(sortNode);
  orphanDishes.sort(sortById);

  return { roots, orphanDishes };
}

function HierarchyNode({ node, level = 0 }) {
  const titleItem = node.item;
  const hasNested = node.children.length > 0 || node.dishes.length > 0;
  const wrapperClass = level === 0
    ? "rounded-md border border-slate-200 bg-white"
    : "rounded-md border border-slate-200 bg-slate-50";

  return (
    <details open className={wrapperClass}>
      <summary className="cursor-pointer list-none px-3 py-2 hover:bg-slate-100/70">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusPill status={titleItem.status} />
          <span className="font-semibold text-slate-900">
            {level === 0 ? "Parent Menu Title" : "Child Menu Title"}: {titleItem.title || "-"}
          </span>
          <span className="text-slate-500">#{titleItem.id}</span>
          <CurationPill required={Boolean(titleItem.requiresCuration)} />
          <span className="text-slate-500">
            {node.children.length} child title{node.children.length !== 1 ? "s" : ""}, {node.dishes.length} dish{node.dishes.length !== 1 ? "es" : ""}
          </span>
        </div>
      </summary>

      {hasNested ? (
        <div className="space-y-2 border-t border-slate-200 px-3 py-2">
          {node.children.map((child) => (
            <HierarchyNode key={child.id} node={child} level={level + 1} />
          ))}

          {node.dishes.length > 0 ? (
            <div className="rounded-md border border-slate-200 bg-white p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Dishes</p>
              <div className="mt-2 space-y-1.5">
                {node.dishes.map((dish) => (
                  <div key={dish.id} className={`rounded border border-slate-200 p-2 text-xs ${rowStyles(dish.status)}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={dish.status} />
                      <span className="font-medium text-slate-900">{dish.name || "-"}</span>
                      <span className="text-slate-500">#{dish.id}</span>
                      <CurationPill required={Boolean(dish.requiresCuration)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">No child menu title or dish changes.</div>
      )}
    </details>
  );
}

function collectTitleIds(nodes, output = []) {
  nodes.forEach((node) => {
    output.push(node.id);
    collectTitleIds(node.children, output);
  });
  return output;
}

const STATUS_FILTER_OPTIONS = [
  { value: "new", label: "New" },
  { value: "updated", label: "Updated" },
  { value: "deleted", label: "Deleted" },
  { value: "unchanged", label: "No Changes" },
];

const RELEVANCY_FILTER_OPTIONS = [
  { value: "Relevant", label: "Relevant", defaultChecked: true },
  { value: "Not Relevant", label: "Not Relevant", defaultChecked: false },
];

function getFieldRelevancy(field) {
  return field?.changeType === "Relevant" ? "Relevant" : "Not Relevant";
}

function shouldHideChangedField(item, field) {
  if (item?.status !== "new") {
    return false;
  }

  if (field?.afterValue === null || field?.afterValue === undefined) {
    return true;
  }

  return Array.isArray(field?.afterValue) && field.afterValue.length === 0;
}

function filterChangedFieldsByRelevancy(changedFields, selectedRelevancies) {
  return (changedFields ?? []).filter((field) => selectedRelevancies.has(getFieldRelevancy(field)));
}

function getVisibleChangeTypeCounts(changedFields) {
  return changedFields.reduce(
    (counts, field) => {
      counts[getFieldRelevancy(field)] += 1;
      return counts;
    },
    { Relevant: 0, "Not Relevant": 0 },
  );
}

function ChangedFieldsCell({ item, selectedRelevancies }) {
  const visibleChangedFields = filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancies)
    .filter((field) => !shouldHideChangedField(item, field));

  if (!visibleChangedFields.length) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <details>
      <summary className="cursor-pointer text-blue-700 hover:text-blue-900">
        {visibleChangedFields.length} field{visibleChangedFields.length > 1 ? "s" : ""} changed
      </summary>
      <div className="mt-1 max-h-96 overflow-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="w-64" />
            <col className="w-[calc(50%-8rem)]" />
            <col className="w-[calc(50%-8rem)]" />
          </colgroup>
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-2 text-left">Field</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left">Before</th>
              <th className="border-b border-slate-200 px-3 py-2 text-left">After</th>
            </tr>
          </thead>
          <tbody>
            {visibleChangedFields.map((field) => (
              <tr key={`${item.id}-${field.path}`} className="align-top">
                <td className="border-b border-slate-200 px-3 py-2 font-semibold text-slate-700">
                  <span className="break-all">{field.path}</span>
                </td>
                <td className="border-b border-slate-200 px-3 py-2 text-slate-700">
                  <div>
                    {renderDiffValue(field.beforeValue, "text-slate-700")}
                  </div>
                </td>
                <td className="border-b border-slate-200 px-3 py-2 text-slate-700">
                  <div>
                    {renderDiffValue(field.afterValue, "text-slate-700")}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function filterHierarchyNodeByStatus(node, selectedStatuses) {
  const filteredChildren = node.children
    .map((child) => filterHierarchyNodeByStatus(child, selectedStatuses))
    .filter(Boolean);
  const filteredDishes = node.dishes.filter((dish) => selectedStatuses.has(dish.status));
  const includeSelf = selectedStatuses.has(node.item.status);
  const keepAsContext = !includeSelf && (filteredChildren.length > 0 || filteredDishes.length > 0);

  if (!includeSelf && !keepAsContext) {
    return null;
  }

  return {
    ...node,
    children: filteredChildren,
    dishes: filteredDishes,
    contextOnly: keepAsContext,
  };
}

function filterHierarchyByStatus(roots, orphanDishes, selectedStatuses) {
  return {
    roots: roots
      .map((node) => filterHierarchyNodeByStatus(node, selectedStatuses))
      .filter(Boolean),
    orphanDishes: orphanDishes.filter((dish) => selectedStatuses.has(dish.status)),
  };
}

function challengeCell(item) {
  if (!item?.requiresCuration) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        item.challenge === "Hard"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {item.challenge ?? "Easy"}
    </span>
  );
}

function UnifiedExpandableTable({ menuTitleRows, dishRows }) {
  const { roots, orphanDishes } = useMemo(
    () => buildHierarchy(menuTitleRows, dishRows),
    [menuTitleRows, dishRows],
  );
  const [selectedStatuses, setSelectedStatuses] = useState(
    () => STATUS_FILTER_OPTIONS
      .filter((option) => option.value !== "deleted" && option.value !== "unchanged")
      .map((option) => option.value),
  );
  const [selectedRelevancies, setSelectedRelevancies] = useState(
    () => RELEVANCY_FILTER_OPTIONS
      .filter((option) => option.defaultChecked)
      .map((option) => option.value),
  );
  const [expandedTitles, setExpandedTitles] = useState({});
  const selectedStatusSet = useMemo(() => new Set(selectedStatuses), [selectedStatuses]);
  const selectedRelevancySet = useMemo(() => new Set(selectedRelevancies), [selectedRelevancies]);
  const { roots: filteredRoots, orphanDishes: filteredOrphanDishes } = useMemo(
    () => filterHierarchyByStatus(roots, orphanDishes, selectedStatusSet),
    [roots, orphanDishes, selectedStatusSet],
  );

  const toggleStatus = (status) => {
    setSelectedStatuses((prev) => (
      prev.includes(status)
        ? prev.filter((item) => item !== status)
        : [...prev, status]
    ));
  };

  const toggleRelevancy = (relevancy) => {
    setSelectedRelevancies((prev) => (
      prev.includes(relevancy)
        ? prev.filter((item) => item !== relevancy)
        : [...prev, relevancy]
    ));
  };

  useEffect(() => {
    const allTitleIds = collectTitleIds(filteredRoots);
    const nextExpanded = {};
    allTitleIds.forEach((id) => {
      nextExpanded[id] = true;
    });
    setExpandedTitles(nextExpanded);
  }, [filteredRoots]);

  const rows = useMemo(() => {
    const flat = [];

    const walk = (node, depth) => {
      const hasChildren = node.children.length > 0 || node.dishes.length > 0;
      flat.push({
        key: `title-${node.id}`,
        kind: "menuTitle",
        depth,
        hasChildren,
        isExpanded: Boolean(expandedTitles[node.id]),
        item: node.item,
      });

      if (!expandedTitles[node.id]) {
        return;
      }

      node.children.forEach((child) => walk(child, depth + 1));
      node.dishes.forEach((dish) => {
        flat.push({
          key: `dish-${dish.id}`,
          kind: "dish",
          depth: depth + 1,
          hasChildren: false,
          isExpanded: false,
          item: dish,
        });
      });
    };

    filteredRoots.forEach((node) => walk(node, 0));

    filteredOrphanDishes.forEach((dish) => {
      flat.push({
        key: `orphan-dish-${dish.id}`,
        kind: "dish",
        depth: 0,
        hasChildren: false,
        isExpanded: false,
        orphan: true,
        item: dish,
      });
    });

    return flat;
  }, [expandedTitles, filteredRoots, filteredOrphanDishes]);

  const toggleTitle = (id) => {
    setExpandedTitles((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <section className="overflow-visible rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">Menu Structure</header>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2">
        <span className="text-xs font-semibold text-slate-700">Filter Status</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTER_OPTIONS.map((option) => {
            const checked = selectedStatuses.includes(option.value);
            return (
              <label key={option.value} className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={checked}
                  onChange={() => toggleStatus(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        <span className="text-xs font-semibold text-slate-700">Relevancies</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {RELEVANCY_FILTER_OPTIONS.map((option) => {
            const checked = selectedRelevancies.includes(option.value);
            return (
              <label key={option.value} className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={checked}
                  onChange={() => toggleRelevancy(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="min-w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-36" />
            <col className="w-[420px]" />
            <col className="w-52" />
            <col className="w-36" />
            <col className="w-72" />
            <col />
          </colgroup>
          <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">ID</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Title / Name</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Require Curation</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Challenge</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Type Counts</th>
              <th className="sticky top-0 z-20 bg-slate-100 px-3 py-2">Changed Fields</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-xs text-slate-500">No menu title or dish changes to render.</td>
              </tr>
            ) : (
              rows.map((row) => {
                const item = row.item;
                const label = row.kind === "menuTitle" ? (item.title || "-") : (item.name || "-");
                const indentPx = row.depth * 20;
                const visibleChangedFields = filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancySet)
                  .filter((field) => !shouldHideChangedField(item, field));
                const visibleChangeTypeCounts = getVisibleChangeTypeCounts(visibleChangedFields);

                return (
                  <tr key={row.key} className={`border-b border-slate-100 text-xs text-slate-700 ${rowStyles(item.status)}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{item.id}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-1.5" style={{ paddingLeft: `${indentPx}px` }}>
                        {row.kind === "menuTitle" && row.hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleTitle(item.id)}
                            className="mt-[2px] inline-flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-white text-[10px] text-slate-700 hover:bg-slate-100"
                            aria-label={row.isExpanded ? "Collapse row" : "Expand row"}
                          >
                            {row.isExpanded ? "-" : "+"}
                          </button>
                        ) : (
                          <span className="inline-flex h-4 w-4 items-center justify-center text-slate-300">•</span>
                        )}
                        <span className={`break-words ${row.kind === "menuTitle" ? "font-semibold text-slate-900" : ""}`}>{label}</span>
                        {row.contextOnly ? (
                          <span className="inline-flex items-center rounded border border-slate-300 bg-slate-100 px-1 py-0.5 text-[10px] font-semibold text-slate-600">
                            Context
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <CurationPill required={Boolean(item.requiresCuration)} />
                    </td>
                    <td className="px-3 py-2">
                      {challengeCell(item)}
                    </td>
                    <td className="px-3 py-2">
                      <ChangeTypeCounts counts={visibleChangeTypeCounts} />
                    </td>
                    <td className="px-3 py-2">
                      <ChangedFieldsCell item={item} selectedRelevancies={selectedRelevancySet} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ChangesTable({ title, rows, labelKey, itemType }) {
  return (
    <section className="overflow-visible rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
        <span>{title}</span>
        <RulesTooltip itemType={itemType} />
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-28" />
            <col className="w-36" />
            <col className="w-80" />
            <col className="w-52" />
            <col className="w-36" />
            <col className="w-72" />
            <col />
          </colgroup>
          <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">{labelKey}</th>
              <th className="px-3 py-2">Require Curation</th>
              <th className="px-3 py-2">Challenge</th>
              <th className="px-3 py-2">Type Counts</th>
              <th className="px-3 py-2">Changed Fields</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className={`border-b border-slate-100 text-xs text-slate-700 ${rowStyles(item.status)}`}>
                <td className="px-3 py-2"><StatusPill status={item.status} /></td>
                <td className="px-3 py-2 font-medium text-slate-900">{item.id}</td>
                <td className="px-3 py-2">{item[labelKey] || "-"}</td>
                <td className="px-3 py-2">
                  <CurationPill required={Boolean(item.requiresCuration)} />
                </td>
                <td className="px-3 py-2">
                  {item.requiresCuration ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                        item.challenge === "Hard"
                          ? "border-rose-200 bg-rose-50 text-rose-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {item.challenge ?? "Easy"}
                    </span>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <ChangeTypeCounts counts={item.changeTypeCounts} />
                </td>
                <td className="px-3 py-2">
                  {item.changedFields?.length ? (
                    <details>
                      <summary className="cursor-pointer text-blue-700 hover:text-blue-900">
                        {item.changedFields.length} field{item.changedFields.length > 1 ? "s" : ""} changed
                      </summary>
                      <div className="mt-1 max-h-96 overflow-auto rounded border border-slate-200 bg-slate-50 p-2">
                        {item.changedFields.map((field) => (
                          <div key={`${item.id}-${field.path}`} className="mb-2 last:mb-0">
                            <p className="flex items-center gap-1.5 font-semibold text-slate-700">
                              <span>{field.path}</span>
                              <span
                                className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  field.changeType === "Relevant"
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : "border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                              >
                                {field.changeType ?? "Not Relevant"}
                              </span>
                            </p>
                            <div className="mt-1 grid grid-cols-1 gap-2 md:grid-cols-2">
                              <div className="rounded border border-rose-200 bg-rose-50 p-2">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-rose-700">Before</p>
                                {renderDiffValue(field.beforeValue, "text-rose-700")}
                              </div>
                              <div className="rounded border border-emerald-200 bg-emerald-50 p-2">
                                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">After</p>
                                {renderDiffValue(field.afterValue, "text-emerald-700")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BrandComparePage({ group, onBack }) {
  const records = group.records ?? [];
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const recordsWithIndex = useMemo(
    () => records.map((record, index) => ({ record, index })),
    [records],
  );
  const recordTimeById = useMemo(() => {
    const map = new Map();
    records.forEach((record) => {
      map.set(String(record.id), parseDateValue(record.updatedAt));
    });
    return map;
  }, [records]);

  useEffect(() => {
    if (records.length === 0) {
      setBeforeId("");
      setAfterId("");
      return;
    }

    const sorted = [...recordsWithIndex].sort((a, b) => {
      const aTime = parseDateValue(a.record.updatedAt);
      const bTime = parseDateValue(b.record.updatedAt);

      if (aTime !== null && bTime !== null && aTime !== bTime) {
        return aTime - bTime;
      }

      return a.index - b.index;
    });

    const latest = sorted[sorted.length - 1]?.record ?? records[records.length - 1];
    const before = sorted[sorted.length - 2]?.record ?? sorted[0]?.record ?? records[0];

    setBeforeId(String(before.id));
    setAfterId(String(latest.id));
  }, [group.key, records, recordsWithIndex]);

  const beforeRecord = records.find((record) => String(record.id) === beforeId);
  const afterRecord = records.find((record) => String(record.id) === afterId);
  const beforeTime = beforeId ? recordTimeById.get(beforeId) ?? null : null;
  const afterTime = afterId ? recordTimeById.get(afterId) ?? null : null;
  const isChronologicalSelection = beforeRecord && afterRecord
    ? beforeTime === null || afterTime === null || afterTime >= beforeTime
    : false;
  const isValidSelection = beforeRecord && afterRecord && beforeRecord.id !== afterRecord.id && isChronologicalSelection;
  const comparison = isValidSelection ? compareMessages(beforeRecord, afterRecord) : null;
  const invalidOrderSelection = Boolean(
    beforeRecord
    && afterRecord
    && beforeRecord.id !== afterRecord.id
    && !isChronologicalSelection,
  );
  const selectionMessage = invalidOrderSelection
    ? "After (updatedAt) must be newer than or equal to Before (updatedAt)."
    : "Select two different records to compare.";

  const dishRows = comparison ? comparison.changes.dishes : [];
  const menuTitleRows = comparison ? comparison.changes.menuTitles : [];

  function getBeforeOptionDisableReason(record) {
    const key = String(record.id);
    if (afterId && key === afterId) {
      return "same as After";
    }

    if (!afterId) {
      return null;
    }

    const candidateTime = recordTimeById.get(key);
    const selectedAfterTime = recordTimeById.get(afterId) ?? null;
    if (candidateTime === null || selectedAfterTime === null) {
      return null;
    }

    if (candidateTime > selectedAfterTime) {
      return "newer than After";
    }

    return null;
  }

  function getAfterOptionDisableReason(record) {
    const key = String(record.id);
    if (beforeId && key === beforeId) {
      return "same as Before";
    }

    if (!beforeId) {
      return null;
    }

    const candidateTime = recordTimeById.get(key);
    const selectedBeforeTime = recordTimeById.get(beforeId) ?? null;
    if (candidateTime === null || selectedBeforeTime === null) {
      return null;
    }

    if (candidateTime < selectedBeforeTime) {
      return "older than Before";
    }

    return null;
  }

  function handleExportCsv() {
    if (!comparison) {
      return;
    }

    const exportRows = [
      ...menuTitleRows
        .filter((item) => item.status !== "deleted")
        .flatMap((item) => (item.changedFields ?? [])
          .filter((field) => field.changeType === "Relevant")
          .filter((field) => !shouldHideChangedField(item, field))
          .map((field) => ({
            type: "menuTitle",
            id: item.id,
            name: item.title ?? "-",
            field: field.path ?? "-",
            before: serializeJsonb(field.beforeValue),
            after: serializeJsonb(field.afterValue),
          }))),
      ...dishRows
        .filter((item) => item.status !== "deleted")
        .flatMap((item) => (item.changedFields ?? [])
          .filter((field) => field.changeType === "Relevant")
          .filter((field) => !shouldHideChangedField(item, field))
          .map((field) => ({
            type: "dishes",
            id: item.id,
            name: item.name ?? "-",
            field: field.path ?? "-",
            before: serializeJsonb(field.beforeValue),
            after: serializeJsonb(field.afterValue),
          }))),
    ];

    const lines = [
      ["type", "id", "name", "field", "before", "after"].join(","),
      ...exportRows.map((row) => [
        escapeCsvCell(row.type),
        escapeCsvCell(row.id),
        escapeCsvCell(row.name),
        escapeCsvCell(row.field),
        escapeCsvCell(row.before),
        escapeCsvCell(row.after),
      ].join(",")),
    ];

    const csvContent = lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeBrand = String(group.brandName ?? "brand").replace(/[^\w-]+/g, "_");
    const safeMenuId = String(group.menuId ?? "menu").replace(/[^\w-]+/g, "_");

    link.href = url;
    link.download = `${safeBrand}_${safeMenuId}_comparison_export.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!comparison}
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
            </div>
            <h2 className="mt-2 text-base font-semibold text-slate-900">{group.brandName}</h2>
            <p className="mt-1 text-xs text-slate-600">
              Menu ID {group.menuId} | {records.length} records
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 lg:w-[760px] lg:grid-cols-2">
            <RecordSelect
              label="Before (updatedAt)"
              value={beforeId}
              onChange={setBeforeId}
              records={records}
              getOptionDisableReason={getBeforeOptionDisableReason}
            />
            <RecordSelect
              label="After (updatedAt)"
              value={afterId}
              onChange={setAfterId}
              records={records}
              getOptionDisableReason={getAfterOptionDisableReason}
            />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Disabled options are marked in the dropdown, for example: <span className="font-semibold">(older than Before)</span>.
        </p>

        {comparison ? (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-5">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
              <p className="text-slate-500">Menu decision</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill status={comparison.menu.status} />
                <span className="text-slate-700">{comparison.menu.reason}</span>
              </div>
            </div>
            <SummaryTriple
              label="Menu Title"
              deleted={comparison.summary.menuTitles.deleted}
              added={comparison.summary.menuTitles.new}
              updated={comparison.summary.menuTitles.updated}
            />
            <SummaryTriple
              label="Dishes"
              deleted={comparison.summary.dishes.deleted}
              added={comparison.summary.dishes.new}
              updated={comparison.summary.dishes.updated}
            />
            <SummarySingle label="Dishes Require Curation" value={comparison.summary.dishes.requiresCuration} />
            <SummarySingle label="Menu Titles Require Curation" value={comparison.summary.menuTitles.requiresCuration} />
          </div>
        ) : (
          <p className="mt-3 text-xs text-rose-600">{selectionMessage}</p>
        )}

        {comparison ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RulesTooltip itemType="menuTitle" label="Menu Title Rules" align="left" />
            <RulesTooltip itemType="dish" label="Dishes Rules" align="left" />
            <RulesTooltip label="Color Code" align="left" content={<ColorCodeTable />} />
          </div>
        ) : null}
      </header>

      {comparison ? (
        <div className="flex flex-col gap-4">
          <UnifiedExpandableTable menuTitleRows={menuTitleRows} dishRows={dishRows} />
        </div>
      ) : null}
    </section>
  );
}

export default BrandComparePage;
