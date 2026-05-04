const API_BASE = "http://localhost:3000";

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

// Fetches the 2 latest messages for a single menu, returns them as parsed rows.
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

// Fetches all pages of 2-latest-per-menu messages for a brand.
// Calls onRow for each row as pages arrive so the grouper processes incrementally.
export async function streamMessages(brandId, { onRow, onProgress } = {}) {
  let cursor = 0;
  let totalRows = 0;

  while (true) {
    const params = new URLSearchParams({ brandId, cursor, pageSize: 500 });
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
