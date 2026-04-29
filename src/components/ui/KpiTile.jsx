export function KpiTile({ label, children, className = "" }) {
  return (
    <div className={`rounded-md border border-slate-200 bg-slate-50 p-2 text-xs ${className}`.trim()}>
      {label ? <p className="text-slate-500">{label}</p> : null}
      <div className={label ? "mt-1" : ""}>{children}</div>
    </div>
  );
}
