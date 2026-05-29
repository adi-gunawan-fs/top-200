import { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronRight, ChevronDown, EyeOff, Download } from "lucide-react";
import { fetchDiets } from "../lib/api";
import { escapeCsvValue } from "../lib/csvHelpers";

function sortByPosition(items) {
  return [...items].sort((a, b) => {
    const ap = a.position ?? Number.MAX_SAFE_INTEGER;
    const bp = b.position ?? Number.MAX_SAFE_INTEGER;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name);
  });
}

function buildTree(diets, categories) {
  const catById = new Map(categories.map((c) => [c.id, { ...c, children: [] }]));
  const orphanCat = { id: null, name: "(Uncategorized)", isCurationEnabled: true, position: null, children: [] };
  diets.forEach((d) => {
    const parent = d.dietCategoryId != null && catById.has(d.dietCategoryId) ? catById.get(d.dietCategoryId) : orphanCat;
    parent.children.push(d);
  });
  const roots = sortByPosition([...catById.values()]);
  roots.forEach((r) => { r.children = sortByPosition(r.children); });
  if (orphanCat.children.length > 0) {
    orphanCat.children = sortByPosition(orphanCat.children);
    roots.push(orphanCat);
  }
  return roots;
}

function StatusBadges({ node }) {
  return (
    <>
      {!node.isCurationEnabled ? (
        <span
          title="Curation disabled"
          className="ml-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500"
        >
          <EyeOff className="h-3 w-3" />
          disabled
        </span>
      ) : null}
    </>
  );
}

function DietPage() {
  const [diets, setDiets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDiets()
      .then((data) => {
        if (cancelled) return;
        setDiets(data.rows ?? []);
        setCategories(data.categories ?? []);
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

  const tree = useMemo(() => buildTree(diets, categories), [diets, categories]);

  const toggleNode = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(tree.map((c) => `cat:${c.id}`)));
  const collapseAll = () => setExpanded(new Set());

  const handleExportCsv = () => {
    const header = ["category", "diet", "is_curation_enabled"];
    const lines = [header.join(",")];
    const catById = new Map(categories.map((c) => [c.id, c]));
    diets.forEach((d) => {
      const cat = d.dietCategoryId != null ? catById.get(d.dietCategoryId) : null;
      lines.push([
        escapeCsvValue(cat?.name ?? ""),
        escapeCsvValue(d.name ?? ""),
        escapeCsvValue(d.isCurationEnabled ? "TRUE" : "FALSE"),
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diets-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Diet</h1>
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
            disabled={diets.length === 0}
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
        <p className="text-sm text-slate-500">No diets found.</p>
      ) : (
        <div className="rounded-md border border-slate-200">
          {tree.map((cat) => {
            const key = `cat:${cat.id}`;
            const isOpen = expanded.has(key);
            const hasChildren = cat.children.length > 0;
            return (
              <div key={key}>
                <div className="flex items-center gap-1 py-1.5" style={{ paddingLeft: 8 }}>
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => toggleNode(key)}
                      className="flex h-4 w-4 items-center justify-center text-slate-400 hover:text-slate-700"
                    >
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <span className="inline-block h-4 w-4" />
                  )}
                  <span className={`text-sm font-medium ${cat.isCurationEnabled ? "text-slate-800" : "text-slate-400"}`}>
                    {cat.name}
                  </span>
                  <StatusBadges node={cat} />
                </div>
                {isOpen
                  ? cat.children.map((d) => (
                      <div key={d.id} className="flex items-center gap-1 py-1.5 hover:bg-slate-50" style={{ paddingLeft: 24 }}>
                        <span className="inline-block h-4 w-4" />
                        <span className={`text-sm ${d.isCurationEnabled ? "text-slate-800" : "text-slate-400"}`}>
                          {d.name}
                        </span>
                        <StatusBadges node={d} />
                      </div>
                    ))
                  : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DietPage;
