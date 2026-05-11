import { useEffect, useMemo, useState } from "react";
import { Eye, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/EmptyState";
import { Modal } from "./ui/Modal";
import { deleteAllExperimentRows, deleteExperimentRow, fetchExperimentRows, updateExperimentCellLabel } from "../lib/experiments";

const LABEL_OPTIONS = ["", "REGEX_CHANGES", "MINOR_CHANGES", "MAJOR_CHANGES"];

const COMPARE_EXPORT_HEADERS = [
  "Brand Name", "Dish ID", "Dish Name",
  "Before Name", "After Name",
  "Name Status",
  "Before Description", "After Description",
  "Description Status",
  "Before Ingredient", "After Ingredient",
  "Ingredient Status",
  "Before Addons", "After Addons",
  "Addons Status",
  "Before Allergens", "After Allergens",
  "Allergens Status",
  "Before Diets", "After Diets",
  "Diets Status",
];

function escapeCsv(value) {
  const s = value == null ? "" : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadExperimentCsv(rows) {
  const csvRows = rows.map((row) => ([
    row.brand_name ?? "",
    row.dish_id ?? "",
    row.dish_name ?? "",
    row.before_name ?? "",
    row.after_name ?? "",
    row.name_status ?? "",
    row.before_description ?? "",
    row.after_description ?? "",
    row.description_status ?? "",
    row.before_ingredient ?? "",
    row.after_ingredient ?? "",
    row.ingredient_status ?? "",
    row.before_addons ?? "",
    row.after_addons ?? "",
    row.addons_status ?? "",
    row.before_allergens ?? "",
    row.after_allergens ?? "",
    row.allergens_status ?? "",
    row.before_diets ?? "",
    row.after_diets ?? "",
    row.diets_status ?? "",
  ].map(escapeCsv).join(",")));

  const csv = [COMPARE_EXPORT_HEADERS.map(escapeCsv).join(","), ...csvRows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `experiment_compare_export_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function str(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

function formatValueForDiff(value) {
  if (value == null) return "";
  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  const raw = String(value);
  const trimmed = raw.trim();

  // If we stored JSON as text (object/array), pretty-print it for readable line diffs.
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      const parsed = JSON.parse(trimmed);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Fall through to plain text normalization.
    }
  }

  // Render escaped newlines/tabs so long strings become line-by-line comparable.
  return raw.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\t/g, "\t");
}

function toLines(value) {
  return formatValueForDiff(value).split(/\r?\n/);
}

function diffLineOps(beforeValue, afterValue) {
  const a = toLines(beforeValue);
  const b = toLines(afterValue);
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const beforeOps = [];
  const afterOps = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      beforeOps.push({ type: "same", text: a[i] });
      afterOps.push({ type: "same", text: b[j] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      beforeOps.push({ type: "del", text: a[i] });
      i += 1;
    } else {
      afterOps.push({ type: "ins", text: b[j] });
      j += 1;
    }
  }
  while (i < m) {
    beforeOps.push({ type: "del", text: a[i] });
    i += 1;
  }
  while (j < n) {
    afterOps.push({ type: "ins", text: b[j] });
    j += 1;
  }

  return { beforeOps, afterOps };
}

function DiffColumn({ title, ops, side }) {
  let lineNumber = 0;
  return (
    <div className="min-w-0 rounded-md border border-slate-200 bg-white">
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
        {title}
      </div>
      <div>
        {ops.map((op, idx) => {
          lineNumber += 1;
          const isSame = op.type === "same";
          const isChanged = side === "before" ? op.type === "del" : op.type === "ins";
          const lineClass = isSame
            ? "bg-emerald-50 text-emerald-900"
            : isChanged
              ? "bg-rose-50 text-rose-900"
              : "bg-white text-slate-400";
          const marker = isSame ? " " : isChanged ? (side === "before" ? "-" : "+") : " ";
          return (
            <div key={`${side}-${idx}`} className={`grid grid-cols-[38px_24px_1fr] border-b border-slate-100 px-2 py-1 text-xs last:border-b-0 ${lineClass}`}>
              <span className="select-none text-[11px] text-slate-500">{lineNumber}</span>
              <span className="select-none text-[11px] opacity-80">{marker}</span>
              <pre className="whitespace-pre-wrap break-words font-mono leading-5">{op.text === "" ? " " : op.text}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExperimentPage({ sessionUserId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [busyRowId, setBusyRowId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [success, setSuccess] = useState("");
  const [statusDetail, setStatusDetail] = useState(null);
  const [busyModalLabel, setBusyModalLabel] = useState(false);

  async function loadRows() {
    if (!sessionUserId) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await fetchExperimentRows(sessionUserId);
      setRows(data);
    } catch (err) {
      setError(err?.message ?? "Failed to load experiment rows.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, [sessionUserId]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) =>
      [row.brand_name, row.dish_id, row.dish_name].some((v) => String(v ?? "").toLowerCase().includes(q))
    );
  }, [rows, search]);

  async function handleDeleteRow(rowId) {
    if (!sessionUserId || !rowId) return;
    setBusyRowId(rowId);
    setError("");
    setSuccess("");
    try {
      await deleteExperimentRow(sessionUserId, rowId);
      setRows((prev) => prev.filter((row) => row.id !== rowId));
      setSuccess("Row deleted.");
    } catch (err) {
      setError(err?.message ?? "Failed to delete row.");
    } finally {
      setBusyRowId(null);
    }
  }

  async function handleClearAll() {
    if (!sessionUserId) return;
    setClearingAll(true);
    setError("");
    setSuccess("");
    try {
      await deleteAllExperimentRows(sessionUserId);
      setRows([]);
      setSuccess("All experiment rows deleted.");
    } catch (err) {
      setError(err?.message ?? "Failed to clear experiment rows.");
    } finally {
      setClearingAll(false);
    }
  }

  function openStatusDetail(row, fieldLabel, beforeKey, afterKey, labelKey) {
    setStatusDetail({
      rowId: row.id,
      labelKey,
      labelValue: row?.[labelKey] ?? "",
      fieldLabel,
      brandName: row.brand_name ?? "",
      dishName: row.dish_name ?? "",
      dishId: row.dish_id ?? "",
      beforeValue: row[beforeKey] ?? "",
      afterValue: row[afterKey] ?? "",
    });
  }

  function renderStatusCell(row, statusKey, fieldLabel, beforeKey, afterKey, labelKey) {
    const raw = row?.[statusKey];
    const status = raw === "NULL" ? "" : raw;
    return (
      <div className="flex items-center gap-2">
        {status ? (
          <span>{str(status)}</span>
        ) : (
          <button
            type="button"
            onClick={() => openStatusDetail(row, fieldLabel, beforeKey, afterKey, labelKey)}
            className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 hover:bg-rose-100"
            title={`View ${fieldLabel} before/after`}
          >
            <Eye className="h-3 w-3" />
            View
          </button>
        )}
      </div>
    );
  }

  async function handleModalLabelChange(nextLabel) {
    if (!statusDetail?.rowId || !statusDetail?.labelKey) return;
    setBusyModalLabel(true);
    setError("");
    try {
      await updateExperimentCellLabel(sessionUserId, statusDetail.rowId, statusDetail.labelKey, nextLabel);
      setRows((prev) =>
        prev.map((row) => (row.id === statusDetail.rowId ? { ...row, [statusDetail.labelKey]: nextLabel } : row))
      );
      setStatusDetail((prev) => (prev ? { ...prev, labelValue: nextLabel } : prev));
    } catch (err) {
      setError(err?.message ?? "Failed to update label.");
    } finally {
      setBusyModalLabel(false);
    }
  }

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 py-32">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        <p className="text-sm text-slate-500">Loading experiment rows…</p>
      </section>
    );
  }

  if (error) {
    return <EmptyState message={error} tone="danger" />;
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">Experiment</h2>
        <div className="flex items-center gap-2">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search brand / dish…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <Button variant="tonal" tone="neutral" onClick={loadRows}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button
            variant="tonal"
            tone="info"
            onClick={() => downloadExperimentCsv(filteredRows)}
            disabled={filteredRows.length === 0}
          >
            Export CSV
          </Button>
          <Button variant="tonal" tone="danger" onClick={handleClearAll} disabled={rows.length === 0 || clearingAll}>
            <Trash2 className="h-3.5 w-3.5" />
            {clearingAll ? "Clearing…" : "Clear All"}
          </Button>
        </div>
      </div>
      {success ? <p className="text-xs text-emerald-700">{success}</p> : null}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[75vh] overflow-auto">
          <table className="min-w-full border-collapse text-xs">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Created</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Brand Name</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Dish ID</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Dish Name</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Name Status</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Description Status</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Ingredient Status</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Addons Status</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Allergens Status</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Diets Status</th>
                <th className="sticky top-0 z-10 bg-slate-50 px-3 py-2.5 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-6 text-center text-slate-400">No experiment rows.</td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-b-0 text-slate-700 align-top">
                    <td className="px-3 py-2 whitespace-nowrap">{str(row.created_at)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{str(row.brand_name)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{str(row.dish_id)}</td>
                    <td className="px-3 py-2">{str(row.dish_name)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{renderStatusCell(row, "name_status", "Name", "before_name", "after_name", "name_label")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{renderStatusCell(row, "description_status", "Description", "before_description", "after_description", "description_label")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{renderStatusCell(row, "ingredient_status", "Ingredient", "before_ingredient", "after_ingredient", "ingredient_label")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{renderStatusCell(row, "addons_status", "Addons", "before_addons", "after_addons", "addons_label")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{renderStatusCell(row, "allergens_status", "Allergens", "before_allergens", "after_allergens", "allergens_label")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{renderStatusCell(row, "diets_status", "Diets", "before_diets", "after_diets", "diets_label")}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        tone="danger"
                        onClick={() => handleDeleteRow(row.id)}
                        disabled={busyRowId === row.id || clearingAll}
                      >
                        {busyRowId === row.id ? "Deleting…" : "Delete"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Modal
        open={statusDetail != null}
        onClose={() => setStatusDetail(null)}
        size="xxl"
        title={statusDetail ? `${statusDetail.fieldLabel} Difference` : ""}
        subtitle={statusDetail ? `${statusDetail.brandName} · ${statusDetail.dishName} (${statusDetail.dishId})` : ""}
      >
        {statusDetail ? (
          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="text-xs font-medium text-slate-600">Label</span>
              <select
                value={statusDetail.labelValue ?? ""}
                onChange={(e) => handleModalLabelChange(e.target.value)}
                disabled={busyModalLabel}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none disabled:opacity-60"
              >
                {LABEL_OPTIONS.map((option) => (
                  <option key={`modal-${option || "EMPTY"}`} value={option}>
                    {option || "—"}
                  </option>
                ))}
              </select>
            </div>
            {(() => {
              const { beforeOps, afterOps } = diffLineOps(statusDetail.beforeValue, statusDetail.afterValue);
              return (
                <div className="max-h-[75vh] overflow-auto">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <DiffColumn title="Before" ops={beforeOps} side="before" />
                    <DiffColumn title="After" ops={afterOps} side="after" />
                  </div>
                </div>
              );
            })()}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}

export default ExperimentPage;
