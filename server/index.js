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

if (!process.env.BRAND_LIST) {
  console.error("Missing BRAND_LIST in environment variables.");
  process.exit(1);
}

const BRAND_IDS = process.env.BRAND_LIST.split(",").map((s) => parseInt(s.trim(), 10)).filter(Boolean);

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// GET /api/brands — all brands in BRAND_LIST
app.get("/api/brands", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id, b.name
       FROM menus m
       INNER JOIN brands b ON b.id = m."brandId"
       WHERE m."autoeatId" = ANY($1)
         AND m."status" = 'INCLUDED'
         AND m."isPublished" = true
       GROUP BY b.id, b.name
       ORDER BY b.name ASC`,
      [BRAND_IDS],
    );
    res.json(rows);
  } catch (err) {
    console.error("brands error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/overview
// One row per INCLUDED+published menu whose autoeatId is in BRAND_LIST.
app.get("/api/overview", async (_req, res) => {
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
       WHERE m."autoeatId" = ANY($1)
         AND m."status" = 'INCLUDED'
         AND m."isPublished" = true
       ORDER BY b.name ASC, m.id ASC`,
      [BRAND_IDS],
    );

    res.json({ rows, nextCursor: null });
  } catch (err) {
    console.error("overview error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/menu-messages?menuId=X
// Returns all autoeatMessages for a single menu, newest first.
app.get("/api/menu-messages", async (req, res) => {
  const menuId = parseInt(req.query.menuId, 10);
  if (!menuId) return res.status(400).json({ error: "menuId required" });

  try {
    // menuId here is menus.id — look up the autoeatId first, then fetch via indexed menuId column
    const { rows: menuRows } = await pool.query(
      `SELECT "autoeatId" FROM menus WHERE id = $1 AND "autoeatId" IS NOT NULL LIMIT 1`,
      [menuId],
    );
    if (menuRows.length === 0) return res.json({ rows: [] });

    const { rows } = await pool.query(
      `SELECT id, "createdAt", "updatedAt", message
       FROM "autoeatMessages"
       WHERE type = 'MENU_FOR_CURATION'
         AND "createdAt" > '2025-01-01 00:00:00+00'
         AND "menuId" = $1
       ORDER BY "createdAt" DESC`,
      [menuRows[0].autoeatId],
    );

    res.json({ rows });
  } catch (err) {
    console.error("menu-messages error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/messages?brandId=X&cursor=0  — all INCLUDED menus for a DB brand ID
// GET /api/messages?menuId=X&cursor=0   — single menu by menus.id (looks up autoeatId)
// 2 latest autoeatMessages per autoeatId, paginated via cursor on id.
app.get("/api/messages", async (req, res) => {
  const brandId = parseInt(req.query.brandId, 10);
  const menuId = parseInt(req.query.menuId, 10);
  if (!brandId && !menuId) return res.status(400).json({ error: "brandId or menuId required" });

  const cursor = parseInt(req.query.cursor ?? "0", 10);
  const pageSize = 500;

  try {
    let rows;

    if (menuId) {
      // menuId here is the autoeat menu ID (message.menu.id) — query directly
      ({ rows } = await pool.query(
        `SELECT id, "createdAt", "updatedAt", message
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
           WHERE am.type = 'MENU_FOR_CURATION'
             AND am."createdAt" > '2025-01-01 00:00:00+00'
             AND am."menuId" = $1
             AND am.id > $2
         ) ranked
         WHERE rn <= 2
         ORDER BY id ASC
         LIMIT $3`,
        [menuId, cursor, pageSize],
      ));
    } else {
      ({ rows } = await pool.query(
        `SELECT id, "createdAt", "updatedAt", message
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
           INNER JOIN menus m ON m."autoeatId" = am."menuId"
           WHERE am.type = 'MENU_FOR_CURATION'
             AND am."createdAt" > '2025-01-01 00:00:00+00'
             AND m."brandId" = $1
             AND m."status" = 'INCLUDED'
             AND am.id > $2
         ) ranked
         WHERE rn <= 2
         ORDER BY id ASC
         LIMIT $3`,
        [brandId, cursor, pageSize],
      ));
    }

    const nextCursor = rows.length === pageSize ? rows[rows.length - 1].id : null;
    res.json({ rows, nextCursor });
  } catch (err) {
    console.error("messages error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dish-snapshots?autoeatDishId=X&afterDate=Y
// Returns dishSnapshots for the given autoeat dish ID created after the given date.
// Resolves: autoeatDishId -> dishes.autoeatId -> dishes.id -> dishSnapshots.dishId
app.get("/api/dish-snapshots", async (req, res) => {
  const autoeatDishId = parseInt(req.query.dishId, 10);
  const afterDate = req.query.afterDate;
  if (!autoeatDishId) return res.status(400).json({ error: "dishId required" });
  if (!afterDate) return res.status(400).json({ error: "afterDate required" });

  try {
    const { rows } = await pool.query(
      `SELECT
         ds."id",
         ds."dishId",
         ds."type",
         ds."createdAt",
         a.name                           AS "dishType",
         b.name                           AS "courseType",
         diets_agg.names                  AS "diets",
         allergens_agg.names              AS "allergens",
         main_ing_agg.names               AS "mainIngredients",
         choice_ing_agg.names             AS "choiceIngredients",
         additional_ing_agg.names         AS "additionalIngredients",
         ds."certainty",
         ds."tier",
         ds."areIngredientsInAgreement",
         ds."miscAndChoiceCertainty",
         ds."dishTypeCertainty",
         ds."courseTypeCertainty",
         ds."dietsCertainty",
         ds."allergensCertainty",
         ds."ingredientsCertainty"
       FROM "dishes" dsh
       JOIN "dishSnapshots" ds ON ds."dishId" = dsh."id"
       LEFT JOIN "dishTypes" a ON a.id = ds."dishTypeId"
       LEFT JOIN "courseTypes" b ON b.id = ds."courseTypeId"
       LEFT JOIN LATERAL (
         SELECT ARRAY_AGG(d.name ORDER BY d.name) AS names
         FROM UNNEST(ds."dietIds") uid
         LEFT JOIN "diets" d ON d.id = uid
       ) diets_agg ON true
       LEFT JOIN LATERAL (
         SELECT ARRAY_AGG(al.name ORDER BY al.name) AS names
         FROM UNNEST(ds."allergenIds") uaid
         LEFT JOIN "allergens" al ON al.id = uaid
       ) allergens_agg ON true
       LEFT JOIN LATERAL (
         SELECT ARRAY_AGG(i.name ORDER BY i.name) AS names
         FROM UNNEST(ds."mainIngredientIds") umid
         LEFT JOIN "ingredients" i ON i.id = umid
       ) main_ing_agg ON true
       LEFT JOIN LATERAL (
         SELECT ARRAY_AGG(i.name ORDER BY i.name) AS names
         FROM UNNEST(ds."choiceIngredientIds") ucid
         LEFT JOIN "ingredients" i ON i.id = ucid
       ) choice_ing_agg ON true
       LEFT JOIN LATERAL (
         SELECT ARRAY_AGG(i.name ORDER BY i.name) AS names
         FROM UNNEST(ds."additionalIngredientIds") uaid
         LEFT JOIN "ingredients" i ON i.id = uaid
       ) additional_ing_agg ON true
       WHERE dsh."autoeatId" = $1
         AND ds."createdAt" > $2
       ORDER BY ds."createdAt" DESC`,
      [autoeatDishId, afterDate],
    );
    res.json({ rows });
  } catch (err) {
    console.error("dish-snapshots error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
