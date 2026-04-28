function normalizeDateInput(value) {
  return String(value)
    .trim()
    .replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T")
    .replace(/\s+([+-]\d{2}(?::?\d{2})?)$/, "$1")
    .replace(/([+-]\d{2})(\d{2})$/, "$1:$2")
    .replace(/([+-]\d{2})$/, "$1:00");
}

export function parseDateValue(value) {
  if (!value) {
    return null;
  }

  const normalized = normalizeDateInput(value);
  const timestamp = Date.parse(normalized);

  return Number.isNaN(timestamp) ? null : timestamp;
}

export function formatDate(value) {
  if (!value) {
    return "-";
  }

  const normalized = normalizeDateInput(value);
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.valueOf())) {
    return String(value);
  }

  return parsed
    .toLocaleString("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
    .replace(",", "");
}
