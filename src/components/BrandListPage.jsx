import { useEffect, useState, useMemo } from "react";
import { Loader2, Search, ChevronLeft, ChevronRight, Clock, GitCompare, Download } from "lucide-react";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import {
  buildCombinedAiCuratorTaskExportCsv,
  buildCombinedLatestBrandsExportCsv,
  buildCombinedTierOneTaskExportCsv,
} from "../lib/dbFetch";
import { fetchBrandsList } from "../lib/api";
import { downloadExportFile } from "../utils/exportComparison";

const PAGE_SIZE = 20;

function ModePickerModal({ brand, onPick, onClose }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-semibold text-slate-800">{brand.brandName}</h3>
        <p className="mt-1 text-xs text-slate-500">Choose how you'd like to view this brand's dishes.</p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onPick("latest")}
            className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2.5 text-left hover:border-blue-400 hover:bg-blue-50"
          >
            <Clock className="h-4 w-4 text-slate-500" />
            <div>
              <div className="text-xs font-medium text-slate-800">Latest</div>
              <div className="text-[11px] text-slate-500">View the latest snapshot of dishes.</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => onPick("compare")}
            className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2.5 text-left hover:border-blue-400 hover:bg-blue-50"
          >
            <GitCompare className="h-4 w-4 text-slate-500" />
            <div>
              <div className="text-xs font-medium text-slate-800">Compare</div>
              <div className="text-[11px] text-slate-500">Pick before/after dates to see changes.</div>
            </div>
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" onClick={onClose} className="text-xs text-slate-500 hover:text-slate-700">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function BrandListPage({ onBack, onSelectBrand }) {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pickerBrand, setPickerBrand] = useState(null);
  const [selectedBrandIds, setSelectedBrandIds] = useState(() => new Set());
  const [exportingLatest, setExportingLatest] = useState(false);
  const [exportingAiCurator, setExportingAiCurator] = useState(false);
  const [exportingTierOne, setExportingTierOne] = useState(false);
  const [aiCuratorLimit, setAiCuratorLimit] = useState("");
  const [exportProgress, setExportProgress] = useState("");

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

  const selectedBrands = useMemo(
    () => brands.filter((brand) => selectedBrandIds.has(String(brand.brandId))),
    [brands, selectedBrandIds],
  );
  const filteredBrandIds = useMemo(
    () => filteredBrands.map((brand) => String(brand.brandId)),
    [filteredBrands],
  );
  const selectedBrandsWithTask = useMemo(
    () => selectedBrands.filter((brand) => !!brand.menuCurationTaskId),
    [selectedBrands],
  );
  const allFilteredSelected = filteredBrandIds.length > 0 && filteredBrandIds.every((id) => selectedBrandIds.has(id));
  const someFilteredSelected = filteredBrandIds.some((id) => selectedBrandIds.has(id));

  const totalPages = Math.ceil(filteredBrands.length / PAGE_SIZE);
  const paginatedBrands = filteredBrands.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleBrandSelection(brandId) {
    const key = String(brandId);
    setSelectedBrandIds((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleFilteredSelection() {
    setSelectedBrandIds((current) => {
      const next = new Set(current);
      if (allFilteredSelected) {
        filteredBrandIds.forEach((id) => next.delete(id));
      } else {
        filteredBrandIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  async function handleExportLatestSelected() {
    if (selectedBrands.length === 0) return;

    setExportingLatest(true);
    try {
      setExportProgress(`Preparing ${selectedBrands.length} brands...`);
      const { csvContent, filename, totalRows } = await buildCombinedLatestBrandsExportCsv({
        brands: selectedBrands,
        onProgress: ({ currentBrand, doneBrands, totalBrands, totalRows: progressRows }) => {
          setExportProgress(`Preparing ${currentBrand} (${doneBrands}/${totalBrands}) · ${progressRows} rows`);
        },
      });
      downloadExportFile(csvContent, "text/csv;charset=utf-8;", filename);
      setExportProgress(`Downloaded 1 combined export · ${totalRows} rows.`);
    } catch (err) {
      setError(err.message || "Failed to export selected brands.");
      setExportProgress("");
    } finally {
      setExportingLatest(false);
    }
  }

  async function handleExportAiCuratorSelected() {
    if (selectedBrandsWithTask.length === 0) return;
    const parsedLimit = aiCuratorLimit.trim() ? parseInt(aiCuratorLimit, 10) : null;
    const limitPerTask = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;

    setExportingAiCurator(true);
    try {
      setExportProgress(`Preparing ${selectedBrandsWithTask.length} task exports...`);
      const { csvContent, filename, totalRows } = await buildCombinedAiCuratorTaskExportCsv({
        brands: selectedBrandsWithTask,
        limitPerTask,
        onProgress: ({ currentBrand, doneBrands, totalBrands, totalRows: progressRows }) => {
          setExportProgress(`Preparing ${currentBrand} (${doneBrands}/${totalBrands}) · ${progressRows} rows`);
        },
      });
      downloadExportFile(csvContent, "text/csv;charset=utf-8;", filename);
      setExportProgress(`Downloaded AI vs Curator export · ${totalRows} rows.`);
    } catch (err) {
      setError(err.message || "Failed to export selected task rows.");
      setExportProgress("");
    } finally {
      setExportingAiCurator(false);
    }
  }

  async function handleExportTierOneSelected() {
    if (selectedBrandsWithTask.length === 0) return;
    const parsedLimit = aiCuratorLimit.trim() ? parseInt(aiCuratorLimit, 10) : null;
    const limitPerTask = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null;

    setExportingTierOne(true);
    try {
      setExportProgress(`Preparing ${selectedBrandsWithTask.length} tier 1 task exports...`);
      const { csvContent, filename, totalRows } = await buildCombinedTierOneTaskExportCsv({
        brands: selectedBrandsWithTask,
        limitPerTask,
        onProgress: ({ currentBrand, doneBrands, totalBrands, totalRows: progressRows }) => {
          setExportProgress(`Preparing ${currentBrand} (${doneBrands}/${totalBrands}) · ${progressRows} rows`);
        },
      });
      downloadExportFile(csvContent, "text/csv;charset=utf-8;", filename);
      setExportProgress(`Downloaded Tier 1 export · ${totalRows} rows.`);
    } catch (err) {
      setError(err.message || "Failed to export selected tier 1 task rows.");
      setExportProgress("");
    } finally {
      setExportingTierOne(false);
    }
  }

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
        <EmptyState message={error} tone="danger" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Large Brand List</h2>
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

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="tonal"
            tone="info"
            onClick={toggleFilteredSelection}
            disabled={filteredBrandIds.length === 0 || exportingLatest || exportingAiCurator || exportingTierOne}
          >
            {allFilteredSelected ? "Clear filtered" : "Select filtered"}
          </Button>
          <span className="text-xs text-slate-500">
            {selectedBrands.length} selected
            {someFilteredSelected && !allFilteredSelected ? " · partial filtered selection" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {exportProgress ? <span className="text-xs text-slate-500">{exportProgress}</span> : null}
          <Button
            tone="info"
            onClick={handleExportLatestSelected}
            disabled={selectedBrands.length === 0 || exportingLatest || exportingAiCurator || exportingTierOne}
          >
            {exportingLatest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export 1 Latest CSV ({selectedBrands.length})
          </Button>
          <input
            type="number"
            min="1"
            placeholder="Rows/task"
            value={aiCuratorLimit}
            onChange={(e) => setAiCuratorLimit(e.target.value)}
            disabled={exportingLatest || exportingAiCurator || exportingTierOne}
            className="w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
          />
          <Button
            variant="tonal"
            tone="info"
            onClick={handleExportTierOneSelected}
            disabled={selectedBrandsWithTask.length === 0 || exportingLatest || exportingAiCurator || exportingTierOne}
          >
            {exportingTierOne ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export Tier 1 ({selectedBrandsWithTask.length})
          </Button>
          <Button
            variant="tonal"
            tone="info"
            onClick={handleExportAiCuratorSelected}
            disabled={selectedBrandsWithTask.length === 0 || exportingLatest || exportingAiCurator || exportingTierOne}
          >
            {exportingAiCurator ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            Export AI vs Curator ({selectedBrandsWithTask.length})
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-12 px-3 py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = someFilteredSelected && !allFilteredSelected;
                  }}
                  onChange={toggleFilteredSelection}
                  disabled={filteredBrandIds.length === 0 || exportingLatest || exportingAiCurator || exportingTierOne}
                />
              </th>
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
                <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                  No brands match your search.
                </td>
              </tr>
            ) : (
              paginatedBrands.map((brand) => (
                <tr
                  key={brand.brandId}
                  className="border-b border-slate-100 last:border-b-0 text-slate-700 hover:bg-slate-50"
                >
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={selectedBrandIds.has(String(brand.brandId))}
                      onChange={() => toggleBrandSelection(brand.brandId)}
                      onClick={(e) => e.stopPropagation()}
                      disabled={exportingLatest || exportingAiCurator || exportingTierOne}
                    />
                  </td>
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
                  <td className="px-3 py-2 font-medium">
                    <button
                      type="button"
                      onClick={() => setPickerBrand(brand)}
                      className="text-left text-slate-900 hover:text-blue-700 hover:underline"
                    >
                      {brand.brandName}
                    </button>
                  </td>
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

      {pickerBrand && (
        <ModePickerModal
          brand={pickerBrand}
          onClose={() => setPickerBrand(null)}
          onPick={(mode) => {
            const target = pickerBrand;
            setPickerBrand(null);
            onSelectBrand(target, mode);
          }}
        />
      )}
    </section>
  );
}

export default BrandListPage;
