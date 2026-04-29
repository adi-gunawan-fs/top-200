import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { parseDateValue, formatDate } from "../../utils/formatDate";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Badge } from "./Badge";
import { KpiTile } from "./KpiTile";

function formatElapsed(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function isRunActive(run) {
  return run?.status === "pending" || run?.status === "processing";
}

function StatCard({ label, value, tone = "neutral" }) {
  const className = tone === "info"
    ? "border-blue-200 bg-blue-50"
    : tone === "warning"
      ? "border-amber-200 bg-amber-50"
      : tone === "success"
        ? "border-emerald-200 bg-emerald-50"
        : tone === "danger"
          ? "border-rose-200 bg-rose-50"
          : "";

  return (
    <KpiTile label={label} className={className}>
      <p className="text-base font-semibold text-slate-900">{value}</p>
    </KpiTile>
  );
}

function RunCard({ run, index, now, showLockNote }) {
  const active = isRunActive(run);
  const doneCount = (run.completed_count ?? 0) + (run.failed_count ?? 0);
  const totalCount = run.total_items ?? 0;
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 0;
  const startedAtTs = parseDateValue(run.started_at);
  const completedAtTs = parseDateValue(run.completed_at);
  const elapsedLabel = active && startedAtTs ? formatElapsed(now - startedAtTs) : null;
  const processedLabel = !active && startedAtTs && completedAtTs ? formatElapsed(completedAtTs - startedAtTs) : "-";

  return (
    <div className={`rounded-md border ${index > 0 ? "mt-4" : ""} ${active ? "border-violet-200 bg-violet-50/30" : "border-slate-200 bg-white"}`}>
      <div className="border-b border-slate-200 px-3 py-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Badge tone={active ? "ai" : run.failed_count > 0 ? "warning" : "success"} uppercase={false}>
                {active ? <Sparkles className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                {active ? "Running" : run.failed_count > 0 ? "Completed With Failures" : "Completed"}
              </Badge>
              <span className="text-[11px] text-slate-500">Run #{index + 1}</span>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-900">
              {active ? "Bulk analysis is still processing." : "Bulk analysis finished."}
            </p>
            <div className="mt-1 text-[11px] text-slate-500">
              <p>Started: {formatDate(run.started_at)}</p>
              {!active ? <p>Completed: {formatDate(run.completed_at)}</p> : null}
            </div>
          </div>

          <KpiTile label={active ? "Elapsed" : "Processed"} className="min-w-[140px] shrink-0 text-right">
            <div className="flex items-center justify-end gap-1 text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold tabular-nums text-slate-900">{active ? elapsedLabel ?? "-" : processedLabel}</span>
            </div>
          </KpiTile>
        </div>
      </div>

      <div className="px-3 py-3">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              {active ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              )}
              <span>
                {doneCount} of {totalCount} items finished
              </span>
            </div>
            <span className="text-xs font-semibold tabular-nums text-slate-900">{progressPercent}%</span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded bg-slate-200">
            <div
              className={`h-full transition-[width] duration-700 ${active ? "bg-violet-500" : "bg-emerald-500"}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Queue state
            </span>
            <span>{active ? `${(run.processing_count ?? 0) + (run.queued_count ?? 0)} still active` : "No active jobs"}</span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <StatCard label="Total" value={run.total_items ?? 0} tone="neutral" />
          <StatCard label="Queued" value={run.queued_count ?? 0} tone="warning" />
          <StatCard label="Processing" value={run.processing_count ?? 0} tone="info" />
          <StatCard label="Completed" value={run.completed_count ?? 0} tone="success" />
          <StatCard label="Failed" value={run.failed_count ?? 0} tone="danger" />
        </div>

        {(run.failed_count ?? 0) > 0 ? (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>Some items failed in this run. Their row-level status remains available for review.</p>
          </div>
        ) : null}

        {active && showLockNote ? (
          <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            This window will unlock automatically when the active bulk analysis jobs finish.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function AnalysisProgressModal({
  open,
  onClose,
  brandName,
  runs = [],
  dismissible = true,
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const hasActiveRun = runs.some((run) => isRunActive(run));
    if (!open || !hasActiveRun) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [open, runs]);

  const activeRun = runs.find((run) => isRunActive(run)) ?? null;
  const title = activeRun ? "Bulk Analysis In Progress" : "Bulk Analysis History";
  const subtitle = brandName ? `${brandName} | ${runs.length} run${runs.length !== 1 ? "s" : ""}` : undefined;

  return (
    <Modal
      open={open}
      onClose={dismissible ? onClose : undefined}
      size="lg"
      title={title}
      subtitle={subtitle}
      footer={dismissible ? (
        <Button variant="outline" tone="neutral" onClick={onClose}>Close</Button>
      ) : null}
      closeOnOverlayClick={dismissible}
      closeOnEscape={dismissible}
    >
      <div className="p-4">
        {runs.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
            No bulk analysis runs recorded yet.
          </div>
        ) : (
          runs.map((run, index) => (
            <RunCard
              key={run.id}
              run={run}
              index={index}
              now={now}
              showLockNote={!dismissible && Boolean(activeRun) && activeRun.id === run.id}
            />
          ))
        )}
      </div>
    </Modal>
  );
}
