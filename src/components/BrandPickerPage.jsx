import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Search } from "lucide-react";
import { exportAllBrandsToCSV, fetchOverview } from "../lib/dbFetch";
import { EmptyState } from "./ui/EmptyState";

const PAGE_SIZE = 20;

function BrandPickerPage({ onSelectRow, session, onExportDone }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(null); // { brandsDone, brandsTotal, totalRows }

  useEffect(() => {
    fetchOverview()
      .then(setRows)
      .catch((err) => setError(err.message ?? "Failed to load overview."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(0); }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.brandName.toLowerCase().includes(q) || String(r.autoeatId).includes(q),
    );
  }, [rows, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSelectRow = (row) => {
    onSelectRow(row);
  };

  const handleExportAll = async () => {
    if (exporting || !session) return;
    setExporting(true);
    setExportProgress({ brandsDone: 0, brandsTotal: 0, totalRows: 0 });
    try {
      const saved = await exportAllBrandsToCSV(session.user.id, {
        onProgress: ({ brandsDone, brandsTotal, totalRows }) => {
          setExportProgress({ brandsDone, brandsTotal, totalRows });
        },
      });
      onExportDone?.(saved);
    } catch (err) {
      setError(err.message ?? "Export failed.");
    } finally {
      setExporting(false);
      setExportProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-slate-400">Loading menus…</p>
      </div>
    );
  }

  if (error) return <EmptyState message={error} tone="danger" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Top 200 — Included Menus</h2>
        <div className="flex items-center gap-3">
          {exportProgress && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-300"
                  style={{ width: exportProgress.brandsTotal ? `${(exportProgress.brandsDone / exportProgress.brandsTotal) * 100}%` : "0%" }}
                />
              </div>
              <span className="text-[11px] text-slate-500">
                {exportProgress.brandsDone} / {exportProgress.brandsTotal} brands
              </span>
            </div>
          )}
          <button
            type="button"
            onClick={handleExportAll}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            {exporting ? "Exporting…" : "Export All to CSV"}
          </button>
          <p className="text-xs text-slate-400">{filtered.length} of {rows.length} menus</p>
        </div>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brand or autoeat ID…"
          className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full table-fixed border-collapse text-xs">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-28 px-3 py-2.5">Menu ID</th>
              <th className="w-32 px-3 py-2.5">Autoeat ID</th>
              <th className="w-48 px-3 py-2.5">Brand Name</th>
              <th className="px-3 py-2.5">Menu URL</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400">No menus match your search.</td>
              </tr>
            ) : paginated.map((row) => (
                <tr
                  key={row.menuId}
                  onClick={() => handleSelectRow(row)}
                  className="cursor-pointer border-b border-slate-100 last:border-b-0 text-slate-700 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 font-medium text-slate-900">
                    {row.menuId}
                  </td>
                  <td className="px-3 py-2 text-slate-500">{row.autoeatId ?? "—"}</td>
                  <td className="px-3 py-2 font-medium">{row.brandName}</td>
                  <td className="max-w-0 truncate px-3 py-2">
                    {row.menuUrl ? (
                      <a
                        href={row.menuUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex max-w-full items-center gap-1 text-blue-600 hover:underline"
                        title={row.menuUrl}
                      >
                        <span className="truncate">{row.menuUrl}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    ) : "—"}
                  </td>
                </tr>
            ))}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2">
            <p className="text-[11px] text-slate-400">Page {page + 1} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
                className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages - 1}
                className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BrandPickerPage;
