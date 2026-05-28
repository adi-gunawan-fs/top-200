import { menuTitleDescriptorLines } from "./csvExport";

export function MenuTitleChain({ chain }) {
  if (!Array.isArray(chain) || chain.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex flex-col gap-1">
      {chain.map((mt, idx) => (
        <div key={idx} className="space-y-1">
          <div className="font-semibold text-slate-800">{mt.title ?? "—"}</div>
          {mt.description && <div className="text-slate-500 text-[11px]">{mt.description}</div>}
          {menuTitleDescriptorLines(mt).map((line) => (
            <div key={line} className="text-slate-500 text-[11px] break-words">
              {line}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CurationList({ items }) {
  if (!Array.isArray(items) || items.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <span>
      {items.map((item, idx) => (
        <span key={idx}>
          {idx > 0 && <span className="text-slate-400">, </span>}
          <span className={item.isCurationEnabled === false ? "text-slate-300" : ""}>{item.name}</span>
        </span>
      ))}
    </span>
  );
}

export function dishCellText(v) {
  if (v == null || v === "") return "—";
  if (Array.isArray(v)) return v.length === 0 ? "—" : JSON.stringify(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
