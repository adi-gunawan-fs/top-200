import { useEffect, useState } from "react";
import { ArrowLeft, CircleHelp } from "lucide-react";
import { CHANGE_TYPE_RULES, CHALLENGE_RULES, compareMessages } from "../utils/compareMessages";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  const normalized = String(value)
    .trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
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
  if (status === "stale") {
    return "bg-orange-50 text-orange-700 border-orange-200";
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
  if (status === "stale") {
    return "bg-orange-50/40";
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
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
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
  if (isStructuredValue(value)) {
    return (
      <pre className={`overflow-x-auto whitespace-pre-wrap break-words rounded border border-slate-200 bg-white p-2 text-[11px] ${toneClass}`}>
        {JSON.stringify(value, null, 2)}
      </pre>
    );
  }

  return <p className={`text-[11px] break-words ${toneClass}`}>{formatValue(value)}</p>;
}

function RecordSelect({ label, value, onChange, records, blockedValue }) {
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
          const disabled = blockedValue && blockedValue === key;
          return (
            <option key={key} value={key} disabled={disabled}>
              {formatDate(record.updatedAt)} | #{record.id}
            </option>
          );
        })}
      </select>
    </label>
  );
}

function ChangeTypeBadge({ type }) {
  if (type === "Major") {
    return <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Major</span>;
  }
  if (type === "Minor") {
    return <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">Minor</span>;
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

function ChangeTypeCounts({ counts }) {
  const safeCounts = counts ?? { Major: 0, Minor: 0, "Not Relevant": 0 };

  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
        Major: {safeCounts.Major ?? 0}
      </span>
      <span className="inline-flex items-center gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
        Minor: {safeCounts.Minor ?? 0}
      </span>
      <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
        Not Relevant: {safeCounts["Not Relevant"] ?? 0}
      </span>
    </div>
  );
}

function RulesTooltip({ itemType }) {
  return (
    <div className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label="Show field type rules"
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </button>
      <div className="pointer-events-none invisible absolute left-1/2 top-[calc(100%+6px)] z-20 w-[380px] -translate-x-1/2 opacity-0 transition-all group-hover:pointer-events-auto group-hover:visible group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100">
        <RulesTable itemType={itemType} />
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
                                  field.changeType === "Major"
                                    ? "border-rose-200 bg-rose-50 text-rose-700"
                                    : field.changeType === "Minor"
                                      ? "border-amber-200 bg-amber-50 text-amber-700"
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

  useEffect(() => {
    if (records.length === 0) {
      setBeforeId("");
      setAfterId("");
      return;
    }

    const latest = records[records.length - 1];
    const before = records[records.length - 2] ?? records[0];

    setBeforeId(String(before.id));
    setAfterId(String(latest.id));
  }, [group.key]);

  const beforeRecord = records.find((record) => String(record.id) === beforeId);
  const afterRecord = records.find((record) => String(record.id) === afterId);
  const isValidSelection = beforeRecord && afterRecord && beforeRecord.id !== afterRecord.id;
  const comparison = isValidSelection ? compareMessages(beforeRecord, afterRecord) : null;

  const dishRows = comparison ? comparison.changes.dishes : [];
  const menuTitleRows = comparison ? comparison.changes.menuTitles : [];

  return (
    <section className="flex flex-col gap-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
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
              blockedValue={afterId}
            />
            <RecordSelect
              label="After (updatedAt)"
              value={afterId}
              onChange={setAfterId}
              records={records}
              blockedValue={beforeId}
            />
          </div>
        </div>

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
          <p className="mt-3 text-xs text-rose-600">Select two different records to compare.</p>
        )}
      </header>

      {comparison ? (
        <div className="flex flex-col gap-4">
          <ChangesTable title="Menu Title Comparison (menuTitles.id)" rows={menuTitleRows} labelKey="title" itemType="menuTitle" />
          <ChangesTable title="Dish Comparison (dishes.id)" rows={dishRows} labelKey="name" itemType="dish" />
        </div>
      ) : null}
    </section>
  );
}

export default BrandComparePage;
