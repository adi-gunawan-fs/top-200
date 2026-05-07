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

// GET /api/dish-snapshots?dishId=X[&afterDate=Y]
// Returns dishSnapshots for the given autoeat dish ID.
// If afterDate is provided, returns snapshots created after that date.
// Resolves: autoeatDishId -> dishes.autoeatId -> dishes.id -> dishSnapshots.dishId
app.get("/api/dish-snapshots", async (req, res) => {
  const autoeatDishId = parseInt(req.query.dishId, 10);
  const afterDate = req.query.afterDate;
  if (!autoeatDishId) return res.status(400).json({ error: "dishId required" });

  try {
    const values = [autoeatDishId];
    let createdAtFilter = "";
    if (afterDate) {
      values.push(afterDate);
      createdAtFilter = ` AND ds."createdAt" > $2`;
    }

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
         ${createdAtFilter}
       ORDER BY ds."createdAt" DESC`,
      values,
    );
    res.json({ rows });
  } catch (err) {
    console.error("dish-snapshots error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dish-curation-links
// Body: { pairs: [{ dishId: "123", menuAutoeatId: "456" }] }
// Read-only lookup for menu-curation task link per dish.
app.post("/api/dish-curation-links", async (req, res) => {
  const pairs = Array.isArray(req.body?.pairs) ? req.body.pairs : [];
  if (pairs.length === 0) return res.json({ rows: [] });

  const normalizedPairs = pairs
    .map((pair) => ({
      dishId: parseInt(pair?.dishId, 10),
      menuAutoeatId: parseInt(pair?.menuAutoeatId, 10),
    }))
    .filter((pair) => Number.isFinite(pair.dishId) && Number.isFinite(pair.menuAutoeatId));

  if (normalizedPairs.length === 0) return res.json({ rows: [] });

  const uniqueAutoeatIds = [...new Set(normalizedPairs.map((pair) => pair.menuAutoeatId))];

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (m."autoeatId")
         m."autoeatId" AS "menuAutoeatId",
         mct.id        AS "menuCurationTaskId"
       FROM menus m
       LEFT JOIN "menuCurationTasks" mct ON mct."menuId" = m.id
       WHERE m."autoeatId" = ANY($1)
         AND m."status" = 'INCLUDED'
         AND m."isPublished" = true
       ORDER BY m."autoeatId", mct.id DESC NULLS LAST`,
      [uniqueAutoeatIds],
    );

    const taskByAutoeatId = new Map(
      rows
        .filter((row) => row.menuCurationTaskId !== null && row.menuCurationTaskId !== undefined)
        .map((row) => [String(row.menuAutoeatId), row.menuCurationTaskId]),
    );

    const out = normalizedPairs.map((pair) => {
      const taskId = taskByAutoeatId.get(String(pair.menuAutoeatId)) ?? null;
      const url = taskId
        ? `https://menu-curator.foodstyles.com/menu-curation-tasks/${taskId}?dishIds%5B0%5D=${pair.dishId}&shouldScrollToDish=true`
        : null;

      return {
        dishId: String(pair.dishId),
        menuAutoeatId: String(pair.menuAutoeatId),
        menuCurationTaskId: taskId,
        url,
      };
    });

    res.json({ rows: out });
  } catch (err) {
    console.error("dish-curation-links error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/published-dishes
// Body: { dishIds: ["123", "456"] }
// Read-only lookup: returns autoeat dish IDs that are published in DB.
app.post("/api/published-dishes", async (req, res) => {
  const dishIds = Array.isArray(req.body?.dishIds) ? req.body.dishIds : [];
  if (dishIds.length === 0) return res.json({ dishIds: [] });

  const normalizedDishIds = dishIds
    .map((id) => parseInt(id, 10))
    .filter((id) => Number.isFinite(id));

  if (normalizedDishIds.length === 0) return res.json({ dishIds: [] });

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT d."autoeatId" AS "dishId"
       FROM "dishes" d
       WHERE d."autoeatId" = ANY($1)
         AND d."isPublished" = true`,
      [normalizedDishIds],
    );

    res.json({ dishIds: rows.map((row) => String(row.dishId)) });
  } catch (err) {
    console.error("published-dishes error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/brands-list
// Returns all brands in BRAND_LIST with their autoeatId, menu curator task IDs, and curation status.
app.get("/api/brands-list", async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (b.id)
         m."autoeatId",
         b.id        AS "brandId",
         b.name      AS "brandName",
         mct.id      AS "menuCurationTaskId",
         mct."isTierOneDone",
         mct."isCurationDone",
         mct."isQaDone",
         mct."isQcDone"
       FROM menus m
       INNER JOIN brands b ON b.id = m."brandId"
       LEFT JOIN "menuCurationTasks" mct ON mct."menuId" = m.id
       WHERE m."autoeatId" = ANY($1)
         AND m."status" = 'INCLUDED'
         AND m."isPublished" = true
       ORDER BY b.id, mct.id DESC NULLS LAST`,
      [BRAND_IDS],
    );

    res.json({ rows });
  } catch (err) {
    console.error("brands-list error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
