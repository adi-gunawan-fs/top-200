import { formatDate } from "../../utils/formatDate";

export function RecordSelect({ label, value, onChange, records, getOptionDisableReason }) {
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
