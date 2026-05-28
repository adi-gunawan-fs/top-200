import { useMemo } from "react";
import { useWeights } from "../../contexts/WeightsContext";
import { Card } from "../ui/Card";
import { passesRelevancyFilter } from "../../utils/filterUtils";
import { STATUS_FILTER_OPTIONS, RELEVANCY_FILTER_OPTIONS } from "./constants";
import { DishesTable } from "./DishesTable";

export function UnifiedExpandableTable({
  dishRows,
  selectedStatuses,
  setSelectedStatuses,
  selectedRelevancies,
  setSelectedRelevancies,
  analysisResultsMap,
  analysisJobsMap,
  runningKeys,
  onRunOne,
  eligibleItemKeys,
  modelNames,
  afterRecord,
}) {
  const { weights, difficultyThreshold } = useWeights();
  const selectedRelevancySet = useMemo(() => new Set(selectedRelevancies), [selectedRelevancies]);
  const selectedStatusSet = useMemo(() => new Set(selectedStatuses), [selectedStatuses]);
  const filteredDishes = useMemo(
    () => dishRows
      .filter((dish) => selectedStatusSet.has(dish.status))
      .filter((dish) => passesRelevancyFilter(dish, selectedRelevancySet)),
    [dishRows, selectedStatusSet, selectedRelevancySet],
  );

  const toggleStatus = (status) => {
    setSelectedStatuses((prev) => (
      prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]
    ));
  };

  const toggleRelevancy = (relevancy) => {
    setSelectedRelevancies((prev) => (
      prev.includes(relevancy) ? prev.filter((item) => item !== relevancy) : [...prev, relevancy]
    ));
  };

  return (
    <Card className="overflow-visible">
      <Card.Header><span>Menu Structure</span></Card.Header>
      <Card.Toolbar>
        <span className="text-xs font-semibold text-slate-700">Filter Status</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTER_OPTIONS.map((option) => {
            const checked = selectedStatuses.includes(option.value);
            return (
              <label key={option.value} className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={checked}
                  onChange={() => toggleStatus(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
        <span className="text-xs font-semibold text-slate-700">Relevancies</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {RELEVANCY_FILTER_OPTIONS.map((option) => {
            const checked = selectedRelevancies.includes(option.value);
            return (
              <label key={option.value} className="inline-flex cursor-pointer items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  checked={checked}
                  onChange={() => toggleRelevancy(option.value)}
                />
                <span>{option.label}</span>
              </label>
            );
          })}
        </div>
      </Card.Toolbar>

      <div className="border-b border-slate-200 px-3 py-2">
        <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Dishes</span>
      </div>
      <DishesTable
        filteredDishes={filteredDishes}
        selectedRelevancySet={selectedRelevancySet}
        analysisResultsMap={analysisResultsMap}
        analysisJobsMap={analysisJobsMap}
        runningKeys={runningKeys}
        onRunOne={onRunOne}
        eligibleItemKeys={eligibleItemKeys}
        modelNames={modelNames}
        afterRecord={afterRecord}
        weights={weights}
        difficultyThreshold={difficultyThreshold}
      />
    </Card>
  );
}
