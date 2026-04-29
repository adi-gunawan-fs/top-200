import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, Clock3, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";

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

function StatCard({ label, value, tone = "slate" }) {
  const toneClasses = {
    slate: "border-slate-200 bg-white text-slate-900",
    blue: "border-blue-200 bg-blue-50/80 text-blue-900",
    amber: "border-amber-200 bg-amber-50/80 text-amber-900",
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
    rose: "border-rose-200 bg-rose-50/80 text-rose-900",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClasses[tone] ?? toneClasses.slate}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none">{value}</p>
    </div>
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
      onClose={onClose}
      size="md"
      title={isFinished ? "Bulk Analysis Complete" : "Bulk Analysis In Progress"}
      subtitle={brandName ? `${brandName} • ${totalCount} item${totalCount !== 1 ? "s" : ""}` : undefined}
      footer={(
        <Button variant={isFinished ? "solid" : "outline"} tone={isFinished ? "success" : "neutral"} onClick={onClose}>
          {isFinished ? "Done" : "Hide"}
        </Button>
      )}
      closeOnOverlayClick
    >
      <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_38%),radial-gradient(circle_at_top_right,_rgba(16,185,129,0.12),_transparent_32%),linear-gradient(180deg,_#f8fbff_0%,_#ffffff_48%,_#f8fafc_100%)] p-5">
        <div className="absolute inset-x-5 top-5 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />

        <div className="relative rounded-[28px] border border-slate-200/80 bg-white/85 p-5 shadow-[0_18px_60px_-36px_rgba(15,23,42,0.45)] backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                {isFinished ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                Analysis Monitor
              </div>
              <p className="mt-4 text-lg font-semibold text-slate-900">
                {isFinished
                  ? "All queued items have finished processing."
                  : "Your run-all analysis is processing on the server."}
              </p>
              <p className="mt-1.5 max-w-[42ch] text-sm leading-6 text-slate-600">
                {isFinished
                  ? "You can review the per-row status now. Completed results stay saved even if you leave and come back later."
                  : "You can hide this modal and continue working. Jobs keep running after the browser is closed once they are queued."}
              </p>
            </div>

            <div className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <div className="flex items-center justify-end gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                <Clock3 className="h-3.5 w-3.5" />
                Elapsed
              </div>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{elapsedLabel}</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                {isFinished ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                )}
                <span>
                  {isFinished
                    ? `${doneCount} of ${totalCount} items finished`
                    : `${doneCount} of ${totalCount} items finished so far`}
                </span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-slate-900">{progressPercent}%</span>
            </div>

            <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-[width] duration-700 ${isFinished ? "bg-emerald-500" : "bg-gradient-to-r from-blue-500 via-cyan-400 to-emerald-400"}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" />
                Live queue state
              </span>
              <span>{activeCount > 0 ? `${activeCount} still active` : "No active jobs"}</span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Total" value={totalCount} tone="slate" />
            <StatCard label="Queued" value={queuedCount} tone="amber" />
            <StatCard label="Processing" value={processingCount} tone="blue" />
            <StatCard label="Completed" value={completedCount} tone="emerald" />
            <StatCard label="Failed" value={failedCount} tone="rose" />
          </div>

          {failedCount > 0 ? (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50/85 p-4 text-sm text-rose-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Some items failed. Their row-level status will stay available for review after the run finishes.</p>
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
