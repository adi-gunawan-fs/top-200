import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, Loader2, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { fetchDishCurationLinks } from "../lib/dbFetch";

const API_BASE = "http://localhost:3000";
const PAGE_SIZE = 50;

async function fetchLatestAutoeatDishes(brandId) {
  const res = await fetch(`${API_BASE}/api/brand-latest-message?brandId=${brandId}`);
  if (!res.ok) throw new Error(`Failed to fetch dishes: ${res.statusText}`);
  const { rows } = await res.json();

  // Returns { autoeatDishId -> menuAutoeatId }
  const dishMap = new Map();
  for (const row of rows) {
    const message = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
    const menuAutoeatId = message?.menu?.id;
    for (const dish of message?.dishes ?? []) {
      if (dish.id != null) dishMap.set(dish.id, menuAutoeatId);
    }
  }
  return dishMap;
}

async function fetchDishDetails(autoeatDishIds) {
  const res = await fetch(`${API_BASE}/api/brand-dish-details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autoeatDishIds }),
  });
  if (!res.ok) throw new Error(`Failed to fetch dish details: ${res.statusText}`);
  const { rows } = await res.json();
  return rows;
}

function str(v) {
  if (v == null || v === "") return "—";
  return String(v);
}

function CurationList({ items }) {
  if (!Array.isArray(items) || items.length === 0) return <span className="text-slate-400">—</span>;
  return (
    <span>
      {items.map((item, idx) => (
        <span key={idx}>
          {idx > 0 && <span className="text-slate-400">, </span>}
          <span className={item.isCurationEnabled === false ? "text-slate-300" : ""}>{item.name}</span>
        </span>
      ))}
    </span>
  );
}

function LargeBrandDishPage({ brand, onBack }) {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [curationLinks, setCurationLinks] = useState({});

  useEffect(() => {
    setLoading(true);
    setError("");

    fetchLatestAutoeatDishes(brand.brandId)
      .then(async (dishMap) => {
        if (dishMap.size === 0) {
          setDishes([]);
          return;
        }

        const autoeatIds = [...dishMap.keys()];
        const details = await fetchDishDetails(autoeatIds);

        // Attach menuAutoeatId to each dish detail row
        const enriched = details.map((d) => ({
          ...d,
          menuAutoeatId: dishMap.get(d.autoeatDishId),
        }));
        setDishes(enriched);

        // Pass autoeatDishId so the server can look up dishes.id for the URL
        const pairs = enriched.map((d) => ({
          dishId: String(d.autoeatDishId),
          menuAutoeatId: String(d.menuAutoeatId),
        }));
        fetchDishCurationLinks(pairs).then(setCurationLinks).catch(() => {});
      })
      .catch((err) => setError(err.message ?? "Failed to load dishes."))
      .finally(() => setLoading(false));
  }, [brand.brandId]);

  useEffect(() => { setPage(0); }, [search]);

  const visibleDishes = useMemo(() => {
    if (!search.trim()) return dishes;
    const q = search.toLowerCase();
    return dishes.filter((d) => (d.dishName ?? "").toLowerCase().includes(q));
  }, [dishes, search]);

  const totalPages = Math.ceil(visibleDishes.length / PAGE_SIZE);
  const paginated = visibleDishes.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading dishes for {brand.brandName}…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col gap-4">
        <Button onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" />Back</Button>
        <EmptyState message={error} tone="danger" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button onClick={onBack}><ArrowLeft className="h-3.5 w-3.5" />Back</Button>
          <div>
            <h2 className="text-sm font-semibold text-slate-700">{brand.brandName}</h2>
            <p className="text-[11px] text-slate-400">Latest snapshot · {visibleDishes.length} dishes</p>
          </div>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search dish name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[70vh] overflow-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Dish ID</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Dish Name</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Description</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Menu Title</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Menu Title Desc</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Diet Descriptors</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Addon Descriptors</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Allergen Descriptors</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Dish Type</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Course Type</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Main Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Additional Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Choice Ingredients</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Diets</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Allergens</th>
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-4 py-6 text-center text-slate-400">No dishes found.</td>
                </tr>
              ) : (
                paginated.map((dish) => {
                  const link = curationLinks[String(dish.autoeatDishId)] ?? null;
                  return (
                    <tr key={dish.dishId} className="border-b border-slate-100 last:border-b-0 text-slate-700 align-top">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-500">
                        {link ? (
                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {dish.dishId}
                          </a>
                        ) : (
                          dish.dishId
                        )}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900 whitespace-nowrap">{str(dish.dishName)}</td>
                      <td className="px-3 py-2 max-w-xs text-slate-600">{str(dish.dishDescription)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{str(dish.menuTitleName)}</td>
                      <td className="px-3 py-2 max-w-xs text-slate-600">{str(dish.menuTitleDescription)}</td>
                      <td className="px-3 py-2">{str(dish.ingredients)}</td>
                      <td className="px-3 py-2">{str(dish.dietDescriptors)}</td>
                      <td className="px-3 py-2">{str(dish.addonDescriptors)}</td>
                      <td className="px-3 py-2">{str(dish.allergenDescriptors)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{str(dish.dishTypeName)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{str(dish.courseTypeName)}</td>
                      <td className="px-3 py-2"><CurationList items={dish.mainIngredients} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.additionalIngredients} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.choiceIngredients} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.diets} /></td>
                      <td className="px-3 py-2"><CurationList items={dish.allergens} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-2">
            <p className="text-[11px] text-slate-400">Page {page + 1} of {totalPages} · {visibleDishes.length} dishes</p>
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

export default LargeBrandDishPage;
