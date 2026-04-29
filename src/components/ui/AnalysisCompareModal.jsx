import { Badge } from "./Badge";
import { Modal } from "./Modal";

const COMPLEXITY_TONE = {
  EASY: "success",
  MEDIUM: "warning",
  HARD: "danger",
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

  const complexityTone = COMPLEXITY_TONE[result.overall_complexity] ?? "neutral";
  const changeStatusColor = CHANGE_STATUS_COLOR[result.change_status] ?? "text-slate-600";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-slate-800">{name}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={complexityTone}>{result.overall_complexity}</Badge>
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
  const subtitle = `ID ${itemId} · ${modelNames.length} model${modelNames.length !== 1 ? "s" : ""} compared`;

  return (
    <Modal title={itemLabel} subtitle={subtitle} onClose={onClose} size="xl">
      <div className="grid grid-cols-3 divide-x divide-slate-200">
        {modelNames.map((name) => (
          <div key={name} className="p-4">
            <ModelResultColumn name={name} result={modelResults[name]} />
          </div>
        ))}
      </div>
    </Modal>
  );
}
