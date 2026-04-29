const BRAINTRUST_API_KEY = import.meta.env.VITE_BRAINTRUST_API_KEY;
const BRAINTRUST_PROJECT_ID = import.meta.env.VITE_BRAINTRUST_PROJECT_ID;

if (!BRAINTRUST_API_KEY) {
  console.warn("Missing VITE_BRAINTRUST_API_KEY — analysis features will not work.");
}

export const BRAINTRUST_MODELS = [
  { name: import.meta.env.VITE_BRAINTRUST_MODEL1_NAME || "Model 1", slug: import.meta.env.VITE_BRAINTRUST_PROMPT_SLUG_1 },
  { name: import.meta.env.VITE_BRAINTRUST_MODEL2_NAME || "Model 2", slug: import.meta.env.VITE_BRAINTRUST_PROMPT_SLUG_2 },
  { name: import.meta.env.VITE_BRAINTRUST_MODEL3_NAME || "Model 3", slug: import.meta.env.VITE_BRAINTRUST_PROMPT_SLUG_3 },
].filter((m) => m.slug);

// Cache function IDs per slug so we only look each up once per session
const functionIdCache = {};

async function resolveFunctionId(slug) {
  if (functionIdCache[slug]) return functionIdCache[slug];

  const params = new URLSearchParams({
    project_id: BRAINTRUST_PROJECT_ID,
    slug,
  });

  const response = await fetch(`/api/braintrust/v1/function?${params}`, {
    headers: { "Authorization": `Bearer ${BRAINTRUST_API_KEY}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Braintrust function lookup error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const fn = data?.objects?.[0];
  if (!fn?.id) {
    throw new Error(`Braintrust: no function found for project_id=${BRAINTRUST_PROJECT_ID} slug=${slug}`);
  }

  functionIdCache[slug] = fn.id;
  return functionIdCache[slug];
}

async function invokeModel(slug, exportItem) {
  const functionId = await resolveFunctionId(slug);

  const response = await fetch(`/api/braintrust/v1/function/${functionId}/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${BRAINTRUST_API_KEY}`,
    },
    body: JSON.stringify({ input: exportItem }),
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

// Returns { modelName: result } for all configured models, run in parallel.
// Individual model failures are caught and stored as { error: message }.
export async function runBraintrustAnalysisAllModels(exportItem) {
  if (!BRAINTRUST_API_KEY || !BRAINTRUST_PROJECT_ID) {
    throw new Error("Missing Braintrust env vars (VITE_BRAINTRUST_API_KEY, VITE_BRAINTRUST_PROJECT_ID).");
  }
  if (BRAINTRUST_MODELS.length === 0) {
    throw new Error("No Braintrust model slugs configured (VITE_BRAINTRUST_PROMPT_SLUG_1 / _2 / _3).");
  }

  const entries = await Promise.all(
    BRAINTRUST_MODELS.map(async ({ name, slug }) => {
      try {
        const result = await invokeModel(slug, exportItem);
        return [name, result];
      } catch (err) {
        return [name, { error: err.message }];
      }
    }),
  );

  return Object.fromEntries(entries);
}
