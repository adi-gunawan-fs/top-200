import { useMemo } from "react";
import { Card } from "./ui/Card";
import { getAnalysisReviewStatus } from "../utils/analysisReview";
import { useWeights } from "../contexts/WeightsContext";
import {
  filterChangedFieldsByRelevancy,
  getFieldRelevancy,
  hasVisibleChangedFields,
  shouldHideChangedField,
} from "../utils/filterUtils";
import { hasRelevantExportChange } from "../utils/exportComparison";

const REVIEW_STATUSES = ["Resolved", "Low Review", "Critical Review", "Judge Confused"];

function countByStatus(items) {
  const counts = { new: 0, updated: 0, deleted: 0 };
  items.forEach((item) => {
    if (item.status in counts) counts[item.status] += 1;
  });
  return counts;
}

function buildReviewCounts(items, analysisResultsMap, modelNames, weights, difficultyThreshold) {
  const counts = {
    Resolved: 0,
    "Low Review": 0,
    "Critical Review": 0,
    "Judge Confused": 0,
    "Not Analyzed": 0,
  };

  items.forEach((item) => {
    const shortKey = `${item.id}__${item.type}`;
    const modelResults = analysisResultsMap[shortKey];
    const status = getAnalysisReviewStatus(modelResults, modelNames, weights, difficultyThreshold);
    if (status && status in counts) {
      counts[status] += 1;
    } else {
      counts["Not Analyzed"] += 1;
    }
  });

  return counts;
}

function buildRelevancyCounts(items, selectedRelevancySet) {
  const counts = { Relevant: 0, "Not Relevant": 0 };
  items.forEach((item) => {
    filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancySet)
      .filter((field) => !shouldHideChangedField(item, field))
      .forEach((field) => {
        counts[getFieldRelevancy(field)] += 1;
      });
  });
  return counts;
}

function StatRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-b-0">
      <span className="text-xs text-slate-600">{label}</span>
      <span className="text-xs font-normal text-slate-600">{value}</span>
    </div>
  );
}

function ReportSection({ title, children }) {
  return (
    <div className="flex flex-col">
      <h3 className="mb-1 border-b border-slate-200 pb-1 text-[11px] font-semibold text-slate-500">
        {title}
      </h3>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

export function BrandReportCard({
  dishRows,
  selectedStatuses,
  selectedRelevancies,
  analysisResultsMap,
  modelNames,
}) {
  const { weights, difficultyThreshold } = useWeights();
  const selectedStatusSet = useMemo(() => new Set(selectedStatuses), [selectedStatuses]);
  const selectedRelevancySet = useMemo(() => new Set(selectedRelevancies), [selectedRelevancies]);

  const visibleDishes = useMemo(
    () => dishRows
      .filter((item) => selectedStatusSet.has(item.status))
      .filter((item) => hasVisibleChangedFields(item, selectedRelevancySet)),
    [dishRows, selectedStatusSet, selectedRelevancySet],
  );

  const eligibleAll = useMemo(
    () => visibleDishes.filter(hasRelevantExportChange),
    [visibleDishes],
  );

  const reviewCounts = useMemo(
    () => buildReviewCounts(eligibleAll, analysisResultsMap, modelNames, weights, difficultyThreshold),
    [eligibleAll, analysisResultsMap, modelNames, weights, difficultyThreshold],
  );
  const relevancyCounts = useMemo(
    () => buildRelevancyCounts(visibleDishes, selectedRelevancySet),
    [visibleDishes, selectedRelevancySet],
  );
  const dishStatusCounts = countByStatus(visibleDishes);

  const totalAnalyzed = REVIEW_STATUSES.reduce((sum, status) => sum + reviewCounts[status], 0);
  const totalEligible = eligibleAll.length;
  const totalRelevancy = relevancyCounts.Relevant + relevancyCounts["Not Relevant"];

  return (
    <Card>
      <Card.Header><span>Brand Report</span></Card.Header>
      <Card.Body>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2 lg:grid-cols-3">
          <ReportSection title={`Analysis Review (${totalAnalyzed}/${totalEligible})`}>
            {REVIEW_STATUSES.map((status) => (
              <StatRow
                key={status}
                label={status}
                value={
                  totalEligible > 0
                    ? `${reviewCounts[status]} (${((reviewCounts[status] / totalEligible) * 100).toFixed(2)}%)`
                    : reviewCounts[status]
                }
              />
            ))}
            <StatRow
              label="Not Analyzed"
              value={
                totalEligible > 0
                  ? `${reviewCounts["Not Analyzed"]} (${((reviewCounts["Not Analyzed"] / totalEligible) * 100).toFixed(2)}%)`
                  : reviewCounts["Not Analyzed"]
              }
            />
          </ReportSection>

          <ReportSection title={`Field Relevancy (${totalRelevancy})`}>
            <StatRow label="Relevant" value={relevancyCounts.Relevant} />
            <StatRow label="Not Relevant" value={relevancyCounts["Not Relevant"]} />
          </ReportSection>

          <ReportSection title={`Dishes (${visibleDishes.length})`}>
            {["new", "updated", "deleted"].map((status) => (
              <StatRow
                key={status}
                label={status.charAt(0).toUpperCase() + status.slice(1)}
                value={
                  visibleDishes.length > 0
                    ? `${dishStatusCounts[status]} (${((dishStatusCounts[status] / visibleDishes.length) * 100).toFixed(2)}%)`
                    : dishStatusCounts[status]
                }
              />
            ))}
          </ReportSection>
        </div>
      </Card.Body>
    </Card>
  );
}
