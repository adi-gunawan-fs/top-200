import { useEffect, useMemo, useState } from "react";
import { fetchAnalysisResults } from "../../lib/analysisResults";
import { fetchAnalysisJobs, enqueueAnalysisJobs, cancelBulkRun } from "../../lib/analysisJobs";
import { fetchAnalysisBulkRuns } from "../../lib/analysisBulkRuns";
import { toBeforeAfterExport } from "../../utils/exportComparison";
import {
  isJobRunning,
  isBulkRunActive,
  makeShortKey,
  mapAnalysisJobs,
  mapAnalysisResults,
} from "./analysisHelpers";

// Encapsulates analysis state: initial load, 2-second polling while jobs are active,
// and the run/re-run/cancel actions. Returns everything BrandComparePage needs to render.
export function useAnalysisJobs({ beforeId, afterId }) {
  const [analysisResultsMap, setAnalysisResultsMap] = useState({});
  const [analysisJobsMap, setAnalysisJobsMap] = useState({});
  const [bulkRuns, setBulkRuns] = useState([]);
  const [isRunningAll, setIsRunningAll] = useState(false);

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

        if (cancelled) return;
        setAnalysisResultsMap(mapAnalysisResults(resultRows));
        setAnalysisJobsMap(mapAnalysisJobs(jobRows));
        setBulkRuns(bulkRunRows);
      } catch (err) {
        console.error("Failed to load analysis state:", err);
      }
    }

    loadAnalysisState();
    return () => { cancelled = true; };
  }, [beforeId, afterId]);

  const hasRunningJobs = useMemo(
    () => Object.values(analysisJobsMap).some((job) => isJobRunning(job?.status)),
    [analysisJobsMap],
  );
  const hasActiveBulkRun = useMemo(
    () => bulkRuns.some((run) => isBulkRunActive(run)),
    [bulkRuns],
  );
  const shouldPoll = hasRunningJobs || hasActiveBulkRun || isRunningAll;

  useEffect(() => {
    if (!beforeId || !afterId || beforeId === afterId) return undefined;
    if (!shouldPoll) return undefined;

    let cancelled = false;

    async function refresh() {
      try {
        const [resultRows, jobRows, bulkRunRows] = await Promise.all([
          fetchAnalysisResults(beforeId, afterId),
          fetchAnalysisJobs(beforeId, afterId),
          fetchAnalysisBulkRuns(beforeId, afterId),
        ]);
        if (cancelled) return;
        setAnalysisResultsMap(mapAnalysisResults(resultRows));
        setAnalysisJobsMap(mapAnalysisJobs(jobRows));
        setBulkRuns(bulkRunRows);
      } catch (err) {
        console.error("Failed to refresh analysis state:", err);
      }
    }

    refresh();
    const intervalId = window.setInterval(refresh, 2000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [shouldPoll, beforeId, afterId]);

  const runningKeys = useMemo(() => {
    const keys = new Set();
    Object.entries(analysisJobsMap).forEach(([shortKey, job]) => {
      if (isJobRunning(job?.status)) keys.add(shortKey);
    });
    return keys;
  }, [analysisJobsMap]);

  async function runOne(item, { replaceExisting = false } = {}) {
    const response = await enqueueAnalysisJobs({
      beforeRecordId: beforeId,
      afterRecordId: afterId,
      triggerMode: "single",
      replaceExisting,
      jobs: [{ itemId: String(item.id), itemType: String(item.type), exportItem: toBeforeAfterExport(item) }],
    });
    if (replaceExisting) {
      const shortKey = makeShortKey(item.id, item.type);
      setAnalysisResultsMap((prev) => {
        const next = { ...prev };
        delete next[shortKey];
        return next;
      });
    }
    const queuedJobs = Array.isArray(response?.jobs) ? response.jobs : [];
    setAnalysisJobsMap((prev) => ({ ...prev, ...mapAnalysisJobs(queuedJobs, "pending") }));
    const bulkRunRows = await fetchAnalysisBulkRuns(beforeId, afterId);
    setBulkRuns(bulkRunRows);
  }

  async function runMany(targetItems, { replaceExisting = false } = {}) {
    if (targetItems.length === 0) return;
    setIsRunningAll(true);
    try {
      const response = await enqueueAnalysisJobs({
        beforeRecordId: beforeId,
        afterRecordId: afterId,
        triggerMode: "bulk",
        replaceExisting,
        jobs: targetItems.map((item) => ({
          itemId: String(item.id),
          itemType: String(item.type),
          exportItem: toBeforeAfterExport(item),
        })),
      });
      if (replaceExisting) {
        const replacedKeys = new Set(targetItems.map((item) => makeShortKey(item.id, item.type)));
        setAnalysisResultsMap((prev) => Object.fromEntries(
          Object.entries(prev).filter(([shortKey]) => !replacedKeys.has(shortKey)),
        ));
      }
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

  async function cancelRun(batchId) {
    try {
      await cancelBulkRun(batchId);
      setAnalysisJobsMap((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => {
          if (isJobRunning(next[key]?.status)) {
            next[key] = { ...next[key], status: "cancelled" };
          }
        });
        return next;
      });
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

  return {
    analysisResultsMap,
    analysisJobsMap,
    bulkRuns,
    runningKeys,
    isRunningAll,
    runOne,
    runMany,
    cancelRun,
  };
}
