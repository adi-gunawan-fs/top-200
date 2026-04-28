export function SummaryTriple({ label, deleted, added, updated }) {
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
