import { supabase } from "./supabase";

const TABLE = "analysis_results";

export function makeAnalysisKey(beforeRecordId, afterRecordId, itemId, itemType) {
  return `${beforeRecordId}__${afterRecordId}__${itemId}__${itemType}`;
}

// Returns the (before_record_id, after_record_id) pair within the given record IDs
// that has the most analysis results, or null if none exist.
export async function fetchBestAnalysisPair(recordIds) {
  if (!recordIds || recordIds.length < 2) return null;

  const ids = recordIds.map(String);

  const { data, error } = await supabase
    .from(TABLE)
    .select("before_record_id, after_record_id")
    .in("before_record_id", ids)
    .in("after_record_id", ids);

  if (error) throw error;
  if (!data || data.length === 0) return null;

  const counts = {};
  for (const row of data) {
    const key = `${row.before_record_id}__${row.after_record_id}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;

  const [beforeRecordId, afterRecordId] = best[0].split("__");
  return { beforeRecordId, afterRecordId };
}

// Returns rows grouped by item: { shortKey: { modelSlug: result } }
export async function fetchAnalysisResults(beforeRecordId, afterRecordId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, before_record_id, after_record_id, item_id, item_type, model_slug, result, created_at")
    .eq("before_record_id", String(beforeRecordId))
    .eq("after_record_id", String(afterRecordId));

  if (error) throw error;
  return data;
}

export async function upsertAnalysisResult({ beforeRecordId, afterRecordId, itemId, itemType, modelSlug, result }) {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        before_record_id: String(beforeRecordId),
        after_record_id: String(afterRecordId),
        item_id: String(itemId),
        item_type: String(itemType),
        model_slug: String(modelSlug),
        result,
      },
      { onConflict: "before_record_id,after_record_id,item_id,item_type,model_slug" },
    )
    .select("id, before_record_id, after_record_id, item_id, item_type, model_slug, result, created_at")
    .single();

  if (error) throw error;
  return data;
}
