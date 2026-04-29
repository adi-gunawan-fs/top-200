import { supabase } from "./supabase";

const TABLE = "analysis_results";

export function makeAnalysisKey(beforeRecordId, afterRecordId, itemId, itemType) {
  return `${beforeRecordId}__${afterRecordId}__${itemId}__${itemType}`;
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
