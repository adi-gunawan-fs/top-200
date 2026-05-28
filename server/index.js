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

// GET /api/brand-latest-message?brandId=X
// Returns the single latest autoeatMessage per INCLUDED menu for a brand.
app.get("/api/brand-latest-message", async (req, res) => {
  const brandId = parseInt(req.query.brandId, 10);
  if (!brandId) return res.status(400).json({ error: "brandId required" });

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (m."autoeatId")
         am.id,
         am."createdAt",
         am."updatedAt",
         am.message
       FROM menus m
       INNER JOIN "autoeatMessages" am ON am."menuId" = m."autoeatId"
       WHERE m."brandId" = $1
         AND m."status" = 'INCLUDED'
         AND m."isPublished" = true
         AND am.type = 'MENU_FOR_CURATION'
         AND am."createdAt" > '2025-01-01 00:00:00+00'
       ORDER BY m."autoeatId", am."createdAt" DESC`,
      [brandId],
    );
    res.json({ rows });
  } catch (err) {
    console.error("brand-latest-message error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/brand-message-timestamps?brandId=X
// Returns all MENU_FOR_CURATION autoeatMessages for a brand: { id, createdAt, menuId }.
app.get("/api/brand-message-timestamps", async (req, res) => {
  const brandId = parseInt(req.query.brandId, 10);
  if (!brandId) return res.status(400).json({ error: "brandId required" });

  try {
    const { rows } = await pool.query(
      `SELECT am.id, am."createdAt", m."autoeatId" AS "menuId"
       FROM menus m
       INNER JOIN "autoeatMessages" am ON am."menuId" = m."autoeatId"
       WHERE m."brandId" = $1
         AND m."status" = 'INCLUDED'
         AND m."isPublished" = true
         AND am.type = 'MENU_FOR_CURATION'
         AND am."createdAt" > '2025-01-01 00:00:00+00'
       ORDER BY am."createdAt" DESC`,
      [brandId],
    );
    res.json({ rows });
  } catch (err) {
    console.error("brand-message-timestamps error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/brand-message-asof?brandId=X&asOf=ISO
// Returns the latest message per INCLUDED menu at-or-before the asOf timestamp.
app.get("/api/brand-message-asof", async (req, res) => {
  const brandId = parseInt(req.query.brandId, 10);
  const asOf = req.query.asOf;
  if (!brandId) return res.status(400).json({ error: "brandId required" });
  if (!asOf) return res.status(400).json({ error: "asOf required" });

  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (m."autoeatId")
         am.id,
         am."createdAt",
         am."updatedAt",
         am.message
       FROM menus m
       INNER JOIN "autoeatMessages" am ON am."menuId" = m."autoeatId"
       WHERE m."brandId" = $1
         AND m."status" = 'INCLUDED'
         AND m."isPublished" = true
         AND am.type = 'MENU_FOR_CURATION'
         AND am."createdAt" > '2025-01-01 00:00:00+00'
         AND am."createdAt" <= $2
       ORDER BY m."autoeatId", am."createdAt" DESC`,
      [brandId, asOf],
    );
    res.json({ rows });
  } catch (err) {
    console.error("brand-message-asof error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/brand-dish-details
// Body: { autoeatDishIds: [123, 456] }
// Returns full dish data from dishes DB joined with menuTitles, keyed by autoeatId.
app.post("/api/brand-dish-details", async (req, res) => {
  const ids = Array.isArray(req.body?.autoeatDishIds) ? req.body.autoeatDishIds : [];
  if (ids.length === 0) return res.json({ rows: [] });

  const normalized = ids.map((id) => parseInt(id, 10)).filter(Number.isFinite);
  if (normalized.length === 0) return res.json({ rows: [] });

  try {
    const { rows } = await pool.query(
      `SELECT
         d."id"                    AS "dishId",
         d."autoeatId"             AS "autoeatDishId",
         d."name"                  AS "dishName",
         d."description"           AS "dishDescription",
         d."ingredients"           AS "ingredients",
         d."dietDescriptors"       AS "dietDescriptors",
         d."addonDescriptors"      AS "addonDescriptors",
         d."miscDescriptors"       AS "miscDescriptors",
         d."allergenDescriptors"   AS "allergenDescriptors",
         mt."autoeatId"            AS "menuTitleAutoeatId",
         mt."title"                 AS "menuTitleName",
         mt."description"          AS "menuTitleDescription",
         mt."miscDescriptors"      AS "menuTitleMiscDescriptors",
         mt."addonDescriptors"     AS "menuTitleAddonDescriptors",
         mt."dietDescriptors"      AS "menuTitleDietDescriptors",
         mt."allergenDescriptors"  AS "menuTitleAllergenDescriptors",
         dt."name"                 AS "dishTypeName",
         ct."name"                 AS "courseTypeName",
         main_ing.items            AS "mainIngredients",
         add_ing.items             AS "additionalIngredients",
         choice_ing.items          AS "choiceIngredients",
         diets_agg.items           AS "diets",
         allergens_agg.items       AS "allergens"
       FROM "dishes" d
       LEFT JOIN "menuTitles" mt ON mt."autoeatId" = d."menuTitleId"
       LEFT JOIN "dishTypes" dt ON dt."id" = d."dishTypeId"
       LEFT JOIN "courseTypes" ct ON ct."id" = d."courseTypeId"
       LEFT JOIN LATERAL (
         SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('name', i."name", 'isCurationEnabled', i."isCurationEnabled") ORDER BY i."name") FILTER (WHERE i."id" IS NOT NULL), '[]') AS items
         FROM "dishesMainIngredients" dmi JOIN "ingredients" i ON i."id" = dmi."ingredientId" WHERE dmi."dishId" = d."id"
       ) main_ing ON true
       LEFT JOIN LATERAL (
         SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('name', i."name", 'isCurationEnabled', i."isCurationEnabled") ORDER BY i."name") FILTER (WHERE i."id" IS NOT NULL), '[]') AS items
         FROM "dishesAdditionalIngredients" dai JOIN "ingredients" i ON i."id" = dai."ingredientId" WHERE dai."dishId" = d."id"
       ) add_ing ON true
       LEFT JOIN LATERAL (
         SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('name', i."name", 'isCurationEnabled', i."isCurationEnabled") ORDER BY i."name") FILTER (WHERE i."id" IS NOT NULL), '[]') AS items
         FROM "dishesChoiceIngredients" dci JOIN "ingredients" i ON i."id" = dci."ingredientId" WHERE dci."dishId" = d."id"
       ) choice_ing ON true
       LEFT JOIN LATERAL (
         SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('name', di."name", 'isCurationEnabled', di."isCurationEnabled") ORDER BY di."name") FILTER (WHERE di."id" IS NOT NULL), '[]') AS items
         FROM "dishesDiets" dd JOIN "diets" di ON di."id" = dd."dietId" WHERE dd."dishId" = d."id"
       ) diets_agg ON true
       LEFT JOIN LATERAL (
         SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('name', al."name", 'isCurationEnabled', al."isCurationEnabled") ORDER BY al."name") FILTER (WHERE al."id" IS NOT NULL), '[]') AS items
         FROM "dishesAllergens" da JOIN "allergens" al ON al."id" = da."allergenId" WHERE da."dishId" = d."id"
       ) allergens_agg ON true
       WHERE d."autoeatId" = ANY($1)
         AND d."isEnabled" = true
         AND d."isDeleted" = false
         AND d."isFake" = false`,
      [normalized],
    );
    res.json({ rows });
  } catch (err) {
    console.error("brand-dish-details error:", err.message);
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

  const uniqueDishAutoeatIds = [...new Set(normalizedPairs.map((pair) => pair.dishId))];

  try {
    const [menuRows, dishRows] = await Promise.all([
      pool.query(
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
      ),
      pool.query(
        `SELECT d."autoeatId", d."id" AS "dishDbId"
         FROM "dishes" d
         WHERE d."autoeatId" = ANY($1)`,
        [uniqueDishAutoeatIds],
      ),
    ]);

    const taskByAutoeatId = new Map(
      menuRows.rows
        .filter((row) => row.menuCurationTaskId !== null && row.menuCurationTaskId !== undefined)
        .map((row) => [String(row.menuAutoeatId), row.menuCurationTaskId]),
    );

    const dbIdByAutoeatId = new Map(
      dishRows.rows.map((row) => [String(row.autoeatId), row.dishDbId]),
    );

    const out = normalizedPairs.map((pair) => {
      const taskId = taskByAutoeatId.get(String(pair.menuAutoeatId)) ?? null;
      const dishDbId = dbIdByAutoeatId.get(String(pair.dishId)) ?? pair.dishId;
      const url = taskId
        ? `https://menu-curator.foodstyles.com/menu-curation-tasks/${taskId}?dishIds%5B0%5D=${dishDbId}&shouldScrollToDish=true`
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
         AND d."isEnabled" = true`,
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

// GET /api/menu-curation-task-ai-curator-export?taskId=X
// Read-only export rows for a single menu curation task using the AI-vs-curator query shape.
app.get("/api/menu-curation-task-ai-curator-export", async (req, res) => {
  const taskId = parseInt(req.query.taskId, 10);
  const limit = parseInt(req.query.limit ?? "", 10);
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? limit : null;
  if (!taskId) return res.status(400).json({ error: "taskId required" });

  try {
    const { rows } = await pool.query(
      `WITH ai_base AS (
          SELECT DISTINCT ON (ds."dishId")
              brands."name"                AS "brandName",
              cuisine_types."name"         AS "cuisineType",
              location_types."name"        AS "locationType",
              ds."menuCurationTaskId",
              ds."dishId",
              REPLACE(REPLACE(ds."styledName", '<p>', ''), '</p>', '') AS "dishName",
              ds."createdAt",
              ds."dishTypeId",
              ds."courseTypeId",
              ds."dietIds",
              ds."allergenIds",
              ds."mainIngredientIds",
              ds."choiceIngredientIds",
              ds."additionalIngredientIds",
              d."description"              AS "dishDescription",
              d."ingredients",
              d."dietDescriptors",
              d."addonDescriptors",
              d."miscDescriptors",
              d."allergenDescriptors",
              d."menuTitleId"
          FROM "dishSnapshots" ds
          LEFT JOIN "dishes" d              ON d.id = ds."dishId"
          LEFT JOIN "menuCurationTasks" mct ON mct.id = ds."menuCurationTaskId"
          LEFT JOIN "menus"                 ON mct."menuId" = menus.id
          LEFT JOIN "brands"                ON menus."brandId" = brands.id
          LEFT JOIN "cuisineTypes" cuisine_types ON cuisine_types.id = brands."cuisineTypeId"
          LEFT JOIN "locationTypes" location_types ON location_types.id = brands."mainLocationTypeId"
          WHERE ds."menuCurationTaskId" = $1
            AND ds."type" = 'AI'
            AND d."isEnabled" = true
            AND d."isFake" = false
            AND d."isDeleted" = false
            AND ds."createdAt" = (
                SELECT MAX("createdAt")
                FROM "dishSnapshots"
                WHERE "menuCurationTaskId" = $1
                  AND "type" = 'AI'
                  AND "createdAt" < (
                      SELECT MAX("createdAt")
                      FROM "dishSnapshots"
                      WHERE "menuCurationTaskId" = $1
                        AND "type" = 'QC'
                  )
            )
          ORDER BY ds."dishId", ds."createdAt" DESC
      ),
      latest_ai_new_base AS (
          SELECT DISTINCT ON (ds."dishId")
              ds."dishId",
              ds."createdAt"               AS "latestAiCreatedAt",
              ds."dishTypeId"              AS "latestAiDishTypeId",
              ds."courseTypeId"            AS "latestAiCourseTypeId",
              ds."dietIds"                 AS "latestAiDietIds",
              ds."allergenIds"             AS "latestAiAllergenIds",
              ds."mainIngredientIds"       AS "latestAiMainIngredientIds",
              ds."choiceIngredientIds"     AS "latestAiChoiceIngredientIds",
              ds."additionalIngredientIds" AS "latestAiAdditionalIngredientIds"
          FROM "dishSnapshots" ds
          LEFT JOIN "dishes" d ON d.id = ds."dishId"
          WHERE ds."menuCurationTaskId" = $1
            AND ds."type" = 'AI'
            AND d."isEnabled" = true
            AND d."isFake" = false
            AND d."isDeleted" = false
          ORDER BY ds."dishId", ds."createdAt" DESC
      ),
      curator_base AS (
          SELECT DISTINCT ON (ds."dishId")
              ds."dishId",
              ds."createdAt"               AS "curatorCreatedAt",
              ds."dishTypeId",
              ds."courseTypeId",
              ds."dietIds",
              ds."allergenIds",
              ds."mainIngredientIds",
              ds."choiceIngredientIds",
              ds."additionalIngredientIds"
          FROM "dishSnapshots" ds
          WHERE ds."menuCurationTaskId" = $1
            AND ds."type" = 'QC'
          ORDER BY ds."dishId", ds."createdAt" DESC
      )
      SELECT
          b."brandName",
          b."cuisineType",
          b."locationType",
          '=HYPERLINK("https://menu-curator.foodstyles.com/menu-curation-tasks/'
            || b."menuCurationTaskId"
            || '?dishIds%5B0%5D='
            || b."dishId"
            || '&shouldScrollToDish=true","'
            || b."dishId"
            || '")'                                                                                AS "dishId",
          mh."menuTitle",
          b."dishName",
          b."dishDescription",
          b."ingredients"                                                                          AS "ingredientFreeText",
          b."dietDescriptors"                                                                      AS "dietDescriptors",
          b."addonDescriptors"                                                                     AS "addonDescriptors",
          b."miscDescriptors"                                                                      AS "miscDescriptors",
          b."allergenDescriptors"                                                                  AS "allergenDescriptors",
          dt_ai."name"                                                                             AS "dishTypeAI",
          dt_ai_new."name"                                                                         AS "dishTypeAINew",
          dt_c."name"                                                                              AS "dishTypeCurator",
          ct_ai."name"                                                                             AS "courseTypeAI",
          ct_ai_new."name"                                                                         AS "courseTypeAINew",
          ct_c."name"                                                                              AS "courseTypeCurator",
          (SELECT array_agg(name ORDER BY name) FROM diets       WHERE id = ANY(b."dietIds"))                    AS "dietAI",
          (SELECT array_agg(name ORDER BY name) FROM diets       WHERE id = ANY(la."latestAiDietIds"))           AS "dietAINew",
          (SELECT array_agg(name ORDER BY name) FROM diets       WHERE id = ANY(c."dietIds"))                    AS "dietCurator",
          (SELECT array_agg(name ORDER BY name) FROM allergens   WHERE id = ANY(b."allergenIds"))                AS "allergenAI",
          (SELECT array_agg(name ORDER BY name) FROM allergens   WHERE id = ANY(la."latestAiAllergenIds"))       AS "allergenAINew",
          (SELECT array_agg(name ORDER BY name) FROM allergens   WHERE id = ANY(c."allergenIds"))                AS "allergenCurator",
          (SELECT array_agg(name ORDER BY name) FROM ingredients WHERE id = ANY(b."mainIngredientIds"))          AS "mainIngredientAI",
          (SELECT array_agg(name ORDER BY name) FROM ingredients WHERE id = ANY(la."latestAiMainIngredientIds")) AS "mainIngredientAINew",
          (SELECT array_agg(name ORDER BY name) FROM ingredients WHERE id = ANY(c."mainIngredientIds"))          AS "mainIngredientCurator",
          (SELECT array_agg(name ORDER BY name) FROM ingredients WHERE id = ANY(b."choiceIngredientIds"))        AS "choiceIngredientAI",
          (SELECT array_agg(name ORDER BY name) FROM ingredients WHERE id = ANY(la."latestAiChoiceIngredientIds")) AS "choiceIngredientAINew",
          (SELECT array_agg(name ORDER BY name) FROM ingredients WHERE id = ANY(c."choiceIngredientIds"))        AS "choiceIngredientCurator",
          (SELECT array_agg(i.name ORDER BY i.name)
             FROM ingredients i
            WHERE i.id = ANY(b."additionalIngredientIds")
              AND NOT EXISTS (
                SELECT 1
                FROM "dishesAdditionalIngredients" dai
                WHERE dai."dishId" = b."dishId"
                  AND dai."ingredientId" = i.id
                  AND dai."type" = 'PROBABLE'
              ))                                                                                                   AS "additionalIngredientAI",
          (SELECT array_agg(i.name ORDER BY i.name)
             FROM ingredients i
            WHERE i.id = ANY(la."latestAiAdditionalIngredientIds")
              AND NOT EXISTS (
                SELECT 1
                FROM "dishesAdditionalIngredients" dai
                WHERE dai."dishId" = la."dishId"
                  AND dai."ingredientId" = i.id
                  AND dai."type" = 'PROBABLE'
              ))                                                                                                   AS "additionalIngredientAINew",
          (SELECT array_agg(i.name ORDER BY i.name)
             FROM ingredients i
            WHERE i.id = ANY(c."additionalIngredientIds")
              AND NOT EXISTS (
                SELECT 1
                FROM "dishesAdditionalIngredients" dai
                WHERE dai."dishId" = c."dishId"
                  AND dai."ingredientId" = i.id
                  AND dai."type" = 'PROBABLE'
              ))                                                                                                   AS "additionalIngredientCurator",
          b."createdAt"                                                                            AS "aiCreatedAt",
          la."latestAiCreatedAt"                                                                   AS "aiCreatedAtNew",
          c."curatorCreatedAt"
      FROM ai_base b
      LEFT JOIN latest_ai_new_base la ON la."dishId" = b."dishId"
      LEFT JOIN curator_base c   ON c."dishId" = b."dishId"
      LEFT JOIN "dishTypes"   dt_ai ON dt_ai."id" = b."dishTypeId"
      LEFT JOIN "dishTypes"   dt_ai_new ON dt_ai_new."id" = la."latestAiDishTypeId"
      LEFT JOIN "courseTypes" ct_ai ON ct_ai."id" = b."courseTypeId"
      LEFT JOIN "courseTypes" ct_ai_new ON ct_ai_new."id" = la."latestAiCourseTypeId"
      LEFT JOIN "dishTypes"   dt_c  ON dt_c."id"  = c."dishTypeId"
      LEFT JOIN "courseTypes" ct_c  ON ct_c."id"  = c."courseTypeId"
      LEFT JOIN LATERAL (
          WITH RECURSIVE menu_hierarchy AS (
              SELECT
                "id",
                "parentId",
                "title",
                "description",
                "miscDescriptors",
                "addonDescriptors",
                "dietDescriptors",
                "allergenDescriptors",
                0 AS lvl
              FROM "menuTitles"
              WHERE "id" = b."menuTitleId"

              UNION ALL

              SELECT
                m."id",
                m."parentId",
                m."title",
                m."description",
                m."miscDescriptors",
                m."addonDescriptors",
                m."dietDescriptors",
                m."allergenDescriptors",
                h.lvl + 1
              FROM "menuTitles" m
              INNER JOIN menu_hierarchy h ON m."id" = h."parentId"
              WHERE h."id" <> h."parentId"
          )
          SELECT json_agg(
                   json_build_object(
                     'title', "title",
                     'description', "description",
                     'miscDescriptors', "miscDescriptors",
                     'addonDescriptors', "addonDescriptors",
                     'dietDescriptors', "dietDescriptors",
                     'allergenDescriptors', "allergenDescriptors"
                   )
                   ORDER BY lvl DESC
                 ) AS "menuTitle"
          FROM menu_hierarchy
      ) mh ON true
      ORDER BY b."dishId"
      LIMIT COALESCE($2::int, 2147483647)`,
      [taskId, normalizedLimit],
    );

    res.json({ rows });
  } catch (err) {
    console.error("menu-curation-task-ai-curator-export error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Read-only export rows for a single menu curation task filtered to AI tier 1 dishes.
app.get("/api/menu-curation-task-tier-one-export", async (req, res) => {
  const taskId = parseInt(req.query.taskId, 10);
  const limit = parseInt(req.query.limit ?? "", 10);
  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? limit : null;
  if (!taskId) return res.status(400).json({ error: "taskId required" });

  try {
    const { rows } = await pool.query(
      `WITH ai_base AS (
          SELECT DISTINCT ON (ds."dishId")
              brands."name"                AS "brandName",
              cuisine_types."name"         AS "cuisineType",
              location_types."name"        AS "locationType",
              ds."menuCurationTaskId",
              ds."dishId",
              REPLACE(REPLACE(ds."styledName", '<p>', ''), '</p>', '') AS "dishName",
              ds."createdAt",
              ds."dishTypeId",
              ds."courseTypeId",
              ds."dietIds",
              ds."allergenIds",
              ds."mainIngredientIds",
              ds."choiceIngredientIds",
              ds."additionalIngredientIds",
              d."tier"                     AS "suggestedTier",
              d."description"              AS "dishDescription",
              d."ingredients",
              d."dietDescriptors",
              d."addonDescriptors",
              d."miscDescriptors",
              d."allergenDescriptors",
              d."menuTitleId"
          FROM "dishSnapshots" ds
          LEFT JOIN "dishes" d              ON d.id = ds."dishId"
          LEFT JOIN "menuCurationTasks" mct ON mct.id = ds."menuCurationTaskId"
          LEFT JOIN "menus"                 ON mct."menuId" = menus.id
          LEFT JOIN "brands"                ON menus."brandId" = brands.id
          LEFT JOIN "cuisineTypes" cuisine_types ON cuisine_types.id = brands."cuisineTypeId"
          LEFT JOIN "locationTypes" location_types ON location_types.id = brands."mainLocationTypeId"
          WHERE ds."menuCurationTaskId" = $1
            AND ds."type" = 'AI'
            AND d."tier" = '1'
            AND d."isEnabled" = true
            AND d."isFake" = false
            AND d."isDeleted" = false
            AND ds."createdAt" = (
                SELECT MAX("createdAt")
                FROM "dishSnapshots"
                WHERE "menuCurationTaskId" = $1
                  AND "type" = 'AI'
                  AND "createdAt" < (
                      SELECT MAX("createdAt")
                      FROM "dishSnapshots"
                      WHERE "menuCurationTaskId" = $1
                        AND "type" = 'QC'
                  )
            )
          ORDER BY ds."dishId", ds."createdAt" DESC
      ),
      curator_base AS (
          SELECT DISTINCT ON (ds."dishId")
              ds."dishId",
              ds."createdAt"               AS "curatorCreatedAt",
              ds."dishTypeId",
              ds."courseTypeId",
              ds."dietIds",
              ds."allergenIds",
              ds."mainIngredientIds",
              ds."choiceIngredientIds",
              ds."additionalIngredientIds",
              ds."tier"                    AS "curatedTier"
          FROM "dishSnapshots" ds
          WHERE ds."menuCurationTaskId" = $1
            AND ds."type" = 'QC'
          ORDER BY ds."dishId", ds."createdAt" DESC
      )
      SELECT
          b."brandName",
          b."cuisineType",
          b."locationType",
          '=HYPERLINK("https://menu-curator.foodstyles.com/menu-curation-tasks/'
            || b."menuCurationTaskId"
            || '?dishIds%5B0%5D='
            || b."dishId"
            || '&shouldScrollToDish=true","'
            || b."dishId"
            || '")'                                                                                AS "dishId",
          mh."menuTitle",
          b."dishName",
          b."dishDescription",
          b."ingredients"                                                                          AS "ingredientFreeText",
          b."dietDescriptors"                                                                      AS "dietDescriptors",
          b."addonDescriptors"                                                                     AS "addonDescriptors",
          b."miscDescriptors"                                                                      AS "miscDescriptors",
          b."allergenDescriptors"                                                                  AS "allergenDescriptors",
          b."suggestedTier",
          c."curatedTier",
          dt_ai."name"                                                                             AS "dishTypeAI",
          dt_c."name"                                                                              AS "dishTypeCurator",
          ct_ai."name"                                                                             AS "courseTypeAI",
          ct_c."name"                                                                              AS "courseTypeCurator",
          (SELECT array_agg(name ORDER BY name) FROM diets       WHERE id = ANY(b."dietIds"))                    AS "dietAI",
          (SELECT array_agg(name ORDER BY name) FROM diets       WHERE id = ANY(c."dietIds"))                    AS "dietCurator",
          (SELECT array_agg(name ORDER BY name) FROM allergens   WHERE id = ANY(b."allergenIds"))                AS "allergenAI",
          (SELECT array_agg(name ORDER BY name) FROM allergens   WHERE id = ANY(c."allergenIds"))                AS "allergenCurator",
          (SELECT array_agg(name ORDER BY name) FROM ingredients WHERE id = ANY(b."mainIngredientIds"))          AS "mainIngredientAI",
          (SELECT array_agg(name ORDER BY name) FROM ingredients WHERE id = ANY(c."mainIngredientIds"))          AS "mainIngredientCurator",
          (SELECT array_agg(name ORDER BY name) FROM ingredients WHERE id = ANY(b."choiceIngredientIds"))        AS "choiceIngredientAI",
          (SELECT array_agg(name ORDER BY name) FROM ingredients WHERE id = ANY(c."choiceIngredientIds"))        AS "choiceIngredientCurator",
          (SELECT array_agg(i.name ORDER BY i.name)
             FROM ingredients i
            WHERE i.id = ANY(b."additionalIngredientIds")
              AND NOT EXISTS (
                SELECT 1
                FROM "dishesAdditionalIngredients" dai
                WHERE dai."dishId" = b."dishId"
                  AND dai."ingredientId" = i.id
                  AND dai."type" = 'PROBABLE'
              ))                                                                                                   AS "additionalIngredientAI",
          (SELECT array_agg(i.name ORDER BY i.name)
             FROM ingredients i
            WHERE i.id = ANY(c."additionalIngredientIds")
              AND NOT EXISTS (
                SELECT 1
                FROM "dishesAdditionalIngredients" dai
                WHERE dai."dishId" = c."dishId"
                  AND dai."ingredientId" = i.id
                  AND dai."type" = 'PROBABLE'
              ))                                                                                                   AS "additionalIngredientCurator",
          b."createdAt"                                                                            AS "aiCreatedAt",
          c."curatorCreatedAt"
      FROM ai_base b
      LEFT JOIN curator_base c   ON c."dishId" = b."dishId"
      LEFT JOIN "dishTypes"   dt_ai ON dt_ai."id" = b."dishTypeId"
      LEFT JOIN "courseTypes" ct_ai ON ct_ai."id" = b."courseTypeId"
      LEFT JOIN "dishTypes"   dt_c  ON dt_c."id"  = c."dishTypeId"
      LEFT JOIN "courseTypes" ct_c  ON ct_c."id"  = c."courseTypeId"
      LEFT JOIN LATERAL (
          WITH RECURSIVE menu_hierarchy AS (
              SELECT
                "id",
                "parentId",
                "title",
                "description",
                "miscDescriptors",
                "addonDescriptors",
                "dietDescriptors",
                "allergenDescriptors",
                0 AS lvl
              FROM "menuTitles"
              WHERE "id" = b."menuTitleId"

              UNION ALL

              SELECT
                m."id",
                m."parentId",
                m."title",
                m."description",
                m."miscDescriptors",
                m."addonDescriptors",
                m."dietDescriptors",
                m."allergenDescriptors",
                h.lvl + 1
              FROM "menuTitles" m
              INNER JOIN menu_hierarchy h ON m."id" = h."parentId"
              WHERE h."id" <> h."parentId"
          )
          SELECT json_agg(
                   json_build_object(
                     'title', "title",
                     'description', "description",
                     'miscDescriptors', "miscDescriptors",
                     'addonDescriptors', "addonDescriptors",
                     'dietDescriptors', "dietDescriptors",
                     'allergenDescriptors', "allergenDescriptors"
                   )
                   ORDER BY lvl DESC
                 ) AS "menuTitle"
          FROM menu_hierarchy
      ) mh ON true
      ORDER BY b."dishId"
      LIMIT COALESCE($2::int, 2147483647)`,
      [taskId, normalizedLimit],
    );

    res.json({ rows });
  } catch (err) {
    console.error("menu-curation-task-tier-one-export error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/menu-filter-options
// Read-only list of cuisine & location types referenced by INCLUDED menus.
app.get("/api/menu-filter-options", async (_req, res) => {
  try {
    const [cuisineRes, locationRes] = await Promise.all([
      pool.query(
        `SELECT DISTINCT ct.id, ct.name
         FROM menus m
         INNER JOIN brands b ON b.id = m."brandId"
         INNER JOIN "cuisineTypes" ct ON ct.id = m."cuisineTypeId"
         WHERE m."status" = 'INCLUDED'
           AND m."isDeleted" = false
           AND m."isFake" = false
           AND b."status" = 'INCLUDED'
         ORDER BY ct.name ASC`,
      ),
      pool.query(
        `SELECT DISTINCT lt.id, lt.name
         FROM menus m
         INNER JOIN brands b ON b.id = m."brandId"
         INNER JOIN "locationTypes" lt ON lt.id = b."mainLocationTypeId"
         WHERE m."status" = 'INCLUDED'
           AND m."isDeleted" = false
           AND m."isFake" = false
           AND b."status" = 'INCLUDED'
         ORDER BY lt.name ASC`,
      ),
    ]);

    res.json({ cuisineTypes: cuisineRes.rows, locationTypes: locationRes.rows });
  } catch (err) {
    console.error("menu-filter-options error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/menus?page=0&pageSize=50&search=
// Read-only paginated list of INCLUDED menus (with INCLUDED brand), excluding deleted/fake.
app.get("/api/menus", async (req, res) => {
  const page = Math.max(0, parseInt(req.query.page ?? "0", 10) || 0);
  const rawPageSize = parseInt(req.query.pageSize ?? "50", 10) || 50;
  const pageSize = Math.min(500, Math.max(1, rawPageSize));
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const cuisineTypeId = parseInt(req.query.cuisineTypeId, 10);
  const locationTypeId = parseInt(req.query.locationTypeId, 10);
  const rawTop200 = typeof req.query.isTop200 === "string" ? req.query.isTop200.toLowerCase() : "";
  const isTop200Filter = rawTop200 === "true" ? true : rawTop200 === "false" ? false : null;

  const params = [];
  const where = [
    `m."status" = 'INCLUDED'`,
    `m."isDeleted" = false`,
    `m."isFake" = false`,
    `b."status" = 'INCLUDED'`,
  ];

  if (search) {
    params.push(`%${search}%`);
    where.push(`b."name" ILIKE $${params.length}`);
  }

  if (Number.isFinite(cuisineTypeId) && cuisineTypeId > 0) {
    params.push(cuisineTypeId);
    where.push(`m."cuisineTypeId" = $${params.length}`);
  }

  if (Number.isFinite(locationTypeId) && locationTypeId > 0) {
    params.push(locationTypeId);
    where.push(`b."mainLocationTypeId" = $${params.length}`);
  }

  if (isTop200Filter !== null) {
    params.push(isTop200Filter);
    where.push(`b."isTop200" = $${params.length}`);
  }

  const whereSql = where.join(" AND ");

  try {
    const countParams = params.slice();
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM menus m
       INNER JOIN brands b ON b.id = m."brandId"
       WHERE ${whereSql}`,
      countParams,
    );
    const total = countRows[0]?.total ?? 0;

    const offset = page * pageSize;
    params.push(pageSize);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const { rows } = await pool.query(
      `SELECT
         m.id                  AS "menuId",
         m."brandId"           AS "brandId",
         b.name                AS "brandName",
         m."cuisineTypeId"     AS "cuisineTypeId",
         ct.name               AS "cuisineType",
         b."mainLocationTypeId" AS "mainLocationTypeId",
         lt.name               AS "locationType",
         m."dishCount"         AS "dishCount",
         b."isTop200"          AS "isTop200"
       FROM menus m
       INNER JOIN brands b ON b.id = m."brandId"
       LEFT JOIN "cuisineTypes" ct ON ct.id = m."cuisineTypeId"
       LEFT JOIN "locationTypes" lt ON lt.id = b."mainLocationTypeId"
       WHERE ${whereSql}
       ORDER BY b.name ASC, m.id ASC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    res.json({ rows, page, pageSize, total });
  } catch (err) {
    console.error("menus error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
