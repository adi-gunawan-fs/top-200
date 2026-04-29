import { supabase } from "./supabase";

const TABLE = "analysis_jobs";
const FUNCTION_NAME = "analysis-jobs";

export async function fetchAnalysisJobs(beforeRecordId, afterRecordId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, before_record_id, after_record_id, item_id, item_type, trigger_mode, status, error_message, started_at, completed_at, created_at, updated_at")
    .eq("before_record_id", String(beforeRecordId))
    .eq("after_record_id", String(afterRecordId));

  if (error) throw error;
  return data;
}

export async function enqueueAnalysisJobs({ beforeRecordId, afterRecordId, jobs, triggerMode = "single" }) {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: {
      action: "enqueue",
      beforeRecordId: String(beforeRecordId),
      afterRecordId: String(afterRecordId),
      triggerMode,
      jobs,
    },
  });

  if (error) throw error;
  return data;
}
