import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { fetchBrands, streamMessages } from "../lib/dbFetch";
import { EmptyState } from "./ui/EmptyState";

const PAGE_SIZE = 20;

function BrandPickerPage({ onGroupsReady }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fetchingBrandId, setFetchingBrandId] = useState(null);
  const [fetchProgress, setFetchProgress] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? brands.filter((b) => b.name.toLowerCase().includes(q)) : brands;
  }, [brands, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    fetchBrands()
      .then(setBrands)
      .catch((err) => setError(err.message ?? "Failed to load brands."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(0); }, [search]);

  const handleSelectBrand = async (brand) => {
    setFetchingBrandId(brand.id);
    setFetchProgress({ totalRows: 0 });
    setError("");

    try {
      const { createMenuGrouper } = await import("../utils/groupByMenu");
      const grouper = createMenuGrouper();

      await streamMessages(brand.id, {
        onRow: (row) => grouper.addRow(row),
        onProgress: (p) => setFetchProgress(p),
      });

      const groups = grouper.finalize();
      console.log(`[db] fetched ${groups.length} menu groups for brand ${brand.name}`);

      if (groups.length === 0) {
        setError(`No messages found for ${brand.name} since Jan 2025.`);
        return;
      }

      onGroupsReady(groups, brand);
    } catch (err) {
      setError(err.message ?? "Failed to fetch messages.");
    } finally {
      setFetchingBrandId(null);
      setFetchProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-slate-400">Loading brands…</p>
      </div>
    );
  }

  if (error) {
    return <EmptyState message={error} tone="danger" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Select a brand to load its menu messages</h2>
        <p className="text-xs text-slate-400">{filtered.length} of {brands.length} brands</p>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search brands…"
          className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wide text-slate-500">Brand</th>
              <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wide text-slate-500">ID</th>
              <th className="w-32 px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-400">No brands match your search.</td>
              </tr>
            ) : paginated.map((brand) => {
              const isFetching = fetchingBrandId === brand.id;
              const isDisabled = fetchingBrandId !== null;
              return (
                <tr key={brand.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{brand.name}</td>
                  <td className="px-4 py-3 text-slate-400">{brand.id}</td>
                  <td className="px-4 py-3 text-right">
                    {isFetching ? (
                      <span className="text-[11px] text-blue-500">
                        {fetchProgress?.totalRows ?? 0} rows…
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelectBrand(brand)}
                        className="rounded-md border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Load
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2">
            <p className="text-[11px] text-slate-400">
              Page {page + 1} of {totalPages}
            </p>
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
