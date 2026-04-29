import { CircleHelp } from "lucide-react";
import { CHANGE_TYPE_RULES, CHALLENGE_RULES } from "../../utils/compareMessages";
import { Badge } from "./Badge";
import { ChangeTypeBadge } from "./ChangeTypeBadge";
import { ChallengeBadge } from "./ChallengeBadge";

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

export function ColorCodeTable() {
  const rows = [
    { label: "New", tone: "success", swatch: "Light Green" },
    { label: "Updated", tone: "warning", swatch: "Light Yellow" },
    { label: "Deleted", tone: "danger", swatch: "Light Red" },
    { label: "Unchanged", tone: "neutral", swatch: "White" },
  ];

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
            {rows.map((row, i) => (
              <tr key={row.label} className={i < rows.length - 1 ? "border-b border-slate-100" : ""}>
                <td className="px-1 py-1"><span className="font-medium text-slate-700">{row.label}</span></td>
                <td className="px-1 py-1"><Badge tone={row.tone} uppercase={false}>{row.swatch}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RulesTooltip({ itemType, label = "?", align = "center", content = null }) {
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
