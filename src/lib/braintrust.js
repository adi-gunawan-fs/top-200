export const BRAINTRUST_MODELS = [
  { name: import.meta.env.VITE_BRAINTRUST_MODEL1_NAME || "Model 1", slug: import.meta.env.VITE_BRAINTRUST_PROMPT_SLUG_1 },
  { name: import.meta.env.VITE_BRAINTRUST_MODEL2_NAME || "Model 2", slug: import.meta.env.VITE_BRAINTRUST_PROMPT_SLUG_2 },
  { name: import.meta.env.VITE_BRAINTRUST_MODEL3_NAME || "Model 3", slug: import.meta.env.VITE_BRAINTRUST_PROMPT_SLUG_3 },
].filter((model) => model.slug);
