import { supabase } from "./supabase";

const TABLE = "analysis_jobs";
const FUNCTION_NAME = "analysis-jobs";

export async function fetchAnalysisJobs(beforeRecordId, afterRecordId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, before_record_id, after_record_id, item_id, item_type, status, error_message, started_at, completed_at, created_at, updated_at")
    .eq("before_record_id", String(beforeRecordId))
    .eq("after_record_id", String(afterRecordId));

  if (error) throw error;
  return data;
}

export async function cancelBulkRun(batchId) {
  const { error: jobsError } = await supabase
    .from(TABLE)
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("batch_id", batchId)
    .eq("status", "pending");

  if (jobsError) throw jobsError;

  const { error: runError } = await supabase
    .from("analysis_bulk_runs")
    .update({ status: "cancelled", completed_at: new Date().toISOString() })
    .eq("id", batchId);

  if (runError) throw runError;
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

  if (error) {
    let detail = error.message;
    try { detail = (await error.context?.json())?.error ?? detail; } catch {}
    console.error("enqueueAnalysisJobs error detail:", detail);
    throw new Error(detail);
  }
  return data;
}
