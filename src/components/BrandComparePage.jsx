import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download } from "lucide-react";
import { compareMessages } from "../utils/compareMessages";
import { formatDate, parseDateValue } from "../utils/formatDate";
import { buildComparisonExport, downloadExportFile } from "../utils/exportComparison";
import {
  hasVisibleChangedFields,
  getTotalVisibleChangeTypeCounts,
  countVisibleStatuses,
} from "../utils/filterUtils";
import { StatusPill } from "./ui/StatusPill";
import { ChangeTypeCounts } from "./ui/ChangeTypeBadge";
import { RecordSelect } from "./ui/RecordSelect";
import { RulesTooltip, ColorCodeTable } from "./ui/RulesTooltip";
import { SummaryTriple } from "./ui/SummaryTriple";
import {
  UnifiedExpandableTable,
  DEFAULT_SELECTED_STATUSES,
  DEFAULT_SELECTED_RELEVANCIES,
} from "./UnifiedExpandableTable";

function BrandComparePage({ group, onBack }) {
  const records = group.records ?? [];
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState(DEFAULT_SELECTED_STATUSES);
  const [selectedRelevancies, setSelectedRelevancies] = useState(DEFAULT_SELECTED_RELEVANCIES);

  const recordsWithIndex = useMemo(
    () => records.map((record, index) => ({ record, index })),
    [records],
  );

  const recordTimeById = useMemo(() => {
    const map = new Map();
    records.forEach((record) => {
      map.set(String(record.id), parseDateValue(record.updatedAt));
    });
    return map;
  }, [records]);

  useEffect(() => {
    if (records.length === 0) {
      setBeforeId("");
      setAfterId("");
      return;
    }

    const sorted = [...recordsWithIndex].sort((a, b) => {
      const aTime = parseDateValue(a.record.updatedAt);
      const bTime = parseDateValue(b.record.updatedAt);

      if (aTime !== null && bTime !== null && aTime !== bTime) {
        return aTime - bTime;
      }

      return a.index - b.index;
    });

    const latest = sorted[sorted.length - 1]?.record ?? records[records.length - 1];
    const before = sorted[sorted.length - 2]?.record ?? sorted[0]?.record ?? records[0];

    setBeforeId(String(before.id));
    setAfterId(String(latest.id));
  }, [group.key, records, recordsWithIndex]);

  useEffect(() => {
    setSelectedStatuses(DEFAULT_SELECTED_STATUSES);
    setSelectedRelevancies(DEFAULT_SELECTED_RELEVANCIES);
  }, [group.key]);

  const beforeRecord = records.find((record) => String(record.id) === beforeId);
  const afterRecord = records.find((record) => String(record.id) === afterId);
  const selectedStatusSet = useMemo(() => new Set(selectedStatuses), [selectedStatuses]);
  const selectedRelevancySet = useMemo(() => new Set(selectedRelevancies), [selectedRelevancies]);
  const beforeTime = beforeId ? recordTimeById.get(beforeId) ?? null : null;
  const afterTime = afterId ? recordTimeById.get(afterId) ?? null : null;
  const isChronologicalSelection = beforeRecord && afterRecord
    ? beforeTime === null || afterTime === null || afterTime >= beforeTime
    : false;
  const isValidSelection = beforeRecord && afterRecord && beforeRecord.id !== afterRecord.id && isChronologicalSelection;
  const comparison = isValidSelection ? compareMessages(beforeRecord, afterRecord) : null;
  const invalidOrderSelection = Boolean(
    beforeRecord && afterRecord && beforeRecord.id !== afterRecord.id && !isChronologicalSelection,
  );
  const selectionMessage = invalidOrderSelection
    ? "After (updatedAt) must be newer than or equal to Before (updatedAt)."
    : "Select two different records to compare.";

  const dishRows = comparison ? comparison.changes.dishes : [];
  const menuTitleRows = comparison ? comparison.changes.menuTitles : [];

  const visibleChangeTypeCounts = useMemo(() => {
    if (!comparison) return { Relevant: 0, "Not Relevant": 0 };
    const visibleItems = [...menuTitleRows, ...dishRows].filter((item) => selectedStatusSet.has(item.status));
    return getTotalVisibleChangeTypeCounts(visibleItems, selectedRelevancySet);
  }, [comparison, dishRows, menuTitleRows, selectedRelevancySet, selectedStatusSet]);

  const visibleMenuTitleSummary = useMemo(() => {
    if (!comparison) return { deleted: 0, new: 0, updated: 0 };
    const visibleMenuTitles = menuTitleRows
      .filter((item) => selectedStatusSet.has(item.status))
      .filter((item) => hasVisibleChangedFields(item, selectedRelevancySet));
    return countVisibleStatuses(visibleMenuTitles);
  }, [comparison, menuTitleRows, selectedRelevancySet, selectedStatusSet]);

  const visibleDishSummary = useMemo(() => {
    if (!comparison) return { deleted: 0, new: 0, updated: 0 };
    const visibleDishes = dishRows
      .filter((item) => selectedStatusSet.has(item.status))
      .filter((item) => hasVisibleChangedFields(item, selectedRelevancySet));
    return countVisibleStatuses(visibleDishes);
  }, [comparison, dishRows, selectedRelevancySet, selectedStatusSet]);

  function getBeforeOptionDisableReason(record) {
    const key = String(record.id);
    if (afterId && key === afterId) return "same as After";
    if (!afterId) return null;

    const candidateTime = recordTimeById.get(key);
    const selectedAfterTime = recordTimeById.get(afterId) ?? null;
    if (candidateTime === null || selectedAfterTime === null) return null;
    if (candidateTime > selectedAfterTime) return "newer than After";
    return null;
  }

  function getAfterOptionDisableReason(record) {
    const key = String(record.id);
    if (beforeId && key === beforeId) return "same as Before";
    if (!beforeId) return null;

    const candidateTime = recordTimeById.get(key);
    const selectedBeforeTime = recordTimeById.get(beforeId) ?? null;
    if (candidateTime === null || selectedBeforeTime === null) return null;
    if (candidateTime < selectedBeforeTime) return "older than Before";
    return null;
  }

  function handleExportJson() {
    if (!comparison) return;

    const visibleMenuTitleRows = menuTitleRows.filter((item) => selectedStatusSet.has(item.status));
    const visibleDishRows = dishRows.filter((item) => selectedStatusSet.has(item.status));
    const exportPayload = buildComparisonExport({ visibleMenuTitleRows, visibleDishRows });
    const jsonContent = JSON.stringify(exportPayload, null, 2);
    const safeBrand = String(group.brandName ?? "brand").replace(/[^\w-]+/g, "_");
    const safeMenuId = String(group.menuId ?? "menu").replace(/[^\w-]+/g, "_");

    downloadExportFile(
      jsonContent,
      "application/json;charset=utf-8;",
      `${safeBrand}_${safeMenuId}_comparison_export.json`,
    );
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                disabled={!comparison}
                className="inline-flex items-center gap-1 rounded-md border border-blue-300 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                <Download className="h-3.5 w-3.5" />
                Export JSON
              </button>
            </div>
            <h2 className="mt-2 text-base font-semibold text-slate-900">{group.brandName}</h2>
            <p className="mt-1 text-xs text-slate-600">
              Menu ID {group.menuId} | {records.length} records
            </p>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 lg:w-[760px] lg:grid-cols-2">
            <RecordSelect
              label="Before (updatedAt)"
              value={beforeId}
              onChange={setBeforeId}
              records={records}
              getOptionDisableReason={getBeforeOptionDisableReason}
            />
            <RecordSelect
              label="After (updatedAt)"
              value={afterId}
              onChange={setAfterId}
              records={records}
              getOptionDisableReason={getAfterOptionDisableReason}
            />
          </div>
        </div>

        <p className="mt-2 text-[11px] text-slate-500">
          Disabled options are marked in the dropdown, for example: <span className="font-semibold">(older than Before)</span>.
        </p>

        {comparison ? (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-4">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
              <p className="text-slate-500">Menu decision</p>
              <div className="mt-1 flex items-center gap-2">
                <StatusPill status={comparison.menu.status} />
                <span className="text-slate-700">{comparison.menu.reason}</span>
              </div>
            </div>
            <SummaryTriple
              label="Menu Title"
              deleted={visibleMenuTitleSummary.deleted}
              added={visibleMenuTitleSummary.new}
              updated={visibleMenuTitleSummary.updated}
            />
            <SummaryTriple
              label="Dishes"
              deleted={visibleDishSummary.deleted}
              added={visibleDishSummary.new}
              updated={visibleDishSummary.updated}
            />
            <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs">
              <p className="text-slate-500">Visible Field Relevancy</p>
              <div className="mt-1">
                <ChangeTypeCounts counts={visibleChangeTypeCounts} />
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-xs text-rose-600">{selectionMessage}</p>
        )}

        {comparison ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <RulesTooltip itemType="menuTitle" label="Menu Title Rules" align="left" />
            <RulesTooltip itemType="dish" label="Dishes Rules" align="left" />
            <RulesTooltip label="Color Code" align="left" content={<ColorCodeTable />} />
          </div>
        ) : null}
      </header>

      {comparison ? (
        <div className="flex flex-col gap-4">
          <UnifiedExpandableTable
            menuTitleRows={menuTitleRows}
            dishRows={dishRows}
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
            selectedRelevancies={selectedRelevancies}
            setSelectedRelevancies={setSelectedRelevancies}
          />
        </div>
      ) : null}
    </section>
  );
}

export default BrandComparePage;
