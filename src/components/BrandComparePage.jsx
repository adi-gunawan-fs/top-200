import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Play, Loader2, History } from "lucide-react";
import { compareMessages } from "../utils/compareMessages";
import { parseDateValue } from "../utils/formatDate";
import { buildComparisonExport, downloadExportFile, toBeforeAfterExport, hasRelevantExportChange } from "../utils/exportComparison";
import { Button, IconButton } from "./ui/Button";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { RecordSelect } from "./ui/RecordSelect";
import { RulesTooltip, ColorCodeTable } from "./ui/RulesTooltip";
import { AnalysisProgressModal } from "./ui/AnalysisProgressModal";
import { BrandReportCard } from "./BrandReportCard";
import {
  UnifiedExpandableTable,
  DEFAULT_SELECTED_STATUSES,
  DEFAULT_SELECTED_RELEVANCIES,
} from "./UnifiedExpandableTable";
import { BRAINTRUST_MODELS } from "../lib/braintrust";
import { fetchAnalysisResults, fetchBestAnalysisPair } from "../lib/analysisResults";
import { enqueueAnalysisJobs, fetchAnalysisJobs, cancelBulkRun } from "../lib/analysisJobs";
import { fetchAnalysisBulkRuns } from "../lib/analysisBulkRuns";

function makeShortKey(itemId, itemType) {
  return `${itemId}__${itemType}`;
}

function mapAnalysisResults(rows) {
  const map = {};

  rows.forEach((row) => {
    const shortKey = makeShortKey(row.item_id, row.item_type);
    const modelName = BRAINTRUST_MODELS.find((model) => model.slug === row.model_slug)?.name ?? row.model_slug;
    if (!map[shortKey]) map[shortKey] = {};
    map[shortKey][modelName] = row.result;
  });

  return map;
}

function mapAnalysisJobs(rows, forceStatus) {
  const map = {};

  rows.forEach((row) => {
    map[makeShortKey(row.item_id, row.item_type)] = forceStatus ? { ...row, status: forceStatus } : row;
  });

  return map;
}

function isJobRunning(status) {
  return status === "pending" || status === "processing";
}

function isBulkRunActive(run) {
  return run?.status === "pending" || run?.status === "processing";
}



function BrandComparePage({ group, onBack }) {
  const records = group.records ?? [];
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState(DEFAULT_SELECTED_STATUSES);
  const [selectedRelevancies, setSelectedRelevancies] = useState(DEFAULT_SELECTED_RELEVANCIES);

  const [analysisResultsMap, setAnalysisResultsMap] = useState({});
  const [analysisJobsMap, setAnalysisJobsMap] = useState({});
  const [bulkRuns, setBulkRuns] = useState([]);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runAllConfirmOpen, setRunAllConfirmOpen] = useState(false);
  const [bulkAnalysisModalOpen, setBulkAnalysisModalOpen] = useState(false);
  const [hadActiveBulkJobs, setHadActiveBulkJobs] = useState(false);

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

    const recordIds = records.map((r) => String(r.id));

    fetchBestAnalysisPair(recordIds).then((best) => {
      if (best) {
        setBeforeId(best.beforeRecordId);
        setAfterId(best.afterRecordId);
      } else {
        setBeforeId(String(before.id));
        setAfterId(String(latest.id));
      }
    }).catch(() => {
      setBeforeId(String(before.id));
      setAfterId(String(latest.id));
    });
  }, [group.key, records, recordsWithIndex]);

  useEffect(() => {
    setSelectedStatuses(DEFAULT_SELECTED_STATUSES);
    setSelectedRelevancies(DEFAULT_SELECTED_RELEVANCIES);
  }, [group.key]);

  useEffect(() => {
    setBulkAnalysisModalOpen(false);
    setBulkRuns([]);
    setHadActiveBulkJobs(false);
  }, [group.key]);

  useEffect(() => {
    const activeBulkRun = bulkRuns.find((run) => isBulkRunActive(run));

    if (activeBulkRun) {
      setBulkAnalysisModalOpen(true);
      setHadActiveBulkJobs(true);
    } else if (hadActiveBulkJobs && !isRunningAll) {
      setBulkAnalysisModalOpen(false);
      setHadActiveBulkJobs(false);
    }
  }, [bulkRuns, hadActiveBulkJobs, isRunningAll]);

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

  const eligibleItems = useMemo(() => {
    if (!comparison) return [];
    const allRows = [...menuTitleRows, ...dishRows];
    return allRows.filter((item) => selectedStatusSet.has(item.status) && hasRelevantExportChange(item));
  }, [comparison, dishRows, menuTitleRows, selectedStatusSet]);

  const eligibleItemKeys = useMemo(
    () => new Set(eligibleItems.map((item) => makeShortKey(item.id, item.type))),
    [eligibleItems],
  );

  const queueableItems = useMemo(
    () => eligibleItems.filter((item) => {
      const shortKey = makeShortKey(item.id, item.type);
      const job = analysisJobsMap[shortKey];
      const results = analysisResultsMap[shortKey];
      const hasResult = results && Object.keys(results).length > 0;
      return !isJobRunning(job?.status) && !hasResult;
    }),
    [eligibleItems, analysisJobsMap, analysisResultsMap],
  );

  useEffect(() => {
    if (!beforeId || !afterId || beforeId === afterId) {
      setAnalysisResultsMap({});
      setAnalysisJobsMap({});
      return;
    }

    let cancelled = false;

    async function loadAnalysisState() {
      try {
        const [resultRows, jobRows, bulkRunRows] = await Promise.all([
          fetchAnalysisResults(beforeId, afterId),
          fetchAnalysisJobs(beforeId, afterId),
          fetchAnalysisBulkRuns(beforeId, afterId),
        ]);

        if (cancelled) {
          return;
        }

        setAnalysisResultsMap(mapAnalysisResults(resultRows));
        setAnalysisJobsMap(mapAnalysisJobs(jobRows));
        setBulkRuns(bulkRunRows);
      } catch (err) {
        console.error("Failed to load analysis state:", err);
      }
    }

    loadAnalysisState();

    return () => {
      cancelled = true;
    };
  }, [beforeId, afterId]);

  useEffect(() => {
    if (!beforeId || !afterId || beforeId === afterId) {
      return undefined;
    }

    const hasRunningJobs = Object.values(analysisJobsMap).some((job) => isJobRunning(job?.status));
    if (!hasRunningJobs) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const [resultRows, jobRows, bulkRunRows] = await Promise.all([
          fetchAnalysisResults(beforeId, afterId),
          fetchAnalysisJobs(beforeId, afterId),
          fetchAnalysisBulkRuns(beforeId, afterId),
        ]);

        setAnalysisResultsMap(mapAnalysisResults(resultRows));
        setAnalysisJobsMap(mapAnalysisJobs(jobRows));
        setBulkRuns(bulkRunRows);
      } catch (err) {
        console.error("Failed to refresh analysis state:", err);
      }
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [analysisJobsMap, beforeId, afterId]);

  async function handleRunOne(item) {
    const response = await enqueueAnalysisJobs({
      beforeRecordId: beforeId,
      afterRecordId: afterId,
      triggerMode: "single",
      jobs: [{ itemId: String(item.id), itemType: String(item.type), exportItem: toBeforeAfterExport(item) }],
    });
    const queuedJobs = Array.isArray(response?.jobs) ? response.jobs : [];
    setAnalysisJobsMap((prev) => ({ ...prev, ...mapAnalysisJobs(queuedJobs, "pending") }));
  }

  async function handleRunAll() {
    if (!comparison || queueableItems.length === 0) return;
    setIsRunningAll(true);
    try {
      const response = await enqueueAnalysisJobs({
        beforeRecordId: beforeId,
        afterRecordId: afterId,
        triggerMode: "bulk",
        jobs: queueableItems.map((item) => ({
          itemId: String(item.id),
          itemType: String(item.type),
          exportItem: toBeforeAfterExport(item),
        })),
      });
      const queuedJobs = Array.isArray(response?.jobs) ? response.jobs : [];
      setAnalysisJobsMap((prev) => ({ ...prev, ...mapAnalysisJobs(queuedJobs, "pending") }));
      const bulkRunRows = await fetchAnalysisBulkRuns(beforeId, afterId);
      setBulkRuns(bulkRunRows);
    } catch (err) {
      console.error("Failed to enqueue analysis jobs:", err);
    } finally {
      setIsRunningAll(false);
    }
  }

  async function handleCancelBulkRun(batchId) {
    try {
      await cancelBulkRun(batchId);
      const [resultRows, jobRows, bulkRunRows] = await Promise.all([
        fetchAnalysisResults(beforeId, afterId),
        fetchAnalysisJobs(beforeId, afterId),
        fetchAnalysisBulkRuns(beforeId, afterId),
      ]);
      setAnalysisResultsMap(mapAnalysisResults(resultRows));
      setAnalysisJobsMap(mapAnalysisJobs(jobRows));
      setBulkRuns(bulkRunRows);
    } catch (err) {
      console.error("Failed to cancel bulk run:", err);
    }
  }

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

  const runningKeys = useMemo(() => {
    const keys = new Set();

    Object.entries(analysisJobsMap).forEach(([shortKey, job]) => {
      if (isJobRunning(job?.status)) {
        keys.add(shortKey);
      }
    });

    return keys;
  }, [analysisJobsMap]);

  const hasActiveAnalysisJobs = bulkRuns.some((run) => isBulkRunActive(run)) || isRunningAll;
  const hasBulkAnalysisSummary = bulkRuns.length > 0;

  return (
    <section className="flex flex-col gap-4">
      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={onBack}>
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
              <Button
                variant="tonal"
                tone="info"
                onClick={handleExportJson}
                disabled={!comparison}
              >
                <Download className="h-3.5 w-3.5" />
                Export JSON
              </Button>
              <Button
                variant="tonal"
                tone="ai"
                onClick={() => setRunAllConfirmOpen(true)}
                disabled={!comparison || isRunningAll || queueableItems.length === 0}
              >
                {isRunningAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {isRunningAll ? "Queueing Analysis..." : "Run Analysis"}
              </Button>
              {hasBulkAnalysisSummary ? (
                <IconButton
                  tone="neutral"
                  title="View analysis history"
                  aria-label="View analysis history"
                  onClick={() => setBulkAnalysisModalOpen(true)}
                >
                  <History className="h-3.5 w-3.5" />
                </IconButton>
              ) : null}
              <ConfirmDialog
                open={runAllConfirmOpen}
                title="Run analysis on all items?"
                description={`This will queue ${queueableItems.length} item${queueableItems.length !== 1 ? "s" : ""} for server-side analysis. The jobs keep running even if you close the browser after they are queued.`}
                confirmLabel="Run Analysis"
                confirmTone="ai"
                onCancel={() => setRunAllConfirmOpen(false)}
                onConfirm={() => {
                  setRunAllConfirmOpen(false);
                  setBulkAnalysisModalOpen(true);
                  handleRunAll();
                }}
              />
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

        {comparison ? null : (
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
          <BrandReportCard
            menuTitleRows={menuTitleRows}
            dishRows={dishRows}
            selectedStatuses={selectedStatuses}
            selectedRelevancies={selectedRelevancies}
            analysisResultsMap={analysisResultsMap}
            modelNames={BRAINTRUST_MODELS.map((model) => model.name)}
          />
          <UnifiedExpandableTable
            menuTitleRows={menuTitleRows}
            dishRows={dishRows}
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
            selectedRelevancies={selectedRelevancies}
            setSelectedRelevancies={setSelectedRelevancies}
            analysisResultsMap={analysisResultsMap}
            analysisJobsMap={analysisJobsMap}
            runningKeys={runningKeys}
            onRunOne={handleRunOne}
            eligibleItemKeys={eligibleItemKeys}
            modelNames={BRAINTRUST_MODELS.map((model) => model.name)}
          />
        </div>
      ) : null}

      <AnalysisProgressModal
        open={bulkAnalysisModalOpen}
        onClose={() => setBulkAnalysisModalOpen(false)}
        onCancelRun={handleCancelBulkRun}
        brandName={group.brandName}
        runs={bulkRuns}
        dismissible={!hasActiveAnalysisJobs}
      />
    </section>
  );
}

export default BrandComparePage;
