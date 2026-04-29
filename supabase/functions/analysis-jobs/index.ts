import { createClient } from "npm:@supabase/supabase-js@2";

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const braintrustApiKey = Deno.env.get("BRAINTRUST_API_KEY") ?? "";
const braintrustProjectId = Deno.env.get("BRAINTRUST_PROJECT_ID") ?? "";

const braintrustModels = [
  { name: Deno.env.get("BRAINTRUST_MODEL1_NAME") ?? "Model 1", slug: Deno.env.get("BRAINTRUST_PROMPT_SLUG_1") ?? "" },
  { name: Deno.env.get("BRAINTRUST_MODEL2_NAME") ?? "Model 2", slug: Deno.env.get("BRAINTRUST_PROMPT_SLUG_2") ?? "" },
  { name: Deno.env.get("BRAINTRUST_MODEL3_NAME") ?? "Model 3", slug: Deno.env.get("BRAINTRUST_PROMPT_SLUG_3") ?? "" },
].filter((model) => model.slug);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

async function resolveFunctionId(slug: string) {
  const params = new URLSearchParams({
    project_id: braintrustProjectId,
    slug,
  });

  const response = await fetch(`https://api.braintrust.dev/v1/function?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${braintrustApiKey}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Braintrust function lookup error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const fn = data?.objects?.[0];
  if (!fn?.id) {
    throw new Error(`Braintrust: no function found for project_id=${braintrustProjectId} slug=${slug}`);
  }

  return fn.id;
}

async function invokeModel(slug: string, exportItem: Record<string, unknown>) {
  const functionId = await resolveFunctionId(slug);

  const response = await fetch(`https://api.braintrust.dev/v1/function/${functionId}/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${braintrustApiKey}`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
    },
    body: JSON.stringify({ input: exportItem }),
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Braintrust API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const raw = data?.output ?? data;
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }
  return raw;
}

async function runBraintrustAnalysisAllModels(exportItem: Record<string, unknown>) {
  if (!braintrustApiKey || !braintrustProjectId) {
    throw new Error("Missing Braintrust function secrets.");
  }
  if (braintrustModels.length === 0) {
    throw new Error("No Braintrust prompt slugs configured.");
  }

  const entries = await Promise.all(
    braintrustModels.map(async ({ name, slug }) => {
      try {
        const result = await invokeModel(slug, exportItem);
        return [name, slug, result] as const;
      } catch (err) {
        return [name, slug, { error: err instanceof Error ? err.message : String(err) }] as const;
      }
    }),
  );

  return entries;
}

async function processJob(serviceClient: ReturnType<typeof createClient>, job: Record<string, unknown>) {
  const jobId = String(job.id);
  const beforeRecordId = String(job.before_record_id);
  const afterRecordId = String(job.after_record_id);
  const itemId = String(job.item_id);
  const itemType = String(job.item_type);
  const batchId = job.batch_id ? String(job.batch_id) : null;
  const exportItem = job.export_item as Record<string, unknown>;

  await serviceClient
    .from("analysis_jobs")
    .update({
      status: "processing",
      started_at: new Date().toISOString(),
      completed_at: null,
      error_message: null,
    })
    .eq("id", jobId);

  if (batchId) {
    await refreshBulkRun(serviceClient, batchId);
  }

  try {
    const modelEntries = await runBraintrustAnalysisAllModels(exportItem);

    const { data: currentJob } = await serviceClient
      .from("analysis_jobs")
      .select("status")
      .eq("id", jobId)
      .single();

    if (currentJob?.status === "cancelled") {
      return;
    }

    const resultRows = modelEntries.map(([, slug, result]) => ({
      before_record_id: beforeRecordId,
      after_record_id: afterRecordId,
      item_id: itemId,
      item_type: itemType,
      model_slug: slug,
      result,
    }));

    const { error: upsertError } = await serviceClient
      .from("analysis_results")
      .upsert(resultRows, {
        onConflict: "before_record_id,after_record_id,item_id,item_type,model_slug",
      });

    if (upsertError) {
      throw upsertError;
    }

    const { error: completeError } = await serviceClient
      .from("analysis_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", jobId);

    if (completeError) {
      throw completeError;
    }

    if (batchId) {
      await refreshBulkRun(serviceClient, batchId);
    }
  } catch (err) {
    await serviceClient
      .from("analysis_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq("id", jobId);

    if (batchId) {
      await refreshBulkRun(serviceClient, batchId);
    }
  }
}

async function refreshBulkRun(serviceClient: ReturnType<typeof createClient>, batchId: string) {
  const { data: jobs, error: jobsError } = await serviceClient
    .from("analysis_jobs")
    .select("status")
    .eq("batch_id", batchId);

  if (jobsError) {
    throw jobsError;
  }

  const queuedCount = (jobs ?? []).filter((job) => job.status === "pending").length;
  const processingCount = (jobs ?? []).filter((job) => job.status === "processing").length;
  const completedCount = (jobs ?? []).filter((job) => job.status === "completed").length;
  const failedCount = (jobs ?? []).filter((job) => job.status === "failed").length;
  const totalItems = jobs?.length ?? 0;

  const isFinished = queuedCount === 0 && processingCount === 0 && totalItems > 0;
  const status = isFinished
    ? (failedCount > 0 ? "failed" : "completed")
    : (processingCount > 0 ? "processing" : "pending");

  const { error: updateError } = await serviceClient
    .from("analysis_bulk_runs")
    .update({
      status,
      total_items: totalItems,
      queued_count: queuedCount,
      processing_count: processingCount,
      completed_count: completedCount,
      failed_count: failedCount,
      completed_at: isFinished ? new Date().toISOString() : null,
    })
    .eq("id", batchId);

  if (updateError) {
    throw updateError;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return json({ error: "Missing Supabase function secrets." }, 500);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Missing Authorization header." }, 401);
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const {
    data: { user },
    error: authError,
  } = await userClient.auth.getUser();

  if (authError || !user) {
    return json({ error: "Unauthorized." }, 401);
  }

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  const body: any = await req.json();
  if (body?.action !== "enqueue") {
    return json({ error: "Unsupported action." }, 400);
  }

  const beforeRecordId = String(body.beforeRecordId ?? "");
  const afterRecordId = String(body.afterRecordId ?? "");
  const triggerMode = body.triggerMode === "bulk" ? "bulk" : "single";
  const forceRerun = body.forceRerun === true;
  const jobs = Array.isArray(body.jobs) ? body.jobs : [];

  if (!beforeRecordId || !afterRecordId || jobs.length === 0) {
    return json({ error: "beforeRecordId, afterRecordId, and jobs are required." }, 400);
  }

  if (forceRerun) {
    const itemIds = jobs.map((j: Record<string, unknown>) => String(j.itemId ?? ""));
    const itemTypes = jobs.map((j: Record<string, unknown>) => String(j.itemType ?? ""));
    const uniqueTypes = [...new Set(itemTypes)];

    const { error: clearResultsError } = await serviceClient
      .from("analysis_results")
      .delete()
      .eq("before_record_id", beforeRecordId)
      .eq("after_record_id", afterRecordId)
      .in("item_id", itemIds)
      .in("item_type", uniqueTypes);

    if (clearResultsError) {
      return json({ error: `Failed to clear old results: ${clearResultsError.message}` }, 500);
    }

    const { error: clearJobsError } = await serviceClient
      .from("analysis_jobs")
      .delete()
      .eq("before_record_id", beforeRecordId)
      .eq("after_record_id", afterRecordId)
      .in("item_id", itemIds)
      .in("item_type", uniqueTypes);

    if (clearJobsError) {
      return json({ error: `Failed to clear old jobs: ${clearJobsError.message}` }, 500);
    }
  }

  let batchId: string | null = null;

  if (triggerMode === "bulk") {
    const { data: batchRow, error: batchError } = await serviceClient
      .from("analysis_bulk_runs")
      .insert({
        before_record_id: beforeRecordId,
        after_record_id: afterRecordId,
        status: "pending",
        total_items: jobs.length,
        queued_count: jobs.length,
        processing_count: 0,
        completed_count: 0,
        failed_count: 0,
        queued_by: user.id,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (batchError) {
      return json({ error: batchError.message }, 500);
    }

    batchId = String(batchRow.id);
  }

  const rows = jobs.map((job: Record<string, unknown>) => ({
    before_record_id: beforeRecordId,
    after_record_id: afterRecordId,
    item_id: String(job.itemId ?? ""),
    item_type: String(job.itemType ?? ""),
    batch_id: batchId,
    export_item: job.exportItem ?? {},
    status: "pending",
    error_message: null,
    started_at: null,
    completed_at: null,
    queued_by: user.id,
  }));

  if (rows.some((row) => !row.item_id || !row.item_type)) {
    return json({ error: "Each job requires itemId and itemType." }, 400);
  }

  const { data: queuedRows, error: queueError } = await serviceClient
    .from("analysis_jobs")
    .upsert(rows, {
      onConflict: "before_record_id,after_record_id,item_id,item_type",
    })
    .select("id, before_record_id, after_record_id, item_id, item_type, batch_id, status, error_message, started_at, completed_at, created_at, updated_at, export_item");

  if (queueError) {
    return json({ error: queueError.message }, 500);
  }

  if (batchId) {
    await refreshBulkRun(serviceClient, batchId);
  }

  EdgeRuntime.waitUntil(
    Promise.all((queuedRows ?? []).map((row) => processJob(serviceClient, row))),
  );

  return json({
    queued: queuedRows?.length ?? 0,
    jobs: queuedRows ?? [],
  }, 202);
});
