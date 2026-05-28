import { useState } from "react";
import { AlertTriangle, Loader2, RefreshCw, Search, Sparkles } from "lucide-react";
import { Badge } from "../ui/Badge";
import { Button, IconButton } from "../ui/Button";
import { ChangedFieldsModal } from "../ui/ChangedFieldsModal";
import { AnalysisCompareModal } from "../ui/AnalysisCompareModal";
import { getAnalysisReviewStatus, getAnalysisReviewTone } from "../../utils/analysisReview";
import { filterChangedFieldsByRelevancy, shouldHideChangedField } from "../../utils/filterUtils";

export function ChangedFieldsCell({ item, selectedRelevancies }) {
  const [open, setOpen] = useState(false);
  const visibleChangedFields = filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancies)
    .filter((field) => !shouldHideChangedField(item, field));

  if (!visibleChangedFields.length) {
    return <span className="text-slate-400">-</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-blue-700 hover:text-blue-900 hover:underline focus:outline-none"
      >
        {visibleChangedFields.length} field{visibleChangedFields.length > 1 ? "s" : ""} changed
      </button>
      {open ? (
        <ChangedFieldsModal
          item={item}
          fields={visibleChangedFields}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export function AnalysisCell({ item, shortKey, job, modelNames, analysisResultsMap, runningKeys, onRunOne }) {
  const modelResults = analysisResultsMap[shortKey] ?? {};
  const isRunning = runningKeys.has(shortKey);
  const isFailed = job?.status === "failed";
  const hasAnyResult = modelNames.some((name) => modelResults[name] && !modelResults[name].error);
  const [modalOpen, setModalOpen] = useState(false);
  const [errorExpanded, setErrorExpanded] = useState(false);
  const [isSending, setIsSending] = useState(false);

  async function handleRun(replaceExisting = false) {
    setIsSending(true);
    try {
      await onRunOne(item, { replaceExisting });
    } finally {
      setIsSending(false);
    }
  }

  if (isSending) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Sending…
      </span>
    );
  }

  if (isRunning) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Analysing…
      </span>
    );
  }

  if (isFailed && !hasAnyResult) {
    const errorMessage = job?.error_message ?? "";

    return (
      <div className="flex max-w-64 flex-col gap-1">
        <span className="text-[10px] font-semibold text-rose-500" title={job?.error_message ?? "Analysis failed"}>
          Failed
        </span>
        {errorMessage ? (
          <>
            <span
              className={`${errorExpanded ? "whitespace-pre-wrap break-words" : "line-clamp-2"} text-[10px] text-rose-600`}
              title={errorMessage}
            >
              {errorMessage}
            </span>
            <button
              type="button"
              className="w-fit text-[10px] font-semibold text-rose-700 hover:text-rose-900 hover:underline focus:outline-none"
              onClick={() => setErrorExpanded((prev) => !prev)}
            >
              {errorExpanded ? "Show less" : "Show full error"}
            </button>
          </>
        ) : null}
        <Button variant="tonal" tone="warning" size="xs" onClick={() => handleRun(true)}>
          <RefreshCw className="h-2.5 w-2.5" />
          Re-run
        </Button>
      </div>
    );
  }

  if (!hasAnyResult) {
    return (
      <Button variant="tonal" tone="info" size="xs" onClick={() => handleRun(false)}>
        <Sparkles className="h-2.5 w-2.5" />
        {isFailed ? "Retry" : "Run"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <IconButton onClick={() => setModalOpen(true)} title="Compare models" aria-label="Compare models">
        <Search className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        tone="warning"
        onClick={() => handleRun(true)}
        title="Re-run analysis and replace previous data"
        aria-label="Re-run analysis and replace previous data"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </IconButton>

      {modalOpen && (
        <AnalysisCompareModal
          itemLabel={item.name || item.title || String(item.id)}
          itemId={item.id}
          item={item}
          modelNames={modelNames}
          modelResults={modelResults}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

export function AnalysisStatusCell({ shortKey, modelNames, analysisResultsMap, runningKeys, isEligible, weights, difficultyThreshold }) {
  if (!isEligible) {
    return <span className="text-slate-400">-</span>;
  }

  if (runningKeys.has(shortKey)) {
    return <span className="text-slate-400">-</span>;
  }

  const status = getAnalysisReviewStatus(analysisResultsMap[shortKey], modelNames, weights, difficultyThreshold);
  if (!status) {
    return <span className="text-slate-400">-</span>;
  }

  const icon = status === "Critical Review"
    ? <AlertTriangle className="h-2.5 w-2.5" />
    : status === "Low Review"
      ? <AlertTriangle className="h-2.5 w-2.5" />
      : null;

  return (
    <Badge tone={getAnalysisReviewTone(status)} uppercase={false}>
      {icon}
      {status}
    </Badge>
  );
}
