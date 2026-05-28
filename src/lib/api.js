// HTTP API client for the local Express server (server/index.js).
// Pure fetch wrappers — no CSV/export concerns live here.

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000";

export async function fetchBrands() {
  const res = await fetch(`${API_BASE}/api/brands`);
  if (!res.ok) throw new Error(`Failed to fetch brands: ${res.statusText}`);
  return res.json();
}

// Fetches all overview rows (all top-200 INCLUDED menus with latest message date).
// Paginates internally and returns the full flat array.
export async function fetchOverview() {
  const res = await fetch(`${API_BASE}/api/overview`);
  if (!res.ok) throw new Error(`Failed to fetch overview: ${res.statusText}`);
  const { rows } = await res.json();
  return rows;
}

// Fetches all messages for a single menu (newest first), returns them as parsed rows.
export async function fetchMenuMessages(menuId) {
  const res = await fetch(`${API_BASE}/api/menu-messages?menuId=${menuId}`);
  if (!res.ok) throw new Error(`Failed to fetch menu messages: ${res.statusText}`);
  const { rows } = await res.json();
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    createdAtMs: row.createdAt ? Date.parse(row.createdAt) : 0,
    updatedAt: row.updatedAt,
    updatedAtMs: row.updatedAt ? Date.parse(row.updatedAt) : 0,
    message: typeof row.message === "string" ? JSON.parse(row.message) : row.message,
  }));
}

// Fetches all pages of 2-latest-per-menu messages for a brand or single menu.
// Pass { brandId } for all menus of a brand, or { menuId } for a single menu (menus.id).
export async function streamMessages({ brandId, menuId } = {}, { onRow, onProgress } = {}) {
  let cursor = 0;
  let totalRows = 0;

  while (true) {
    const params = new URLSearchParams({ cursor, pageSize: 500 });
    if (menuId) params.set("menuId", menuId);
    else params.set("brandId", brandId);
    const res = await fetch(`${API_BASE}/api/messages?${params}`);
    if (!res.ok) throw new Error(`Failed to fetch messages: ${res.statusText}`);

    const { rows, nextCursor } = await res.json();

    for (const row of rows) {
      const message = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
      onRow?.({
        id: row.id,
        createdAt: row.createdAt,
        createdAtMs: row.createdAt ? Date.parse(row.createdAt) : 0,
        updatedAt: row.updatedAt,
        updatedAtMs: row.updatedAt ? Date.parse(row.updatedAt) : 0,
        message,
      });
    }

    totalRows += rows.length;
    onProgress?.({ totalRows, done: !nextCursor });

    if (!nextCursor) break;
    cursor = nextCursor;
  }

  return { totalRows };
}

export async function fetchDishSnapshots(dishId, afterDate) {
  const params = new URLSearchParams({ dishId });
  if (afterDate) params.set("afterDate", afterDate);
  const res = await fetch(`${API_BASE}/api/dish-snapshots?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch dish snapshots: ${res.statusText}`);
  const { rows } = await res.json();
  return rows;
}

export async function fetchDishCurationLinks(dishMenuPairs) {
  const cleanedPairs = (dishMenuPairs ?? [])
    .filter((pair) => pair && pair.dishId !== null && pair.dishId !== undefined && pair.menuAutoeatId !== null && pair.menuAutoeatId !== undefined)
    .map((pair) => ({ dishId: String(pair.dishId), menuAutoeatId: String(pair.menuAutoeatId) }));

  if (cleanedPairs.length === 0) return {};

  const res = await fetch(`${API_BASE}/api/dish-curation-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pairs: cleanedPairs }),
  });
  if (!res.ok) throw new Error(`Failed to fetch dish curation links: ${res.statusText}`);
  const { rows } = await res.json();

  const map = {};
  (rows ?? []).forEach((row) => {
    const key = String(row?.dishId ?? "");
    if (!key) return;
    map[key] = row?.url ?? null;
  });
  return map;
}

export async function fetchPublishedDishIds(dishIds) {
  const cleanedDishIds = (dishIds ?? [])
    .filter((id) => id !== null && id !== undefined)
    .map((id) => String(id));

  if (cleanedDishIds.length === 0) return new Set();

  const res = await fetch(`${API_BASE}/api/published-dishes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dishIds: cleanedDishIds }),
  });
  if (!res.ok) throw new Error(`Failed to fetch published dishes: ${res.statusText}`);
  const { dishIds: publishedDishIds } = await res.json();
  return new Set((publishedDishIds ?? []).map((id) => String(id)));
}

export async function fetchBrandLatestMessageRows(brandId) {
  const res = await fetch(`${API_BASE}/api/brand-latest-message?brandId=${brandId}`);
  if (!res.ok) throw new Error(`Failed to fetch latest brand messages: ${res.statusText}`);
  const { rows } = await res.json();
  return rows ?? [];
}

export async function fetchBrandDishDetails(autoeatDishIds) {
  const res = await fetch(`${API_BASE}/api/brand-dish-details`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autoeatDishIds }),
  });
  if (!res.ok) throw new Error(`Failed to fetch dish details: ${res.statusText}`);
  const { rows } = await res.json();
  return rows ?? [];
}

export async function fetchBrandsList() {
  const res = await fetch(`${API_BASE}/api/brands-list`);
  if (!res.ok) throw new Error(`Failed to fetch brands: ${res.statusText}`);
  const data = await res.json();
  return data.rows || [];
}

export async function fetchBrandMessageTimestamps(brandId) {
  const res = await fetch(`${API_BASE}/api/brand-message-timestamps?brandId=${brandId}`);
  if (!res.ok) throw new Error(`Failed to fetch timestamps: ${res.statusText}`);
  const { rows } = await res.json();
  return rows;
}

export async function fetchBrandSnapshotRowsAsOf(brandId, asOf) {
  const res = await fetch(`${API_BASE}/api/brand-message-asof?brandId=${brandId}&asOf=${encodeURIComponent(asOf)}`);
  if (!res.ok) throw new Error(`Failed to fetch snapshot: ${res.statusText}`);
  const { rows } = await res.json();
  return rows;
}

export async function fetchMenus({
  page = 0,
  pageSize = 50,
  search = "",
  cuisineTypeId = null,
  locationTypeId = null,
  isTop200 = null,
} = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) params.set("search", search);
  if (cuisineTypeId) params.set("cuisineTypeId", String(cuisineTypeId));
  if (locationTypeId) params.set("locationTypeId", String(locationTypeId));
  if (isTop200 === true || isTop200 === false) params.set("isTop200", String(isTop200));
  const res = await fetch(`${API_BASE}/api/menus?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch menus: ${res.statusText}`);
  return res.json();
}

export async function fetchMenuFilterOptions() {
  const res = await fetch(`${API_BASE}/api/menu-filter-options`);
  if (!res.ok) throw new Error(`Failed to fetch menu filter options: ${res.statusText}`);
  return res.json();
}

export async function fetchMenusRandomSample({ limit = 500, search = "", cuisineTypeId = null, locationTypeId = null, isTop200 = null } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (search) params.set("search", search);
  if (cuisineTypeId) params.set("cuisineTypeId", String(cuisineTypeId));
  if (locationTypeId) params.set("locationTypeId", String(locationTypeId));
  if (isTop200 === true || isTop200 === false) params.set("isTop200", String(isTop200));
  const res = await fetch(`${API_BASE}/api/menus-random-sample?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch random menus: ${res.statusText}`);
  return res.json();
}

export async function fetchMenuDishExport(menuId) {
  const res = await fetch(`${API_BASE}/api/menu-dish-export?menuId=${menuId}`);
  if (!res.ok) throw new Error(`Failed to fetch menu dish export: ${res.statusText}`);
  return res.json();
}

export async function fetchMenuCurationTaskAiCuratorExportRows(taskId, limitPerTask) {
  const params = new URLSearchParams({ taskId: String(taskId) });
  if (Number.isFinite(limitPerTask) && limitPerTask > 0) {
    params.set("limit", String(limitPerTask));
  }
  const res = await fetch(`${API_BASE}/api/menu-curation-task-ai-curator-export?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch task export rows: ${res.statusText}`);
  const { rows } = await res.json();
  return rows ?? [];
}

export async function fetchMenuCurationTaskTierOneExportRows(taskId, limitPerTask) {
  const params = new URLSearchParams({ taskId: String(taskId) });
  if (Number.isFinite(limitPerTask) && limitPerTask > 0) {
    params.set("limit", String(limitPerTask));
  }
  const res = await fetch(`${API_BASE}/api/menu-curation-task-tier-one-export?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch tier 1 task export rows: ${res.statusText}`);
  const { rows } = await res.json();
  return rows ?? [];
}

