export const PARAMETER_WEIGHTS = {
  text_length: 0.05,
  numeric_noise: 0.05,
  symbol_noise: 0.05,
  repetition: 0.10,
  alternative_branching: 0.20,
  allergen_complexity: 0.20,
  dish_name_ambiguity: 0.10,
  format_inconsistency: 0.05,
  structural_density: 0.10,
  parsing_difficulty: 0.10,
};

export function calcWeightedScore(parameterScores) {
  if (!parameterScores) return null;
  let weightedSum = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(PARAMETER_WEIGHTS)) {
    const score = parameterScores[key];
    if (score != null) {
      weightedSum += score * weight;
      totalWeight += weight;
    }
  }
  if (totalWeight === 0) return null;
  return weightedSum / totalWeight;
}

export function calcComplexity(parameterScores) {
  const score = calcWeightedScore(parameterScores);
  if (score == null) return null;
  return score > 5 ? "Hard" : "Easy";
}

function normalizeChangeStatus(value) {
  if (!value) return null;

  const normalized = String(value).trim().toUpperCase();
  if (normalized === "SIGNIFICANT_CHANGE") {
    return "MAJOR_CHANGE";
  }

  return normalized;
}

function getComparableSignature(result) {
  if (!result || result.error) return null;

  const changeStatus = normalizeChangeStatus(result.change_status);
  if (!changeStatus) return null;

  const complexity = calcComplexity(result.parameter_scores) ?? "unknown";
  return `${complexity}__${changeStatus}`;
}

function deriveStatus(changeStatus, complexity) {
  if (!changeStatus) return null;
  const isMajor = changeStatus === "MAJOR_CHANGE";
  if (!isMajor) return "Resolved";
  return complexity === "Hard" ? "Critical Review" : "Low Review";
}

export function getAnalysisReviewStatus(modelResults, modelNames = []) {
  const signatures = modelNames
    .map((name) => getComparableSignature(modelResults?.[name]))
    .filter(Boolean);

  if (modelNames.length === 0 || signatures.length !== modelNames.length) {
    return null;
  }

  if (new Set(signatures).size > 1) return "Judge Confused";

  // All models agree — derive status from the shared signature
  const result = modelResults?.[modelNames[0]];
  const changeStatus = normalizeChangeStatus(result?.change_status);
  const complexity = calcComplexity(result?.parameter_scores);
  return deriveStatus(changeStatus, complexity);
}

export function getAnalysisReviewTone(status) {
  if (status === "Judge Confused") return "pink";
  if (status === "Critical Review") return "danger";
  if (status === "Low Review") return "warning";
  if (status === "Resolved") return "success";
  return "neutral";
}

export function formatAnalysisChangeStatus(value) {
  if (!value) return "-";

  const normalized = normalizeChangeStatus(value);
  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
