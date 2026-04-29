import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const COMPLEXITY_COLOR = {
  EASY: "text-emerald-700 bg-emerald-50 border-emerald-200",
  MEDIUM: "text-amber-700 bg-amber-50 border-amber-200",
  HARD: "text-rose-700 bg-rose-50 border-rose-200",
};

const CHANGE_STATUS_COLOR = {
  NO_CHANGE: "text-slate-600",
  MINOR_CHANGE: "text-amber-700",
  SIGNIFICANT_CHANGE: "text-rose-700",
};

function ModelResultColumn({ name, result }) {
  if (result?.error) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-slate-800">{name}</p>
        <p className="text-xs text-rose-500">{result.error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-slate-800">{name}</p>
        <p className="text-xs text-slate-400">No result</p>
      </div>
    );
  }

  const complexityColor = COMPLEXITY_COLOR[result.overall_complexity] ?? "text-slate-700 bg-slate-50 border-slate-200";
  const changeStatusColor = CHANGE_STATUS_COLOR[result.change_status] ?? "text-slate-600";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-slate-800">{name}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-semibold ${complexityColor}`}>
          {result.overall_complexity}
        </span>
        <span className={`text-[11px] font-medium ${changeStatusColor}`}>
          {result.change_status?.replace(/_/g, " ")}
        </span>
        <span className="text-[11px] text-slate-500">avg {result.average_score?.toFixed(1)}</span>
      </div>

      {result.parameter_scores && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Scores</p>
          <div className="flex flex-col gap-0.5">
            {Object.entries(result.parameter_scores).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{k.replace(/_/g, " ")}</span>
                <span className="font-semibold text-slate-700">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.critical_reasons?.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Reasons</p>
          <ul className="flex flex-col gap-1">
            {result.critical_reasons.map((r, i) => (
              <li key={i} className="text-[11px] leading-snug text-slate-600">· {r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function AnalysisCompareModal({ itemLabel, itemId, modelNames, modelResults, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const focusable = panelRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    const handleKey = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab" && focusable?.length) {
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-xs font-semibold text-slate-900">{itemLabel}</p>
            <p className="text-[10px] text-slate-500">
              ID {itemId} · {modelNames.length} model{modelNames.length !== 1 ? "s" : ""} compared
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-4 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 3-column model results */}
        <div className="grid flex-1 grid-cols-3 divide-x divide-slate-200 overflow-y-auto">
          {modelNames.map((name) => (
            <div key={name} className="p-4">
              <ModelResultColumn name={name} result={modelResults[name]} />
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
