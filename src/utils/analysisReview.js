function normalizeComplexity(value) {
  if (!value) return null;
  return String(value).trim().toUpperCase();
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

  const complexity = normalizeComplexity(result.overall_complexity);
  const changeStatus = normalizeChangeStatus(result.change_status);

  if (!complexity || !changeStatus) {
    return null;
  }

  return `${complexity}__${changeStatus}`;
}

export function getAnalysisReviewStatus(modelResults, modelNames = []) {
  const signatures = modelNames
    .map((name) => getComparableSignature(modelResults?.[name]))
    .filter(Boolean);

  if (modelNames.length === 0 || signatures.length !== modelNames.length) {
    return null;
  }

  return new Set(signatures).size > 1 ? "For Review" : "Resolved";
}

export function getAnalysisReviewTone(status) {
  if (status === "For Review") return "warning";
  if (status === "Resolved") return "success";
  return "neutral";
}

export function formatAnalysisComplexity(value) {
  if (!value) return "-";
  return String(value).trim().toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
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
