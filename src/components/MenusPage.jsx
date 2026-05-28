import { useEffect, useState } from "react";
import { Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchMenus, fetchMenuFilterOptions } from "../lib/api";

const PAGE_SIZE = 50;

function MenusPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [cuisineTypeId, setCuisineTypeId] = useState("");
  const [locationTypeId, setLocationTypeId] = useState("");
  const [top200, setTop200] = useState("");
  const [cuisineOptions, setCuisineOptions] = useState([]);
  const [locationOptions, setLocationOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMenuFilterOptions()
      .then((data) => {
        setCuisineOptions(data.cuisineTypes ?? []);
        setLocationOptions(data.locationTypes ?? []);
      })
      .catch((err) => console.error("Failed to fetch filter options:", err));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchMenus({
      page,
      pageSize: PAGE_SIZE,
      search,
      cuisineTypeId: cuisineTypeId ? Number(cuisineTypeId) : null,
      locationTypeId: locationTypeId ? Number(locationTypeId) : null,
      isTop200: top200 === "" ? null : top200 === "true",
    })
      .then((data) => {
        if (cancelled) return;
        setRows(data.rows ?? []);
        setTotal(data.total ?? 0);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Failed to fetch menus:", err);
        setError(err.message || "Failed to load menus.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, search, cuisineTypeId, locationTypeId, top200]);

  useEffect(() => {
    setPage(0);
  }, [search, cuisineTypeId, locationTypeId, top200]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const startIdx = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const endIdx = Math.min(total, (page + 1) * PAGE_SIZE);

  const handleSubmitSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const selectClass =
    "rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-blue-400 focus:outline-none";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Menus</h1>
          <p className="text-xs text-slate-500">Read-only list of INCLUDED menus.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={cuisineTypeId}
            onChange={(e) => setCuisineTypeId(e.target.value)}
            className={selectClass}
          >
            <option value="">All cuisines</option>
            {cuisineOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
          <select
            value={locationTypeId}
            onChange={(e) => setLocationTypeId(e.target.value)}
            className={selectClass}
          >
            <option value="">All locations</option>
            {locationOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
          <select
            value={top200}
            onChange={(e) => setTop200(e.target.value)}
            className={selectClass}
          >
            <option value="">All brands</option>
            <option value="true">Top 200 only</option>
            <option value="false">Not Top 200</option>
          </select>
          <form onSubmit={handleSubmitSearch} className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search brand..."
              className="w-56 rounded-md border border-slate-200 bg-white py-1.5 pl-7 pr-2 text-xs text-slate-700 focus:border-blue-400 focus:outline-none"
            />
          </form>
        </div>
      </div>

      <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Menu ID</th>
              <th className="px-3 py-2.5">Brand</th>
              <th className="px-3 py-2.5">Cuisine Type</th>
              <th className="px-3 py-2.5">Location Type</th>
              <th className="px-3 py-2.5">Dish Count</th>
              <th className="px-3 py-2.5">Top 200</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center">
                  <Loader2 className="mx-auto h-4 w-4 animate-spin text-slate-400" />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-rose-600">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  No menus found.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.menuId} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-[11px] text-slate-600">{row.menuId}</td>
                  <td className="px-3 py-2">{row.brandName}</td>
                  <td className="px-3 py-2">{row.cuisineType ?? "—"}</td>
                  <td className="px-3 py-2">{row.locationType ?? "—"}</td>
                  <td className="px-3 py-2 tabular-nums">{row.dishCount ?? 0}</td>
                  <td className="px-3 py-2">
                    {row.isTop200 ? (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                        Yes
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <div>
          {total === 0 ? "0 results" : `${startIdx}–${endIdx} of ${total}`}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Prev
          </button>
          <span className="tabular-nums">
            Page {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={page >= pageCount - 1 || loading}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 enabled:hover:bg-slate-50 disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default MenusPage;
