import { useEffect, useState } from "react";
import { Loader2, EyeOff, Download } from "lucide-react";
import { fetchAllergens } from "../lib/api";
import { escapeCsvValue } from "../lib/csvHelpers";

function AllergenPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAllergens()
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

  const handleExportCsv = () => {
    const header = ["allergen", "is_curation_enabled"];
    const lines = [header.join(",")];
    rows.forEach((r) => {
      lines.push([
        escapeCsvValue(r.name ?? ""),
        escapeCsvValue(r.isCurationEnabled ? "TRUE" : "FALSE"),
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `allergens-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Allergen</h1>
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

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : error ? (
        <p className="text-sm text-rose-600">Error: {error}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No allergens found.</p>
      ) : (
        <div className="rounded-md border border-slate-200">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-50">
              <span className={`text-sm ${r.isCurationEnabled ? "text-slate-800" : "text-slate-400"}`}>
                {r.name}
              </span>
              {!r.isCurationEnabled ? (
                <span
                  title="Curation disabled"
                  className="ml-1 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500"
                >
                  <EyeOff className="h-3 w-3" />
                  disabled
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AllergenPage;
