import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { Badge } from "./Badge";
import { IconButton } from "./Button";
import { formatAnalysisChangeStatus, calcWeightedScore, calcComplexity } from "../../utils/analysisReview";
import { toBeforeAfterExport } from "../../utils/exportComparison";
import { useWeights } from "../../contexts/WeightsContext";

const CHANGE_STATUS_TONE = {
  NO_CHANGE: "neutral",
  MINOR_CHANGE: "warning",
  SIGNIFICANT_CHANGE: "danger",
  MAJOR_CHANGE: "danger",
};

function CopyButton({ text, tone }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const colorClass = tone === "before"
    ? "text-rose-400 hover:text-rose-600"
    : "text-emerald-500 hover:text-emerald-700";

  return (
    <button type="button" onClick={handleCopy} className={`${colorClass} transition-colors`} title="Copy to clipboard">
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function InputPanel({ item }) {
  const exportData = toBeforeAfterExport(item);
  const beforeText = JSON.stringify(exportData.before, null, 2);
  const afterText = JSON.stringify(exportData.after, null, 2);

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Input</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-500">Before</p>
            <CopyButton text={beforeText} tone="before" />
          </div>
          <pre className="whitespace-pre-wrap break-words rounded border border-rose-100 bg-rose-50 p-3 text-[11px] leading-relaxed text-rose-800">
            {beforeText}
          </pre>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">After</p>
            <CopyButton text={afterText} tone="after" />
          </div>
          <pre className="whitespace-pre-wrap break-words rounded border border-emerald-100 bg-emerald-50 p-3 text-[11px] leading-relaxed text-emerald-800">
            {afterText}
          </pre>
        </div>
      </div>
    </div>
  );
}

function ModelPanel({ name, result, weights }) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-2.5">
        <p className="text-[11px] font-semibold text-slate-700">{name}</p>
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {!result ? (
          <p className="text-xs text-slate-400">No result</p>
        ) : result.error ? (
          <p className="text-xs text-rose-500">{result.error}</p>
        ) : (
          <>
            <div className="flex min-h-0 flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Output</p>
              <div className="flex flex-wrap items-center gap-1.5">
                {(() => {
                  const complexity = calcComplexity(result.parameter_scores, weights);
                  const normalizedChangeStatus = String(result.change_status ?? "").trim().toUpperCase();
                  const changeStatusTone = CHANGE_STATUS_TONE[normalizedChangeStatus] ?? "neutral";
                  return (
                    <>
                      {complexity && (
                        <Badge tone={complexity === "Hard" ? "danger" : "success"} uppercase={false}>
                          {complexity}
                        </Badge>
                      )}
                      <Badge tone={changeStatusTone} uppercase={false}>
                        {formatAnalysisChangeStatus(result.change_status)}
                      </Badge>
                    </>
                  );
                })()}
              </div>
            </div>

            {result.parameter_scores && (
              <div className="flex flex-col gap-1.5 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Scores</p>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      <th className="pb-1 text-left font-semibold">Parameter</th>
                      <th className="pb-1 text-right font-semibold">Score</th>
                      <th className="pb-1 text-right font-semibold">Weight</th>
                      <th className="pb-1 text-right font-semibold">Weighted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.parameter_scores).map(([k, v]) => {
                      const weight = weights[k];
                      const weighted = weight != null ? v * weight : null;
                      return (
                        <tr key={k} className="border-t border-slate-100">
                          <td className="py-0.5 text-slate-500">{k.replace(/_/g, " ")}</td>
                          <td className="py-0.5 text-right font-semibold text-slate-700">{v}</td>
                          <td className="py-0.5 text-right text-slate-400">{weight != null ? `${(weight * 100).toFixed(0)}%` : "-"}</td>
                          <td className="py-0.5 text-right font-semibold text-slate-700">{weighted != null ? weighted.toFixed(2) : "-"}</td>
                        </tr>
                      );
                    })}
                    {calcWeightedScore(result.parameter_scores, weights) != null && (
                      <tr className="border-t border-slate-200">
                        <td colSpan={3} className="pt-1.5 text-right font-semibold uppercase tracking-wide text-slate-500">
                          Avg
                        </td>
                        <td className="pt-1.5 text-right font-semibold text-slate-900">
                          {calcWeightedScore(result.parameter_scores, weights).toFixed(1)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex min-h-0 flex-col gap-1.5 overflow-hidden pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Critical Reasons</p>
              {result.critical_reasons?.length > 0 ? (
                <ul className="flex flex-col gap-1 overflow-y-auto pr-1">
                  {result.critical_reasons.map((r, i) => (
                    <li key={i} className="text-[11px] leading-snug text-slate-600">· {r}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-400">-</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AnalysisCompareModal({ itemLabel, itemId, item, modelNames, modelResults, onClose }) {
  const panelRef = useRef(null);
  const { weights } = useWeights();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKey = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const totalCols = 1 + modelNames.length;
  const gridCols = {
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
  }[totalCols] ?? "grid-cols-4";

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        className="flex h-[90vh] w-[90vw] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs font-semibold text-slate-900">{itemLabel}</p>
            <p className="text-[10px] text-slate-500">ID {itemId} · {modelNames.length} model{modelNames.length !== 1 ? "s" : ""} compared</p>
          </div>
          <IconButton onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" />
          </IconButton>
        </div>

        {/* Columns */}
        <div className={`grid flex-1 overflow-hidden divide-x divide-slate-200 ${gridCols}`}>
          {item && (
            <div className="overflow-hidden">
              <InputPanel item={item} />
            </div>
          )}
          {modelNames.map((name) => (
            <div key={name} className="overflow-hidden">
              <ModelPanel name={name} result={modelResults[name]} weights={weights} />
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
