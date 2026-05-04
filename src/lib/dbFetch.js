const API_BASE = "http://localhost:3000";

export async function fetchBrands() {
  const res = await fetch(`${API_BASE}/api/brands`);
  if (!res.ok) throw new Error(`Failed to fetch brands: ${res.statusText}`);
  return res.json();
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
