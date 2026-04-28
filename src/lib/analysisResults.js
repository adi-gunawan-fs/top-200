import { supabase } from "./supabase";

const TABLE = "analysis_results";

// Key that uniquely identifies one analysis: which comparison + which item
export function makeAnalysisKey(beforeRecordId, afterRecordId, itemId, itemType) {
  return `${beforeRecordId}__${afterRecordId}__${itemId}__${itemType}`;
}

export async function fetchAnalysisResults(beforeRecordId, afterRecordId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, before_record_id, after_record_id, item_id, item_type, result, created_at")
    .eq("before_record_id", String(beforeRecordId))
    .eq("after_record_id", String(afterRecordId));

  if (error) throw error;
  return data;
}

export async function upsertAnalysisResult({ beforeRecordId, afterRecordId, itemId, itemType, result }) {
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      {
        before_record_id: String(beforeRecordId),
        after_record_id: String(afterRecordId),
        item_id: String(itemId),
        item_type: String(itemType),
        result,
      },
      { onConflict: "before_record_id,after_record_id,item_id,item_type" },
    )
    .select("id, before_record_id, after_record_id, item_id, item_type, result, created_at")
    .single();

  if (error) throw error;
  return data;
}
