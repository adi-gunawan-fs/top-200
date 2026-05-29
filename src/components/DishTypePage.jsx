import { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronRight, ChevronDown, EyeOff, Download } from "lucide-react";
import { fetchDishTypes } from "../lib/api";
import { escapeCsvValue } from "../lib/csvHelpers";

function buildTree(rows) {
  const byId = new Map();
  rows.forEach((row) => byId.set(row.id, { ...row, children: [] }));
  const roots = [];
  byId.forEach((node) => {
    if (node.parentId != null && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortRec = (nodes) => {
    nodes.sort((a, b) => {
      const ap = a.position ?? Number.MAX_SAFE_INTEGER;
      const bp = b.position ?? Number.MAX_SAFE_INTEGER;
      if (ap !== bp) return ap - bp;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

function TreeNode({ node, depth, expanded, onToggle }) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.id);
  return (
    <>
      <div
        className="flex items-center gap-1 py-1.5 hover:bg-slate-50"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700"
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="inline-block h-4 w-4" />
        )}
        <span className={`text-sm ${node.isCurationEnabled ? "text-slate-800" : "text-slate-400"}`}>
          {node.name}
        </span>
        {!node.isCurationEnabled ? (
          <span
            title="Curation disabled"
            className="ml-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500"
          >
            <EyeOff className="h-3 w-3" />
            disabled
          </span>
        ) : null}
        {node.isIgnored ? (
          <span
            title="Ignored"
            className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700"
          >
            ignored
          </span>
        ) : null}
      </div>
      {hasChildren && isOpen
        ? node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} expanded={expanded} onToggle={onToggle} />
          ))
        : null}
    </>
  );
}

function DishTypePage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDishTypes()
      .then((data) => {
        if (cancelled) return;
        setRows(data);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message ?? String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tree = useMemo(() => buildTree(rows), [rows]);

  const toggleNode = (id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set();
    const walk = (nodes) => nodes.forEach((n) => { if (n.children.length) { all.add(n.id); walk(n.children); } });
    walk(tree);
    setExpanded(all);
  };

  const collapseAll = () => setExpanded(new Set());

  const handleExportCsv = () => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const header = ["grand_parent", "parent", "dish_type", "is_curation_enabled", "is_ignored"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      const parent = r.parentId != null ? byId.get(r.parentId) : null;
      const grandParent = parent && parent.parentId != null ? byId.get(parent.parentId) : null;
      lines.push([
        escapeCsvValue(grandParent?.name ?? ""),
        escapeCsvValue(parent?.name ?? ""),
        escapeCsvValue(r.name ?? ""),
        escapeCsvValue(r.isCurationEnabled ? "TRUE" : "FALSE"),
        escapeCsvValue(r.isIgnored ? "TRUE" : "FALSE"),
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dish-types-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Dish Type</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50"
          >
            Collapse all
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={rows.length === 0}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : error ? (
        <p className="text-sm text-rose-600">Error: {error}</p>
      ) : tree.length === 0 ? (
        <p className="text-sm text-slate-500">No dish types found.</p>
      ) : (
        <div className="rounded-md border border-slate-200">
          {tree.map((node) => (
            <TreeNode key={node.id} node={node} depth={0} expanded={expanded} onToggle={toggleNode} />
          ))}
        </div>
      )}
    </div>
  );
}

export default DishTypePage;
