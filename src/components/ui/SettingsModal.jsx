import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { DEFAULT_DIFFICULTY_THRESHOLD, PARAMETER_WEIGHTS } from "../../utils/analysisReview";
import { useWeights } from "../../contexts/WeightsContext";

const LABELS = {
  text_length: "Text Length",
  numeric_noise: "Numeric Noise",
  symbol_noise: "Symbol Noise",
  repetition: "Repetition",
  alternative_branching: "Alternative Branching",
  allergen_complexity: "Allergen Complexity",
  dish_name_ambiguity: "Dish Name Ambiguity",
  format_inconsistency: "Format Inconsistency",
  structural_density: "Structural Density",
  parsing_difficulty: "Parsing Difficulty",
};

function pct(value) {
  return Math.round(value * 100);
}

function fromPct(pct) {
  return Math.round(pct) / 100;
}

export function SettingsModal({ onClose }) {
  const { weights, updateWeights, difficultyThreshold, updateDifficultyThreshold, resetWeights } = useWeights();
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, pct(v)]))
  );
  const [draftThreshold, setDraftThreshold] = useState(difficultyThreshold);

  const total = Object.values(draft).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalOk = Math.round(total) === 100;
  const thresholdOk = draftThreshold !== "" && Number(draftThreshold) >= 0 && Number(draftThreshold) <= 10;
  const canSave = totalOk && thresholdOk;

  function handleChange(key, raw) {
    setDraft((prev) => ({ ...prev, [key]: raw === "" ? "" : Number(raw) }));
  }

  function handleReset() {
    resetWeights();
    setDraft(Object.fromEntries(Object.entries(PARAMETER_WEIGHTS).map(([k, v]) => [k, pct(v)])));
    setDraftThreshold(DEFAULT_DIFFICULTY_THRESHOLD);
  }

  function handleSave() {
    const newWeights = Object.fromEntries(
      Object.entries(draft).map(([k, v]) => [k, fromPct(Number(v) || 0)])
    );
    const newThreshold = Number(draftThreshold);
    updateWeights(newWeights);
    updateDifficultyThreshold(newThreshold);
    onClose();
  }

  return (
    <Modal
      title="Settings"
      subtitle="Adjust parameter weights and difficulty threshold for complexity scoring"
      onClose={onClose}
      size="md"
      footer={
        <>
          <Button variant="ghost" tone="neutral" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" />
            Reset to defaults
          </Button>
          <Button variant="outline" tone="neutral" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="solid" tone="info" onClick={handleSave} disabled={!canSave}>
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 p-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Difficulty Threshold
          </p>
          <div className="flex items-center gap-3">
            <span className="w-44 shrink-0 text-xs text-slate-600">Hard if score &gt;</span>
            <input
              type="number"
              min={0}
              max={10}
              step={0.1}
              value={draftThreshold}
              onChange={(e) => setDraftThreshold(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
            />
            <span className="text-xs text-slate-400">/ 10</span>
            {!thresholdOk && (
              <span className="text-xs text-amber-600">Must be between 0 and 10</span>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Parameter Weights
          </p>
          <div className="flex flex-col gap-2">
            {Object.keys(PARAMETER_WEIGHTS).map((key) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-44 shrink-0 text-xs text-slate-600">{LABELS[key]}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={draft[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-right text-xs text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <span className="text-xs text-slate-400">%</span>
                <div className="flex-1">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.min(100, Number(draft[key]) || 0)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
          totalOk
            ? "border-emerald-200 bg-emerald-50"
            : "border-amber-200 bg-amber-50"
        }`}>
          <span className={`text-xs font-medium ${totalOk ? "text-emerald-700" : "text-amber-700"}`}>
            Total
          </span>
          <span className={`text-sm font-semibold tabular-nums ${totalOk ? "text-emerald-700" : "text-amber-700"}`}>
            {Math.round(total)}%
            {!totalOk && <span className="ml-2 text-xs font-normal">(must equal 100%)</span>}
          </span>
        </div>
      </div>
    </Modal>
  );
}
