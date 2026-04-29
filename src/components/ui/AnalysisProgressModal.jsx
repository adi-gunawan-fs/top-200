import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, Loader2, Sparkles, AlertTriangle } from "lucide-react";
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

export function AnalysisProgressModal({
  open,
  onClose,
  brandName,
  totalCount,
  queuedCount,
  processingCount,
  completedCount,
  failedCount,
  startedAt,
  isQueueing = false,
  dismissible = true,
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open || !startedAt) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [open, startedAt]);

  const activeCount = queuedCount + processingCount;
  const doneCount = completedCount + failedCount;
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 0;
  const elapsedLabel = useMemo(
    () => formatElapsed(startedAt ? now - startedAt : 0),
    [now, startedAt],
  );
  const isFinished = totalCount > 0 && doneCount >= totalCount && !isQueueing;

  return (
    <Modal
      open={open}
      onClose={dismissible ? onClose : undefined}
      size="md"
      title={isFinished ? "Bulk Analysis Complete" : "Bulk Analysis In Progress"}
      subtitle={brandName ? `${brandName} | ${totalCount} item${totalCount !== 1 ? "s" : ""}` : undefined}
      footer={dismissible ? (
        <Button variant={isFinished ? "solid" : "outline"} tone={isFinished ? "success" : "neutral"} onClick={onClose}>
          {isFinished ? "Done" : "Hide"}
        </Button>
      ) : null}
      closeOnOverlayClick={dismissible}
      closeOnEscape={dismissible}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Badge tone={isFinished ? "success" : "ai"} uppercase={false}>
              {isFinished ? <CheckCircle2 className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
              {isFinished ? "Completed" : "Analysis Running"}
            </Badge>
            <p className="mt-2 text-xs font-semibold text-slate-900">
              {isFinished
                ? "All queued items have finished processing."
                : "Analysis is processing on the server."}
            </p>
            <p className="mt-1.5 text-xs text-slate-500">
              {isFinished
                ? "You can review the row status now. Results remain saved if you leave and come back later."
                : "This monitor stays open while analysis jobs are active so anyone on this comparison can see progress."}
            </p>
          </div>

          <KpiTile label="Elapsed" className="min-w-[120px] shrink-0 text-right">
            <div className="flex items-center justify-end gap-1 text-slate-500">
              <Clock3 className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold tabular-nums text-slate-900">{elapsedLabel}</span>
            </div>
          </KpiTile>
        </div>

        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-700">
              {isFinished ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-600" />
              )}
              <span>
                {isFinished
                  ? `${doneCount} of ${totalCount} items finished`
                  : `${doneCount} of ${totalCount} items finished so far`}
              </span>
            </div>
            <span className="text-xs font-semibold tabular-nums text-slate-900">{progressPercent}%</span>
          </div>

          <div className="mt-2 h-2 overflow-hidden rounded bg-slate-200">
            <div
              className={`h-full transition-[width] duration-700 ${isFinished ? "bg-emerald-500" : "bg-violet-500"}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5" />
              Live queue state
            </span>
            <span>{activeCount > 0 ? `${activeCount} still active` : "No active jobs"}</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-5">
          <StatCard label="Total" value={totalCount} tone="neutral" />
          <StatCard label="Queued" value={queuedCount} tone="warning" />
          <StatCard label="Processing" value={processingCount} tone="info" />
          <StatCard label="Completed" value={completedCount} tone="success" />
          <StatCard label="Failed" value={failedCount} tone="danger" />
        </div>

        {failedCount > 0 ? (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>Some items failed. Their row-level status will remain available for review after the run finishes.</p>
          </div>
        ) : null}

        {!dismissible ? (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
            This window will unlock automatically when the active analysis jobs finish.
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
