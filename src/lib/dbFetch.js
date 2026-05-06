import { saveUpload } from "./csvUploads";

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
// Calls onRow for each row as pages arrive so the grouper processes incrementally.
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

// Fetches dishSnapshots for a given dishId created after afterDate (ISO string).
export async function fetchDishSnapshots(dishId, afterDate) {
  const params = new URLSearchParams({ dishId, afterDate });
  const res = await fetch(`${API_BASE}/api/dish-snapshots?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch dish snapshots: ${res.statusText}`);
  const { rows } = await res.json();
  return rows;
}

// Builds a CSV from the two selected records (beforeRecord, afterRecord) and saves to Supabase.
// Fetches all dish snapshots (created after beforeRecord.createdAt) and bakes them into the after row.
// Returns the saved upload record.
export async function exportSingleBrandToCSV(beforeRecord, afterRecord, brandName, userId, { onProgress } = {}) {
  // Collect all dish autoeat IDs from the after message
  const dishes = afterRecord.message?.dishes ?? [];
  const total = dishes.length;
  let done = 0;

  const snapshotsMap = {};
  await Promise.all(
    dishes.map(async (dish) => {
      if (!dish?.id) return;
      try {
        const rows = await fetchDishSnapshots(dish.id, beforeRecord.createdAt);
        snapshotsMap[dish.id] = rows;
      } catch {
        snapshotsMap[dish.id] = [];
      } finally {
        done += 1;
        onProgress?.({ done, total });
      }
    })
  );

  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };

  const toRow = (r, snapshots) => {
    const cols = [r.id, r.createdAt ?? "", r.updatedAt ?? "", JSON.stringify(r.message)];
    if (snapshots !== undefined) cols.push(JSON.stringify(snapshots));
    return cols.map(escape).join(",");
  };

  const header = "id,createdAt,updatedAt,message,snapshots";
  const body = [
    toRow(beforeRecord, undefined),   // before row — no snapshots column value
    toRow(afterRecord, snapshotsMap), // after row — snapshots baked in
  ].join("\n");
  const csvContent = `${header}\n${body}`;

  const now = new Date();
  const label = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const name = `${String(brandName ?? "Brand").trim()} — ${label}`;

  const csvBytes = new TextEncoder().encode(csvContent);
  const compressionStream = new CompressionStream("gzip");
  const writer = compressionStream.writable.getWriter();
  writer.write(csvBytes);
  writer.close();
  const compressedChunks = [];
  const reader = compressionStream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    compressedChunks.push(value);
  }
  const compressedBytes = new Uint8Array(compressedChunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const chunk of compressedChunks) { compressedBytes.set(chunk, offset); offset += chunk.length; }
  const file = new File([compressedBytes], `${name}.csv.gz`, { type: "application/gzip" });

  const saved = await saveUpload(name, file, userId);
  return saved;
}

// Streams messages for every top-200 brand, builds a CSV, and saves it to Supabase.
// onProgress({ done, brandsDone, brandsTotal, totalRows }) fires as work proceeds.
// Returns the saved upload record.
export async function exportAllBrandsToCSV(userId, { onProgress } = {}) {
  const overviewRes = await fetch(`${API_BASE}/api/overview`);
  if (!overviewRes.ok) throw new Error("Failed to fetch overview");
  const { rows: overviewRows } = await overviewRes.json();

  // Deduplicate brand IDs while preserving order
  const seen = new Set();
  const brands = [];
  for (const r of overviewRows) {
    if (!seen.has(r.brandId)) {
      seen.add(r.brandId);
      brands.push({ id: r.brandId, name: r.brandName });
    }
  }

  const brandsTotal = brands.length;
  let brandsDone = 0;
  let totalRows = 0;
  const csvRows = [];

  // Process brands in batches of 10 in parallel
  const BATCH = 10;
  for (let i = 0; i < brands.length; i += BATCH) {
    const batch = brands.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (brand) => {
        await streamMessages({ brandId: brand.id }, {
          onRow: (row) => {
            csvRows.push({
              id: row.id,
              createdAt: row.createdAt ?? "",
              updatedAt: row.updatedAt ?? "",
              message: JSON.stringify(row.message),
            });
          },
        });
        brandsDone += 1;
        totalRows = csvRows.length;
        onProgress?.({ done: false, brandsDone, brandsTotal, totalRows });
      }),
    );
  }

  // Build CSV string
  const escape = (v) => {
    const s = String(v ?? "");
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const header = "id,createdAt,updatedAt,message";
  const body = csvRows.map((r) => [r.id, r.createdAt, r.updatedAt, r.message].map(escape).join(",")).join("\n");
  const csvContent = `${header}\n${body}`;

  const now = new Date();
  const label = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const name = `All Brands — ${label}`;

  // Gzip before upload — repetitive JSON compresses ~10:1, keeping well under the 50MB limit
  const csvBytes = new TextEncoder().encode(csvContent);
  const compressionStream = new CompressionStream("gzip");
  const writer = compressionStream.writable.getWriter();
  writer.write(csvBytes);
  writer.close();
  const compressedChunks = [];
  const reader = compressionStream.readable.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    compressedChunks.push(value);
  }
  const compressedBytes = new Uint8Array(compressedChunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const chunk of compressedChunks) { compressedBytes.set(chunk, offset); offset += chunk.length; }
  const file = new File([compressedBytes], `${name}.csv.gz`, { type: "application/gzip" });

  const saved = await saveUpload(name, file, userId);
  onProgress?.({ done: true, brandsDone, brandsTotal, totalRows });
  return saved;
}
