import { useMemo } from "react";
import { Card } from "./ui/Card";
import { getAnalysisReviewStatus } from "../utils/analysisReview";
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

function buildReviewCounts(items, analysisResultsMap, modelNames) {
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
    const status = getAnalysisReviewStatus(modelResults, modelNames);
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
      <span className="text-sm font-semibold tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

function ReportSection({ title, children }) {
  return (
    <div className="flex flex-col">
      <h3 className="mb-1 border-b border-slate-200 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </h3>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

export function BrandReportCard({
  menuTitleRows,
  dishRows,
  selectedStatuses,
  selectedRelevancies,
  analysisResultsMap,
  modelNames,
}) {
  const selectedStatusSet = useMemo(() => new Set(selectedStatuses), [selectedStatuses]);
  const selectedRelevancySet = useMemo(() => new Set(selectedRelevancies), [selectedRelevancies]);

  const visibleMenuTitles = useMemo(
    () => menuTitleRows
      .filter((item) => selectedStatusSet.has(item.status))
      .filter((item) => hasVisibleChangedFields(item, selectedRelevancySet)),
    [menuTitleRows, selectedStatusSet, selectedRelevancySet],
  );
  const visibleDishes = useMemo(
    () => dishRows
      .filter((item) => selectedStatusSet.has(item.status))
      .filter((item) => hasVisibleChangedFields(item, selectedRelevancySet)),
    [dishRows, selectedStatusSet, selectedRelevancySet],
  );

  const eligibleAll = useMemo(
    () => [...visibleMenuTitles, ...visibleDishes].filter(hasRelevantExportChange),
    [visibleMenuTitles, visibleDishes],
  );

  const reviewCounts = useMemo(
    () => buildReviewCounts(eligibleAll, analysisResultsMap, modelNames),
    [eligibleAll, analysisResultsMap, modelNames],
  );
  const relevancyCounts = useMemo(
    () => buildRelevancyCounts([...visibleMenuTitles, ...visibleDishes], selectedRelevancySet),
    [visibleMenuTitles, visibleDishes, selectedRelevancySet],
  );
  const menuTitleStatusCounts = countByStatus(visibleMenuTitles);
  const dishStatusCounts = countByStatus(visibleDishes);

  const totalAnalyzed = REVIEW_STATUSES.reduce((sum, status) => sum + reviewCounts[status], 0);
  const totalEligible = eligibleAll.length;
  const totalRelevancy = relevancyCounts.Relevant + relevancyCounts["Not Relevant"];

  return (
    <Card>
      <Card.Header><span>Brand Report</span></Card.Header>
      <Card.Body>
        <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2 lg:grid-cols-4">
          <ReportSection title={`Analysis Review (${totalAnalyzed}/${totalEligible})`}>
            {REVIEW_STATUSES.map((status) => (
              <StatRow key={status} label={status} value={reviewCounts[status]} />
            ))}
            <StatRow label="Not Analyzed" value={reviewCounts["Not Analyzed"]} />
          </ReportSection>

          <ReportSection title={`Field Relevancy (${totalRelevancy})`}>
            <StatRow label="Relevant" value={relevancyCounts.Relevant} />
            <StatRow label="Not Relevant" value={relevancyCounts["Not Relevant"]} />
          </ReportSection>

          <ReportSection title={`Menu Titles (${visibleMenuTitles.length})`}>
            <StatRow label="New" value={menuTitleStatusCounts.new} />
            <StatRow label="Updated" value={menuTitleStatusCounts.updated} />
            <StatRow label="Deleted" value={menuTitleStatusCounts.deleted} />
          </ReportSection>

          <ReportSection title={`Dishes (${visibleDishes.length})`}>
            <StatRow label="New" value={dishStatusCounts.new} />
            <StatRow label="Updated" value={dishStatusCounts.updated} />
            <StatRow label="Deleted" value={dishStatusCounts.deleted} />
          </ReportSection>
        </div>
      </Card.Body>
    </Card>
  );
}
