function statusStyles(status) {
  if (status === "new") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "updated") return "bg-amber-50 text-amber-700 border-amber-200";
  if (status === "deleted") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

export function rowStyles(status) {
  if (status === "new") return "bg-emerald-50/40";
  if (status === "updated") return "bg-amber-50/50";
  if (status === "deleted") return "bg-rose-50/40";
  return "bg-white";
}

export function StatusPill({ status }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyles(status)}`}>
      {status}
    </span>
  );
}
