import { StatusPill, rowStyles } from "./ui/StatusPill";
import { challengeCell } from "./ui/ChallengeBadge";
import { ChangeTypeBadge, ChangeTypeCounts } from "./ui/ChangeTypeBadge";
import { RulesTooltip } from "./ui/RulesTooltip";

function formatValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
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

export function ChangesTable({ title, rows, labelKey, itemType }) {
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
            <col className="w-36" />
            <col className="w-60" />
            <col className="w-[560px]" />
          </colgroup>
          <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">{labelKey}</th>
              <th className="px-3 py-2">Challenge</th>
              <th className="px-3 py-2">Relevancies</th>
              <th className="px-3 py-2">Changed Fields</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className={`border-b border-slate-100 text-xs text-slate-700 ${rowStyles(item.status)}`}>
                <td className="px-3 py-2"><StatusPill status={item.status} /></td>
                <td className="px-3 py-2 font-medium text-slate-900">{item.id}</td>
                <td className="px-3 py-2">{item[labelKey] || "-"}</td>
                <td className="px-3 py-2">{challengeCell(item)}</td>
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
                              <ChangeTypeBadge type={field.changeType} />
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
