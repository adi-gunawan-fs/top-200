export function ChangeTypeBadge({ type }) {
  if (type === "Relevant") {
    return <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Relevant</span>;
  }
  return <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Not Relevant</span>;
}

export function ChangeTypeCounts({ counts }) {
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
