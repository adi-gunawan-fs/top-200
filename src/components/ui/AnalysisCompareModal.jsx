import { Badge } from "./Badge";
import { Modal } from "./Modal";
import { formatAnalysisChangeStatus, calcWeightedScore, calcComplexity, PARAMETER_WEIGHTS } from "../../utils/analysisReview";

const CHANGE_STATUS_TONE = {
  NO_CHANGE: "neutral",
  MINOR_CHANGE: "warning",
  SIGNIFICANT_CHANGE: "danger",
  MAJOR_CHANGE: "danger",
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

  const normalizedChangeStatus = String(result.change_status ?? "").trim().toUpperCase();
  const changeStatusTone = CHANGE_STATUS_TONE[normalizedChangeStatus] ?? "neutral";
  const weightedScore = calcWeightedScore(result.parameter_scores);
  const complexity = calcComplexity(result.parameter_scores);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-slate-800">{name}</p>

      <div className="flex flex-wrap items-center gap-1.5">
        {complexity && (
          <Badge tone={complexity === "Hard" ? "danger" : "success"} uppercase={false}>
            {complexity}
          </Badge>
        )}
        <Badge tone={changeStatusTone} uppercase={false}>
          {formatAnalysisChangeStatus(result.change_status)}
        </Badge>
        {weightedScore != null && (
          <span className="text-[11px] text-slate-500">avg {weightedScore.toFixed(1)}</span>
        )}
      </div>

      {result.parameter_scores && (
        <div className="flex flex-col gap-1">
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
                const weight = PARAMETER_WEIGHTS[k];
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
            </tbody>
          </table>
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
