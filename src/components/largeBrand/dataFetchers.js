// Data-loading helpers specific to the Large Brand pages.
// Composes the shared `api` HTTP client with menu-title-chain post-processing.

import {
  fetchBrandDishDetails as apiFetchBrandDishDetails,
  fetchBrandLatestMessageRows,
  fetchBrandMessageTimestamps as apiFetchBrandMessageTimestamps,
  fetchBrandSnapshotRowsAsOf,
} from "../../lib/api";
import { buildMenuTitleChain, buildMenuTitlesById, withLeafMenuTitleDetails } from "../../lib/csvHelpers";

export async function fetchLatestAutoeatDishes(brandId) {
  const rows = await fetchBrandLatestMessageRows(brandId);
  const dishMap = new Map();
  const menuTitleChains = new Map();

  for (const row of rows) {
    const message = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
    const menuAutoeatId = message?.menu?.id;
    const menuTitlesById = buildMenuTitlesById(message?.menuTitles ?? []);

    for (const dish of message?.dishes ?? []) {
      if (dish.id != null) {
        dishMap.set(dish.id, menuAutoeatId);
        if (dish.menuTitleId != null) {
          menuTitleChains.set(dish.id, buildMenuTitleChain(dish.menuTitleId, menuTitlesById));
        }
      }
    }
  }
  return { dishMap, menuTitleChains };
}

export const fetchDishDetails = apiFetchBrandDishDetails;
export const fetchBrandMessageTimestamps = apiFetchBrandMessageTimestamps;

export async function fetchBrandSnapshotAsOf(brandId, asOf) {
  const rows = await fetchBrandSnapshotRowsAsOf(brandId, asOf);
  const dishMap = new Map();
  const menuTitleChains = new Map();
  const dishById = new Map();

  for (const row of rows) {
    const message = typeof row.message === "string" ? JSON.parse(row.message) : row.message;
    const menuAutoeatId = message?.menu?.id;
    const menuTitlesById = buildMenuTitlesById(message?.menuTitles ?? []);

    for (const dish of message?.dishes ?? []) {
      if (dish.id != null) {
        dishMap.set(dish.id, menuAutoeatId);
        dishById.set(dish.id, dish);
        if (dish.menuTitleId != null) {
          menuTitleChains.set(dish.id, buildMenuTitleChain(dish.menuTitleId, menuTitlesById));
        }
      }
    }
  }
  return { dishMap, menuTitleChains, dishById };
}

// Re-export so the page can withLeafMenuTitleDetails without reaching into lib/.
export { withLeafMenuTitleDetails };
