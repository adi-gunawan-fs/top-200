const BRAINTRUST_API_KEY = import.meta.env.VITE_BRAINTRUST_API_KEY;
const BRAINTRUST_PROJECT_ID = import.meta.env.VITE_BRAINTRUST_PROJECT_ID;
const BRAINTRUST_PROMPT_SLUG = import.meta.env.VITE_BRAINTRUST_PROMPT_SLUG;

if (!BRAINTRUST_API_KEY) {
  console.warn("Missing VITE_BRAINTRUST_API_KEY — analysis features will not work.");
}

// Cache the function_id so we only look it up once per session
let cachedFunctionId = null;

async function resolveFunctionId() {
  if (cachedFunctionId) return cachedFunctionId;

  const params = new URLSearchParams({
    project_id: BRAINTRUST_PROJECT_ID,
    slug: BRAINTRUST_PROMPT_SLUG,
  });

  const response = await fetch(`/api/braintrust/v1/function?${params}`, {
    headers: { "Authorization": `Bearer ${BRAINTRUST_API_KEY}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Braintrust function lookup error ${response.status}: ${text}`);
  }

  const data = await response.json();
  // GET /v1/function returns { objects: [...] }
  const fn = data?.objects?.[0];
  if (!fn?.id) {
    throw new Error(`Braintrust: no function found for project_id=${BRAINTRUST_PROJECT_ID} slug=${BRAINTRUST_PROMPT_SLUG}`);
  }

  cachedFunctionId = fn.id;
  return cachedFunctionId;
}

export async function runBraintrustAnalysis(exportItem) {
  if (!BRAINTRUST_API_KEY || !BRAINTRUST_PROJECT_ID || !BRAINTRUST_PROMPT_SLUG) {
    throw new Error(
      "Missing Braintrust env vars (VITE_BRAINTRUST_API_KEY, VITE_BRAINTRUST_PROJECT_ID, VITE_BRAINTRUST_PROMPT_SLUG).",
    );
  }

  const functionId = await resolveFunctionId();

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

  // Braintrust invoke returns { output: ... } — parse if it's a JSON string
  const raw = data?.output ?? data;
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }
  return raw;
}
