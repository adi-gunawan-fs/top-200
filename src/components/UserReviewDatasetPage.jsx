import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import datasetRaw from "../../dataset/user-review-dataset-big-2026-04-27.jsonl?raw";

const PAGE_SIZE = 50;

const COLUMNS = [
  { key: "id", label: "ID" },
  { key: "brandName", label: "Brand" },
  { key: "restaurantType", label: "Restaurant Type" },
  { key: "cuisine", label: "Cuisine" },
  { key: "totalReviewCount", label: "Reviews" },
  { key: "totalReviewCountCategory", label: "Reviews Cat." },
  { key: "overallRating", label: "Rating" },
  { key: "overallRatingCategory", label: "Rating Cat." },
  { key: "brandSize", label: "Brand Size" },
  { key: "brandLocationCount", label: "Locations" },
  { key: "isMessy", label: "Messy" },
  { key: "autoeatLocationId", label: "Autoeat Loc ID" },
  { key: "menuCuratorLocationId", label: "Menu Curator Loc ID" },
];

function parseDataset(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      const m = obj.metadata ?? {};
      rows.push({
        id: obj.id,
        input: obj.input ?? "",
        brandName: m.brandName ?? "",
        restaurantType: m.restaurantType ?? "",
        cuisine: m.cuisine ?? "",
        totalReviewCount: m.totalReviewCount ?? "",
        totalReviewCountCategory: m.totalReviewCountCategory ?? "",
        overallRating: m.overallRating ?? "",
        overallRatingCategory: m.overallRatingCategory ?? "",
        brandSize: m.brandSize ?? "",
        brandLocationCount: m.brandLocationCount ?? "",
        isMessy: m.isMessy === true ? "true" : m.isMessy === false ? "false" : "",
        autoeatLocationId: m.autoeatLocationId ?? "",
        menuCuratorLocationId: m.menuCuratorLocationId ?? "",
      });
    } catch {
      // skip malformed line
    }
  }
  return rows;
}

function UserReviewDatasetPage() {
  const [allRows, setAllRows] = useState(null);
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    // Defer parsing so we paint the loading state first.
    const id = setTimeout(() => {
      setAllRows(parseDataset(datasetRaw));
    }, 0);
    return () => clearTimeout(id);
  }, []);

  const filteredRows = useMemo(() => {
    if (!allRows) return [];
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) =>
      [r.brandName, r.cuisine, r.restaurantType, String(r.id)]
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [allRows, search]);

  const total = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageRows = filteredRows.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  const onSubmitSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(0);
  };

  if (allRows === null) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading dataset…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">User Review Dataset</h2>
          <p className="text-[11px] text-slate-500">
            {total.toLocaleString()} {total === 1 ? "row" : "rows"}
            {search ? ` (filtered from ${allRows.length.toLocaleString()})` : ""}
          </p>
        </div>
        <form onSubmit={onSubmitSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search brand, cuisine, type, id…"
              className="w-72 rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs text-slate-700 outline-none focus:border-blue-400"
            />
          </div>
          <button
            type="submit"
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Search
          </button>
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setSearchInput("");
                setPage(0);
              }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      <div className="overflow-auto rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-[11px] uppercase text-slate-500">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className="whitespace-nowrap border-b border-slate-200 px-3 py-2 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, idx) => (
              <tr key={`${row.id}-${idx}`} className="border-b border-slate-100 hover:bg-slate-50">
                {COLUMNS.map((c) => (
                  <td key={c.key} className="whitespace-nowrap px-3 py-1.5 text-slate-700">
                    {row[c.key] === "" || row[c.key] === null || row[c.key] === undefined ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      String(row[c.key])
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="px-3 py-6 text-center text-xs text-slate-400">
                  No rows match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-600">
        <span>
          Page {currentPage + 1} of {totalPages}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 disabled:opacity-40 hover:bg-slate-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <button
            type="button"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 disabled:opacity-40 hover:bg-slate-50"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default UserReviewDatasetPage;
