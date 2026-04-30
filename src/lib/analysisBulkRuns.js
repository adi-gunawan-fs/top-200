import { supabase } from "./supabase";

const TABLE = "analysis_bulk_runs";

export async function fetchAnalysisBulkRuns(beforeRecordId, afterRecordId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, before_record_id, after_record_id, status, trigger_mode, total_items, queued_count, processing_count, completed_count, failed_count, started_at, completed_at, created_at, updated_at")
    .eq("before_record_id", String(beforeRecordId))
    .eq("after_record_id", String(afterRecordId))
    .order("started_at", { ascending: false });

  if (error) throw error;
  return data;
}
