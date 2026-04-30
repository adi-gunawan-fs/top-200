import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertTriangle, XCircle } from "lucide-react";
import { parseDateValue, formatDate } from "../../utils/formatDate";
import { Drawer } from "./Drawer";
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

function isRunActive(run) {
  return run?.status === "pending" || run?.status === "processing";
}

function getRunVisuals(run) {
  if (isRunActive(run)) {
    return {
      Icon: Loader2,
      iconClass: "text-violet-600 animate-spin",
      ringClass: "border-violet-200 bg-violet-50",
      label: "Running",
      labelClass: "text-violet-700",
    };
  }
  if (run.status === "cancelled") {
    return {
      Icon: XCircle,
      iconClass: "text-slate-500",
      ringClass: "border-slate-200 bg-slate-50",
      label: "Cancelled",
      labelClass: "text-slate-600",
    };
  }
  if ((run.failed_count ?? 0) > 0) {
    return {
      Icon: AlertTriangle,
      iconClass: "text-amber-600",
      ringClass: "border-amber-200 bg-amber-50",
      label: "Completed with failures",
      labelClass: "text-amber-700",
    };
  }
  return {
    Icon: CheckCircle2,
    iconClass: "text-emerald-600",
    ringClass: "border-emerald-200 bg-emerald-50",
    label: "Completed",
    labelClass: "text-emerald-700",
  };
}

function getStatusSentence(run) {
  const total = run.total_items ?? 0;
  const completed = run.completed_count ?? 0;
  const failed = run.failed_count ?? 0;

  if (isRunActive(run)) {
    return (
      <>
        Bulk analysis is <span className="font-semibold text-slate-900">processing</span>
        {" "}
        ({completed + failed} of {total} items finished).
      </>
    );
  }
  if (run.status === "cancelled") {
    return (
      <>
        Bulk analysis was <span className="font-semibold text-slate-900">cancelled</span>
        {" "}
        ({completed} of {total} items finished).
      </>
    );
  }
  if (failed > 0) {
    return (
      <>
        Bulk analysis <span className="font-semibold text-slate-900">completed with {failed} failure{failed !== 1 ? "s" : ""}</span>
        {" "}
        ({completed} of {total} items succeeded).
      </>
    );
  }
  return (
    <>
      Bulk analysis <span className="font-semibold text-slate-900">completed successfully</span>
      {" "}
      ({completed} of {total} items finished).
    </>
  );
}

function RunActiveDetail({ run, now, onCancel, showLockNote }) {
  const doneCount = (run.completed_count ?? 0) + (run.failed_count ?? 0);
  const totalCount = run.total_items ?? 0;
  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 0;
  const startedAtTs = parseDateValue(run.started_at);
  const elapsedLabel = startedAtTs ? formatElapsed(now - startedAtTs) : "-";

  return (
    <div className="mt-2 rounded-md border border-violet-200 bg-white p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600">{doneCount} of {totalCount} items finished</span>
        <span className="font-semibold tabular-nums text-slate-900">{progressPercent}%</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded bg-slate-200">
        <div className="h-full bg-violet-500 transition-[width] duration-700" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>Elapsed <span className="font-semibold tabular-nums text-slate-700">{elapsedLabel}</span></span>
        <span>{(run.processing_count ?? 0) + (run.queued_count ?? 0)} still active</span>
      </div>

      {onCancel ? (
        <div className="mt-3 flex justify-end">
          <Button variant="outline" tone="danger" size="sm" onClick={onCancel}>
            <XCircle className="h-3.5 w-3.5" />
            Cancel All
          </Button>
        </div>
      ) : null}

      {showLockNote ? (
        <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
          This window will unlock automatically when the active bulk analysis jobs finish.
        </div>
      ) : null}
    </div>
  );
}

function TimelineItem({ run, isLast, now, onCancel, showLockNote }) {
  const { Icon, iconClass, ringClass, label, labelClass } = getRunVisuals(run);
  const active = isRunActive(run);
  const startedAtTs = parseDateValue(run.started_at);
  const completedAtTs = parseDateValue(run.completed_at);
  const durationLabel = startedAtTs && completedAtTs ? formatElapsed(completedAtTs - startedAtTs) : null;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!isLast ? (
        <span className="absolute left-[15px] top-8 -bottom-1 w-px bg-slate-200" aria-hidden="true" />
      ) : null}

      <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border ${ringClass}`}>
        <Icon className={`h-4 w-4 ${iconClass}`} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className={`text-sm font-semibold ${labelClass}`}>{label}</h3>
          <span className="text-[11px] text-slate-400">·</span>
          <span className="text-[11px] tabular-nums text-slate-500">{formatDate(run.started_at)}</span>
          {durationLabel ? (
            <>
              <span className="text-[11px] text-slate-400">·</span>
              <span className="text-[11px] tabular-nums text-slate-500">{durationLabel}</span>
            </>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-slate-600">{getStatusSentence(run)}</p>

        {active ? (
          <RunActiveDetail run={run} now={now} onCancel={onCancel} showLockNote={showLockNote} />
        ) : null}
      </div>
    </li>
  );
}

export function AnalysisProgressModal({
  open,
  onClose,
  onCancelRun,
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
  const title = activeRun ? "Analysis In Progress" : "Analysis History";
  const subtitle = brandName ? brandName : undefined;

  return (
    <Drawer
      open={open}
      onClose={dismissible ? onClose : undefined}
      size="lg"
      title={title}
      subtitle={subtitle}
      closeOnOverlayClick={dismissible}
      closeOnEscape={dismissible}
    >
      <div className="p-4">
        {runs.length === 0 ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-xs text-slate-500">
            No analysis runs recorded yet.
          </div>
        ) : (
          <ol className="flex flex-col">
            {runs.map((run, index) => (
              <TimelineItem
                key={run.id}
                run={run}
                isLast={index === runs.length - 1}
                now={now}
                onCancel={activeRun && activeRun.id === run.id && onCancelRun ? () => onCancelRun(run.id) : undefined}
                showLockNote={!dismissible && activeRun && activeRun.id === run.id}
              />
            ))}
          </ol>
        )}
      </div>
    </Drawer>
  );
}
