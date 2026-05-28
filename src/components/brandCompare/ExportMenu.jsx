import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { Button } from "../ui/Button";
import { buildComparisonExport, downloadExportFile, hasRelevantExportChange } from "../../utils/exportComparison";
import { hasVisibleChangedFields } from "../../utils/filterUtils";
import { buildFilteredDishesExportCsv, exportSingleBrandToCSV } from "../../lib/exports";

// Encapsulates the Export dropdown (CSV / JSON / Sheets) and its progress + error state.
export function ExportMenu({
  session,
  comparison,
  beforeRecord,
  afterRecord,
  isValidSelection,
  group,
  dishRows,
  selectedStatusSet,
  selectedRelevancySet,
  onExportDone,
}) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingSheets, setExportingSheets] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportSheetsError, setExportSheetsError] = useState("");
  const [exportSnapshotProgress, setExportSnapshotProgress] = useState(null);
  const [exportSheetsProgress, setExportSheetsProgress] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    }
    function handleKey(event) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function handleExportToCsv() {
    if (exporting || !session || !beforeRecord || !afterRecord) return;
    setExporting(true);
    setExportError("");
    setExportSnapshotProgress(null);
    try {
      const saved = await exportSingleBrandToCSV(beforeRecord, afterRecord, group.brandName, session.user.id, {
        onProgress: ({ done, total }) => setExportSnapshotProgress({ done, total }),
      });
      onExportDone?.(saved);
    } catch (err) {
      console.error("Single-brand export failed:", err);
      setExportError(err?.message ?? "Export failed.");
    } finally {
      setExporting(false);
      setExportSnapshotProgress(null);
    }
  }

  async function handleExportSheets() {
    if (exportingSheets || !afterRecord || !beforeRecord) return;
    setExportingSheets(true);
    setExportSheetsError("");
    setExportSheetsProgress(null);
    try {
      const filteredDishIds = dishRows
        .filter((item) => selectedStatusSet.has(item.status))
        .filter((item) => hasVisibleChangedFields(item, selectedRelevancySet))
        .map((item) => item.id);

      const { csvContent, filename } = await buildFilteredDishesExportCsv({
        beforeRecord,
        afterRecord,
        brandName: group.brandName,
        filteredDishIds,
        onProgress: ({ done, total }) => setExportSheetsProgress({ done, total }),
      });

      downloadExportFile(csvContent, "text/csv;charset=utf-8;", filename);
    } catch (err) {
      console.error("Export sheets failed:", err);
      setExportSheetsError(err?.message ?? "Export Sheets failed.");
    } finally {
      setExportingSheets(false);
      setExportSheetsProgress(null);
    }
  }

  function handleExportJson() {
    if (!comparison) return;

    const visibleDishRows = dishRows.filter((item) => selectedStatusSet.has(item.status));
    const exportPayload = buildComparisonExport({ visibleDishRows });
    const jsonContent = JSON.stringify(exportPayload, null, 2);
    const safeBrand = String(group.brandName ?? "brand").replace(/[^\w-]+/g, "_");
    const safeMenuId = String(group.menuId ?? "menu").replace(/[^\w-]+/g, "_");

    downloadExportFile(
      jsonContent,
      "application/json;charset=utf-8;",
      `${safeBrand}_${safeMenuId}_comparison_export.json`,
    );
  }

  const label = exporting
    ? exportSnapshotProgress
      ? `Fetching snapshots… ${exportSnapshotProgress.done}/${exportSnapshotProgress.total}`
      : "Exporting CSV…"
    : exportingSheets
      ? exportSheetsProgress
        ? `Exporting Sheets… ${exportSheetsProgress.done}/${exportSheetsProgress.total}`
        : "Exporting Sheets…"
      : "Export";

  return (
    <>
      <div className="relative inline-flex" ref={menuRef}>
        <Button
          variant="tonal"
          tone="info"
          onClick={() => setOpen((o) => !o)}
          disabled={!comparison}
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {exporting || exportingSheets ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {label}
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        {open ? (
          <div
            role="menu"
            className="absolute left-0 top-[calc(100%+4px)] z-50 min-w-[180px] rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          >
            {session ? (
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                disabled={exporting || !isValidSelection}
                onClick={() => { setOpen(false); handleExportToCsv(); }}
              >
                <Download className="h-3.5 w-3.5" />
                Export to CSV
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={!comparison}
              onClick={() => { setOpen(false); handleExportJson(); }}
            >
              <Download className="h-3.5 w-3.5" />
              Export JSON
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
              disabled={!isValidSelection || exportingSheets}
              onClick={() => { setOpen(false); handleExportSheets(); }}
            >
              <Download className="h-3.5 w-3.5" />
              Export Sheets
            </button>
          </div>
        ) : null}
      </div>
      {exportError ? <span className="text-xs text-rose-600">{exportError}</span> : null}
      {exportSheetsError ? <span className="text-xs text-rose-600">{exportSheetsError}</span> : null}
    </>
  );
}
