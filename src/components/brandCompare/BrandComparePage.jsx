import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, History, Loader2, Play, RefreshCw } from "lucide-react";
import { compareMessages } from "../../utils/compareMessages";
import { parseDateValue } from "../../utils/formatDate";
import { hasRelevantExportChange } from "../../utils/filterUtils";
import { fetchPublishedDishIds } from "../../lib/api";
import { fetchBestAnalysisPair } from "../../lib/analysisResults";
import { BRAINTRUST_MODELS } from "../../lib/braintrust";
import { Button, IconButton } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { RecordSelect } from "../ui/RecordSelect";
import { RulesTooltip, ColorCodeTable } from "../ui/RulesTooltip";
import { AnalysisProgressModal } from "../ui/AnalysisProgressModal";
import { BrandReportCard } from "../BrandReportCard";
import {
  UnifiedExpandableTable,
  DEFAULT_SELECTED_STATUSES,
  DEFAULT_SELECTED_RELEVANCIES,
} from "../UnifiedExpandableTable";
import { isBulkRunActive, isJobRunning, makeShortKey } from "./analysisHelpers";
import { useAnalysisJobs } from "./useAnalysisJobs";
import { ExportMenu } from "./ExportMenu";

function BrandComparePage({ group, onBack, session, onExportDone }) {
  const records = group.records ?? [];
  const [beforeId, setBeforeId] = useState("");
  const [afterId, setAfterId] = useState("");
  const [selectedStatuses, setSelectedStatuses] = useState(DEFAULT_SELECTED_STATUSES);
  const [selectedRelevancies, setSelectedRelevancies] = useState(DEFAULT_SELECTED_RELEVANCIES);
  const [runAllConfirmOpen, setRunAllConfirmOpen] = useState(false);
  const [rerunAllConfirmOpen, setRerunAllConfirmOpen] = useState(false);
  const [bulkAnalysisModalOpen, setBulkAnalysisModalOpen] = useState(false);
  const [hadActiveBulkJobs, setHadActiveBulkJobs] = useState(false);
  const [publishedDishIdSet, setPublishedDishIdSet] = useState(null);

  const {
    analysisResultsMap,
    analysisJobsMap,
    bulkRuns,
    runningKeys,
    isRunningAll,
    runOne,
    runMany,
    cancelRun,
  } = useAnalysisJobs({ beforeId, afterId });

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
      if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime;
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
    setHadActiveBulkJobs(false);
  }, [group.key]);

  useEffect(() => {
    const activeBulkRun = bulkRuns.find((run) => isBulkRunActive(run) && run.trigger_mode !== "single");

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

  const rawDishRows = comparison ? comparison.changes.dishes : [];
  const dishRows = useMemo(() => {
    if (!comparison) return [];
    if (!publishedDishIdSet) return [];
    return rawDishRows.filter((item) => publishedDishIdSet.has(String(item.id)));
  }, [comparison, rawDishRows, publishedDishIdSet]);

  useEffect(() => {
    if (!comparison) {
      setPublishedDishIdSet(new Set());
      return;
    }

    const dishIds = rawDishRows.map((item) => item.id);
    if (dishIds.length === 0) {
      setPublishedDishIdSet(new Set());
      return;
    }

    let cancelled = false;
    fetchPublishedDishIds(dishIds)
      .then((set) => { if (!cancelled) setPublishedDishIdSet(set); })
      .catch((err) => {
        console.error("Failed to load published dish filter:", err);
        if (!cancelled) setPublishedDishIdSet(new Set());
      });

    return () => { cancelled = true; };
  }, [comparison, rawDishRows]);

  const eligibleItems = useMemo(() => {
    if (!comparison) return [];
    return dishRows.filter((item) => selectedStatusSet.has(item.status) && hasRelevantExportChange(item));
  }, [comparison, dishRows, selectedStatusSet]);

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

  const rerunnableItems = useMemo(
    () => eligibleItems.filter((item) => {
      const shortKey = makeShortKey(item.id, item.type);
      const job = analysisJobsMap[shortKey];
      return !isJobRunning(job?.status);
    }),
    [eligibleItems, analysisJobsMap],
  );

  const hasActiveAnalysisJobs = bulkRuns.some((run) => isBulkRunActive(run) && run.trigger_mode !== "single") || isRunningAll;
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
              <ExportMenu
                session={session}
                comparison={comparison}
                beforeRecord={beforeRecord}
                afterRecord={afterRecord}
                isValidSelection={isValidSelection}
                group={group}
                dishRows={dishRows}
                selectedStatusSet={selectedStatusSet}
                selectedRelevancySet={selectedRelevancySet}
                onExportDone={onExportDone}
              />
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
              <Button
                variant="tonal"
                tone="warning"
                onClick={() => setRerunAllConfirmOpen(true)}
                disabled={!comparison || isRunningAll || rerunnableItems.length === 0}
              >
                {isRunningAll ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Re-run Analysis
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
                  runMany(queueableItems);
                }}
              />
              <ConfirmDialog
                open={rerunAllConfirmOpen}
                title="Re-run analysis and replace previous data?"
                description={`This will delete previous analysis data for ${rerunnableItems.length} item${rerunnableItems.length !== 1 ? "s" : ""}, then queue a fresh server-side analysis run.`}
                confirmLabel="Re-run Analysis"
                confirmTone="warning"
                onCancel={() => setRerunAllConfirmOpen(false)}
                onConfirm={() => {
                  setRerunAllConfirmOpen(false);
                  setBulkAnalysisModalOpen(true);
                  runMany(rerunnableItems, { replaceExisting: true });
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
              getOptionDisableReason={(record) => {
                const key = String(record.id);
                if (afterId && key === afterId) return "same as After";
                if (!afterId) return null;
                const candidateTime = recordTimeById.get(key);
                const selectedAfterTime = recordTimeById.get(afterId) ?? null;
                if (candidateTime === null || selectedAfterTime === null) return null;
                if (candidateTime > selectedAfterTime) return "newer than After";
                return null;
              }}
            />
            <RecordSelect
              label="After (updatedAt)"
              value={afterId}
              onChange={setAfterId}
              records={records}
              getOptionDisableReason={(record) => {
                const key = String(record.id);
                if (beforeId && key === beforeId) return "same as Before";
                if (!beforeId) return null;
                const candidateTime = recordTimeById.get(key);
                const selectedBeforeTime = recordTimeById.get(beforeId) ?? null;
                if (candidateTime === null || selectedBeforeTime === null) return null;
                if (candidateTime < selectedBeforeTime) return "older than Before";
                return null;
              }}
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
            <RulesTooltip itemType="dish" label="Dishes Rules" align="left" />
            <RulesTooltip label="Color Code" align="left" content={<ColorCodeTable />} />
          </div>
        ) : null}
      </header>

      {comparison ? (
        <div className="flex flex-col gap-4">
          <BrandReportCard
            dishRows={dishRows}
            selectedStatuses={selectedStatuses}
            selectedRelevancies={selectedRelevancies}
            analysisResultsMap={analysisResultsMap}
            modelNames={BRAINTRUST_MODELS.map((model) => model.name)}
          />
          <UnifiedExpandableTable
            dishRows={dishRows}
            selectedStatuses={selectedStatuses}
            setSelectedStatuses={setSelectedStatuses}
            selectedRelevancies={selectedRelevancies}
            setSelectedRelevancies={setSelectedRelevancies}
            analysisResultsMap={analysisResultsMap}
            analysisJobsMap={analysisJobsMap}
            runningKeys={runningKeys}
            onRunOne={runOne}
            eligibleItemKeys={eligibleItemKeys}
            modelNames={BRAINTRUST_MODELS.map((model) => model.name)}
            afterRecord={afterRecord}
          />
        </div>
      ) : null}

      <AnalysisProgressModal
        open={bulkAnalysisModalOpen}
        onClose={() => setBulkAnalysisModalOpen(false)}
        onCancelRun={cancelRun}
        brandName={group.brandName}
        runs={bulkRuns}
        dismissible={!hasActiveAnalysisJobs}
      />
    </section>
  );
}

export default BrandComparePage;
