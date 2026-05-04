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
    const { rows } = await pool.query(
      `SELECT am.id, am."createdAt", am."updatedAt", am.message
       FROM (
         SELECT
           am.id,
           am."createdAt",
           am."updatedAt",
           am.message,
           ROW_NUMBER() OVER (
             PARTITION BY am."menuId"
             ORDER BY am."createdAt" DESC
           ) AS rn
         FROM "autoeatMessages" am
         INNER JOIN menus m ON m.id = am."menuId"
         WHERE am.type = 'MENU_FOR_CURATION'
           AND am."createdAt" > '2025-01-01 00:00:00+00'
           AND m."brandId" = $1
           AND m."status" = 'INCLUDED'
       ) ranked
       WHERE rn <= 2
         AND id > $2
       ORDER BY id ASC
       LIMIT $3`,
      [brandId, cursor, pageSize],
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
