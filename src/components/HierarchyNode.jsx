import { StatusPill, rowStyles } from "./ui/StatusPill";
import { CurationPill } from "./ui/CurationPill";

export function HierarchyNode({ node, level = 0 }) {
  const titleItem = node.item;
  const hasNested = node.children.length > 0 || node.dishes.length > 0;
  const wrapperClass = level === 0
    ? "rounded-md border border-slate-200 bg-white"
    : "rounded-md border border-slate-200 bg-slate-50";

  return (
    <details open className={wrapperClass}>
      <summary className="cursor-pointer list-none px-3 py-2 hover:bg-slate-100/70">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <StatusPill status={titleItem.status} />
          <span className="font-semibold text-slate-900">
            {level === 0 ? "Parent Menu Title" : "Child Menu Title"}: {titleItem.title || "-"}
          </span>
          <span className="text-slate-500">#{titleItem.id}</span>
          <CurationPill required={Boolean(titleItem.requiresCuration)} />
          <span className="text-slate-500">
            {node.children.length} child title{node.children.length !== 1 ? "s" : ""}, {node.dishes.length} dish{node.dishes.length !== 1 ? "es" : ""}
          </span>
        </div>
      </summary>

      {hasNested ? (
        <div className="space-y-2 border-t border-slate-200 px-3 py-2">
          {node.children.map((child) => (
            <HierarchyNode key={child.id} node={child} level={level + 1} />
          ))}

          {node.dishes.length > 0 ? (
            <div className="rounded-md border border-slate-200 bg-white p-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Dishes</p>
              <div className="mt-2 space-y-1.5">
                {node.dishes.map((dish) => (
                  <div key={dish.id} className={`rounded border border-slate-200 p-2 text-xs ${rowStyles(dish.status)}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill status={dish.status} />
                      <span className="font-medium text-slate-900">{dish.name || "-"}</span>
                      <span className="text-slate-500">#{dish.id}</span>
                      <CurationPill required={Boolean(dish.requiresCuration)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">No child menu title or dish changes.</div>
      )}
    </details>
  );
}
