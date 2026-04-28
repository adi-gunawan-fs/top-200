import { useState } from "react";
import { StatusPill, rowStyles } from "./ui/StatusPill";
import { challengeCell } from "./ui/ChallengeBadge";
import { ChangeTypeCounts } from "./ui/ChangeTypeBadge";
import { RulesTooltip } from "./ui/RulesTooltip";
import { ChangedFieldsModal } from "./ui/ChangedFieldsModal";

function ChangedFieldsCell({ item }) {
  const [open, setOpen] = useState(false);
  const fields = item.changedFields ?? [];

  if (!fields.length) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-blue-700 hover:text-blue-900 hover:underline focus:outline-none"
      >
        {fields.length} field{fields.length > 1 ? "s" : ""} changed
      </button>
      {open ? (
        <ChangedFieldsModal
          item={item}
          fields={fields}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
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
                  <ChangedFieldsCell item={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
