import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";

const PAGE_SIZE = 20;

async function fetchBrandsList() {
  const response = await fetch("http://localhost:3000/api/brands-list");
  if (!response.ok) throw new Error(`Failed to fetch brands: ${response.statusText}`);
  const data = await response.json();
  return data.rows || [];
}

function BrandListPage({ onBack, onSelectBrand }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetchBrandsList()
      .then(setBrands)
      .catch((err) => {
        console.error("Failed to fetch brands list:", err);
        setError(err.message || "Failed to load brands.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setPage(0);
  }, [searchQuery]);

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const query = searchQuery.toLowerCase();
    return brands.filter((brand) => brand.brandName.toLowerCase().includes(query));
  }, [brands, searchQuery]);

  const totalPages = Math.ceil(filteredBrands.length / PAGE_SIZE);
  const paginatedBrands = filteredBrands.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading brands…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col gap-4">
        <Button onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Button>
        <EmptyState message={error} tone="danger" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
          <h2 className="text-sm font-semibold text-slate-700">Large Brand List</h2>
        </div>
        <p className="text-xs text-slate-500">{filteredBrands.length} of {brands.length} brands{searchQuery && ` (filtered)`}</p>
      </div>

      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search brand name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-28 px-3 py-2.5">AUTOEAT ID</th>
              <th className="w-32 px-3 py-2.5">Menu Curator ID</th>
              <th className="px-3 py-2.5">Brand Name</th>
              <th className="w-32 px-3 py-2.5">Tier One</th>
              <th className="w-32 px-3 py-2.5">Curation</th>
              <th className="w-20 px-3 py-2.5">QA</th>
              <th className="w-20 px-3 py-2.5">QC</th>
            </tr>
          </thead>
          <tbody>
            {filteredBrands.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                  No brands match your search.
                </td>
              </tr>
            ) : (
              paginatedBrands.map((brand) => (
                <tr
                  key={brand.brandId}
                  onClick={() => onSelectBrand(brand)}
                  className="cursor-pointer border-b border-slate-100 last:border-b-0 text-slate-700 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 font-medium text-slate-900">{brand.autoeatId}</td>
                  <td className="px-3 py-2">
                    {brand.menuCurationTaskId ? (
                      <a
                        href={`https://menu-curator.foodstyles.com/menu-curation-tasks/${brand.menuCurationTaskId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {brand.menuCurationTaskId}
                      </a>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-medium">{brand.brandName}</td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={brand.isTierOneDone ?? false}
                      readOnly
                      className="cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={brand.isCurationDone ?? false}
                      readOnly
                      className="cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={brand.isQaDone ?? false}
                      readOnly
                      className="cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={brand.isQcDone ?? false}
                      readOnly
                      className="cursor-default"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                </tr>
              ))
            )}
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
    </section>
  );
}

export default BrandListPage;
