import { BRAINTRUST_MODELS } from "../../lib/braintrust";

export function makeShortKey(itemId, itemType) {
  return `${itemId}__${itemType}`;
}

export function mapAnalysisResults(rows) {
  const map = {};
  rows.forEach((row) => {
    const shortKey = makeShortKey(row.item_id, row.item_type);
    const modelName = BRAINTRUST_MODELS.find((model) => model.slug === row.model_slug)?.name ?? row.model_slug;
    if (!map[shortKey]) map[shortKey] = {};
    map[shortKey][modelName] = row.result;
  });
  return map;
}

export function mapAnalysisJobs(rows, forceStatus) {
  const map = {};
  rows.forEach((row) => {
    map[makeShortKey(row.item_id, row.item_type)] = forceStatus ? { ...row, status: forceStatus } : row;
  });
  return map;
}

export function isJobRunning(status) {
  return status === "pending" || status === "processing";
}

export function isBulkRunActive(run) {
  return run?.status === "pending" || run?.status === "processing";
}
