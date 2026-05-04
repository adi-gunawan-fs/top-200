import "dotenv/config";
import express from "express";
import cors from "cors";
import pg from "pg";

const { Pool } = pg;

const PORT = process.env.SERVER_PORT ?? 3000;

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in environment variables.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// GET /api/brands — all isTop200 brands
app.get("/api/brands", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM brands WHERE "isTop200" = true ORDER BY name ASC`,
    );
    res.json(rows);
  } catch (err) {
    console.error("brands error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/overview?cursor=0
// One row per INCLUDED menu across all top-200 brands, with latest autoeatMessage date.
// Client-side pagination — returns 100 rows per page via id cursor.
app.get("/api/overview", async (req, res) => {
  const cursor = parseInt(req.query.cursor ?? "0", 10);
  const pageSize = 100;

  try {
    const { rows } = await pool.query(
      `SELECT
         m.id        AS "menuId",
         m."autoeatId",
         m.url       AS "menuUrl",
         b.id        AS "brandId",
         b.name      AS "brandName"
       FROM menus m
       INNER JOIN brands b ON b.id = m."brandId"
       WHERE b."isTop200" = true
         AND m."status" = 'INCLUDED'
         AND m.id > $1
       ORDER BY b.name ASC, m.id ASC
       LIMIT $2`,
      [cursor, pageSize],
    );

    const nextCursor = rows.length === pageSize ? rows[rows.length - 1].menuId : null;
    res.json({ rows, nextCursor });
  } catch (err) {
    console.error("overview error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/menu-messages?menuId=X
// Returns exactly the 2 latest autoeatMessages for a single menu.
app.get("/api/menu-messages", async (req, res) => {
  const menuId = parseInt(req.query.menuId, 10);
  if (!menuId) return res.status(400).json({ error: "menuId required" });

  try {
    const { rows: menuRows } = await pool.query(
      `SELECT "autoeatId" FROM menus WHERE id = $1 AND "autoeatId" IS NOT NULL LIMIT 1`,
      [menuId],
    );

    if (menuRows.length === 0) return res.json({ rows: [] });

    const autoeatId = String(menuRows[0].autoeatId);

    const { rows } = await pool.query(
      `SELECT id, "createdAt", "updatedAt", message
       FROM "autoeatMessages"
       WHERE type = 'MENU_FOR_CURATION'
         AND "createdAt" > '2025-01-01 00:00:00+00'
         AND message -> 'menu' ->> 'id' = $1
       ORDER BY "createdAt" DESC
       LIMIT 2`,
      [autoeatId],
    );

    res.json({ rows });
  } catch (err) {
    console.error("menu-messages error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages?brandId=X&cursor=0
// 1. Get autoeatIds from menus where brandId = X and status = INCLUDED
// 2. Get 2 latest autoeatMessages per autoeatId (by createdAt DESC)
// 3. Paginate via cursor on id (safe on large tables, no OFFSET drift)
app.get("/api/messages", async (req, res) => {
  const brandId = parseInt(req.query.brandId, 10);
  if (!brandId) return res.status(400).json({ error: "brandId required" });

  const cursor = parseInt(req.query.cursor ?? "0", 10);
  const pageSize = 500;

  try {
    // Step 1: get autoeatIds for this brand's INCLUDED menus (small result, fast)
    const { rows: menuRows } = await pool.query(
      `SELECT "autoeatId" FROM menus
       WHERE "brandId" = $1 AND "status" = 'INCLUDED' AND "autoeatId" IS NOT NULL`,
      [brandId],
    );

    if (menuRows.length === 0) {
      return res.json({ rows: [], nextCursor: null });
    }

    const autoeatIds = menuRows.map((r) => String(r.autoeatId));

    // Step 2: get 2 latest autoeatMessages per autoeatId via JSON match + window function
    const { rows } = await pool.query(
      `SELECT id, "createdAt", "updatedAt", message
       FROM (
         SELECT
           id,
           "createdAt",
           "updatedAt",
           message,
           ROW_NUMBER() OVER (
             PARTITION BY message -> 'menu' ->> 'id'
             ORDER BY "createdAt" DESC
           ) AS rn
         FROM "autoeatMessages"
         WHERE type = 'MENU_FOR_CURATION'
           AND "createdAt" > '2025-01-01 00:00:00+00'
           AND message -> 'menu' ->> 'id' = ANY($1)
           AND id > $2
       ) ranked
       WHERE rn <= 2
       ORDER BY id ASC
       LIMIT $3`,
      [autoeatIds, cursor, pageSize],
    );

    const nextCursor = rows.length === pageSize ? rows[rows.length - 1].id : null;
    res.json({ rows, nextCursor });
  } catch (err) {
    console.error("messages error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
