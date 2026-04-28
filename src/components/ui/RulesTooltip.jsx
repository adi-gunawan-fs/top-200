import { CircleHelp } from "lucide-react";
import { CHANGE_TYPE_RULES, CHALLENGE_RULES } from "../../utils/compareMessages";
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
