import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Play, Loader2, Info } from "lucide-react";
import { compareMessages } from "../utils/compareMessages";
import { parseDateValue } from "../utils/formatDate";
import { buildComparisonExport, downloadExportFile, toBeforeAfterExport, hasRelevantExportChange } from "../utils/exportComparison";
import {
  hasVisibleChangedFields,
  getTotalVisibleChangeTypeCounts,
  countVisibleStatuses,
} from "../utils/filterUtils";
import { Button, IconButton } from "./ui/Button";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { KpiTile } from "./ui/KpiTile";
import { StatusPill } from "./ui/StatusPill";
import { ChangeTypeCounts } from "./ui/ChangeTypeBadge";
import { RecordSelect } from "./ui/RecordSelect";
import { RulesTooltip, ColorCodeTable } from "./ui/RulesTooltip";
import { SummaryTriple } from "./ui/SummaryTriple";
import { AnalysisProgressModal } from "./ui/AnalysisProgressModal";
import {
  UnifiedExpandableTable,
  DEFAULT_SELECTED_STATUSES,
  DEFAULT_SELECTED_RELEVANCIES,
} from "./UnifiedExpandableTable";
import { BRAINTRUST_MODELS } from "../lib/braintrust";
import { fetchAnalysisResults } from "../lib/analysisResults";
import { enqueueAnalysisJobs, fetchAnalysisJobs } from "../lib/analysisJobs";

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

function mapAnalysisJobs(rows) {
  const map = {};

  rows.forEach((row) => {
    map[makeShortKey(row.item_id, row.item_type)] = row;
  });

  return map;
}

function getSharedJobTimestamp(job) {
  return job?.started_at ?? job?.created_at ?? job?.updated_at ?? null;
}

function isJobRunning(status) {
  return status === "pending" || status === "processing";
}

function isBulkJob(job) {
  return job?.trigger_mode === "bulk";
}

function hasAllModelResults(modelResults) {
  if (!modelResults) {
    return false;
  }

  return BRAINTRUST_MODELS.every((model) => modelResults[model.name]);
}

function canQueueAnalysis(shortKey, analysisResultsMap, analysisJobsMap) {
  const job = analysisJobsMap[shortKey];
  if (isJobRunning(job?.status)) {
    return false;
  }

  return !hasAllModelResults(analysisResultsMap[shortKey]);
}

function BrandComparePage({ group, onBack }) {
  const records = group.records ?? [];
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState(DEFAULT_SELECTED_STATUSES);
  const [selectedRelevancies, setSelectedRelevancies] = useState(DEFAULT_SELECTED_RELEVANCIES);

  const [analysisResultsMap, setAnalysisResultsMap] = useState({});
  const [analysisJobsMap, setAnalysisJobsMap] = useState({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [runAllConfirmOpen, setRunAllConfirmOpen] = useState(false);
  const [bulkAnalysisModalOpen, setBulkAnalysisModalOpen] = useState(false);
  const [bulkAnalysisStartedAt, setBulkAnalysisStartedAt] = useState(null);
  const [bulkAnalysisItemKeys, setBulkAnalysisItemKeys] = useState([]);
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

    setBeforeId(String(before.id));
    setAfterId(String(latest.id));
  }, [group.key, records, recordsWithIndex]);

  useEffect(() => {
    setSelectedStatuses(DEFAULT_SELECTED_STATUSES);
    setSelectedRelevancies(DEFAULT_SELECTED_RELEVANCIES);
  }, [group.key]);

  useEffect(() => {
    setBulkAnalysisModalOpen(false);
    setBulkAnalysisStartedAt(null);
    setBulkAnalysisItemKeys([]);
    setHadActiveBulkJobs(false);
  }, [group.key]);

  useEffect(() => {
    const runningJobEntries = Object.entries(analysisJobsMap)
      .filter(([, job]) => isJobRunning(job?.status) && isBulkJob(job));

    if (runningJobEntries.length > 0) {
      setBulkAnalysisModalOpen(true);
      setHadActiveBulkJobs(true);

      const runningKeys = runningJobEntries.map(([shortKey]) => shortKey);
      const earliestTimestamp = runningJobEntries
        .map(([, job]) => getSharedJobTimestamp(job))
        .filter(Boolean)
        .map((value) => new Date(value).getTime())
        .filter((value) => !Number.isNaN(value))
        .sort((a, b) => a - b)[0];

      setBulkAnalysisItemKeys((prev) => {
        if (prev.length > 0) {
          return prev;
        }
        return runningKeys;
      });

      if (earliestTimestamp) {
        setBulkAnalysisStartedAt((prev) => prev ?? earliestTimestamp);
      }
    } else if (hadActiveBulkJobs && !isRunningAll) {
      setBulkAnalysisModalOpen(false);
      setHadActiveBulkJobs(false);
    }
  }, [analysisJobsMap, bulkAnalysisItemKeys.length, bulkAnalysisStartedAt, hadActiveBulkJobs, isRunningAll]);

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
    () => eligibleItems.filter((item) => canQueueAnalysis(makeShortKey(item.id, item.type), analysisResultsMap, analysisJobsMap)),
    [eligibleItems, analysisResultsMap, analysisJobsMap],
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
        const [resultRows, jobRows] = await Promise.all([
          fetchAnalysisResults(beforeId, afterId),
          fetchAnalysisJobs(beforeId, afterId),
        ]);

        if (cancelled) {
          return;
        }

        setAnalysisResultsMap(mapAnalysisResults(resultRows));
        setAnalysisJobsMap(mapAnalysisJobs(jobRows));
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
        const [resultRows, jobRows] = await Promise.all([
          fetchAnalysisResults(beforeId, afterId),
          fetchAnalysisJobs(beforeId, afterId),
        ]);

        setAnalysisResultsMap(mapAnalysisResults(resultRows));
        setAnalysisJobsMap(mapAnalysisJobs(jobRows));
      } catch (err) {
        console.error("Failed to refresh analysis state:", err);
      }
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [analysisJobsMap, beforeId, afterId]);

  async function runAnalysisForItems(items, triggerMode = "single") {
    if (!beforeId || !afterId || items.length === 0) {
      return;
    }

    const response = await enqueueAnalysisJobs({
      beforeRecordId: beforeId,
      afterRecordId: afterId,
      triggerMode,
      jobs: items.map((item) => ({
        itemId: String(item.id),
        itemType: String(item.type),
        exportItem: toBeforeAfterExport(item),
      })),
    });

    const queuedJobs = Array.isArray(response?.jobs) ? response.jobs : [];

    setAnalysisJobsMap((prev) => ({
      ...prev,
      ...mapAnalysisJobs(queuedJobs),
    }));

    const earliestTimestamp = queuedJobs
      .map((job) => getSharedJobTimestamp(job))
      .filter(Boolean)
      .map((value) => new Date(value).getTime())
      .filter((value) => !Number.isNaN(value))
      .sort((a, b) => a - b)[0];

    if (queuedJobs.length > 0 && triggerMode === "bulk") {
      setBulkAnalysisItemKeys(items.map((item) => makeShortKey(item.id, item.type)));
    }

    if (earliestTimestamp && triggerMode === "bulk") {
      setBulkAnalysisStartedAt(earliestTimestamp);
    }
  }

  async function runAnalysisForItem(item) {
    try {
      await runAnalysisForItems([item], "single");
    } catch (err) {
      console.error("Failed to enqueue analysis for item", item.id, err);
    }
  }

  async function handleRunAll() {
    if (!comparison || queueableItems.length === 0) return;
    setIsRunningAll(true);
    try {
      await runAnalysisForItems(queueableItems, "bulk");
    } catch (err) {
      console.error("Failed to enqueue analysis jobs:", err);
    } finally {
      setIsRunningAll(false);
    }
  }

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

  const runningKeys = useMemo(() => {
    const keys = new Set();

    Object.entries(analysisJobsMap).forEach(([shortKey, job]) => {
      if (isJobRunning(job?.status)) {
        keys.add(shortKey);
      }
    });

    return keys;
  }, [analysisJobsMap]);

  const queuedOrRunningCount = useMemo(
    () => Object.values(analysisJobsMap)
      .filter((job) => isJobRunning(job?.status))
      .filter((job) => eligibleItemKeys.has(makeShortKey(job.item_id, job.item_type))).length,
    [analysisJobsMap, eligibleItemKeys],
  );

  const bulkAnalysisStats = useMemo(() => {
    if (bulkAnalysisItemKeys.length === 0) {
      return {
        totalCount: 0,
        queuedCount: 0,
        processingCount: 0,
        completedCount: 0,
        failedCount: 0,
      };
    }

    return bulkAnalysisItemKeys.reduce((acc, shortKey) => {
      const job = analysisJobsMap[shortKey];
      const results = analysisResultsMap[shortKey];

      acc.totalCount += 1;

      if (job?.status === "pending") {
        acc.queuedCount += 1;
      } else if (job?.status === "processing") {
        acc.processingCount += 1;
      } else if (job?.status === "failed") {
        acc.failedCount += 1;
      } else if (job?.status === "completed" || hasAllModelResults(results)) {
        acc.completedCount += 1;
      }

      return acc;
    }, {
      totalCount: 0,
      queuedCount: 0,
      processingCount: 0,
      completedCount: 0,
      failedCount: 0,
    });
  }, [analysisJobsMap, analysisResultsMap, bulkAnalysisItemKeys]);

  const hasActiveAnalysisJobs = bulkAnalysisStats.queuedCount + bulkAnalysisStats.processingCount > 0 || isRunningAll;
  const hasBulkAnalysisSummary = bulkAnalysisStats.totalCount > 0;

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
                {isRunningAll
                  ? "Queueing Analysis..."
                  : `Run Analysis (${queueableItems.length} items${queuedOrRunningCount > 0 ? `, ${queuedOrRunningCount} running` : ""})`}
              </Button>
              {hasBulkAnalysisSummary ? (
                <IconButton
                  tone="neutral"
                  title="View bulk analysis status"
                  aria-label="View bulk analysis status"
                  onClick={() => setBulkAnalysisModalOpen(true)}
                >
                  <Info className="h-3.5 w-3.5" />
                </IconButton>
              ) : null}
              <ConfirmDialog
                open={runAllConfirmOpen}
                title="Run analysis on all items?"
                description={`This will queue ${queueableItems.length} item${queueableItems.length !== 1 ? "s" : ""} for server-side analysis, skipping rows that already have completed analysis. The jobs keep running even if you close the browser after they are queued.`}
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

        {comparison ? (
          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-4">
            <KpiTile label="Menu decision">
              <div className="flex items-center gap-2">
                <StatusPill status={comparison.menu.status} />
                <span className="text-slate-700">{comparison.menu.reason}</span>
              </div>
            </KpiTile>
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
            <KpiTile label="Visible Field Relevancy">
              <ChangeTypeCounts counts={visibleChangeTypeCounts} />
            </KpiTile>
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
            analysisResultsMap={analysisResultsMap}
            runningKeys={runningKeys}
            onRunOne={runAnalysisForItem}
            eligibleItemKeys={eligibleItemKeys}
            modelNames={BRAINTRUST_MODELS.map((model) => model.name)}
          />
        </div>
      ) : null}

      <AnalysisProgressModal
        open={bulkAnalysisModalOpen}
        onClose={() => setBulkAnalysisModalOpen(false)}
        brandName={group.brandName}
        totalCount={bulkAnalysisStats.totalCount}
        queuedCount={bulkAnalysisStats.queuedCount}
        processingCount={bulkAnalysisStats.processingCount}
        completedCount={bulkAnalysisStats.completedCount}
        failedCount={bulkAnalysisStats.failedCount}
        startedAt={bulkAnalysisStartedAt}
        isQueueing={isRunningAll}
        dismissible={!hasActiveAnalysisJobs}
      />
    </section>
  );
}

export default BrandComparePage;
