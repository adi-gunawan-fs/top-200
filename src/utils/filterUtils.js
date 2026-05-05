export function getFieldRelevancy(field) {
  return field?.changeType === "Relevant" ? "Relevant" : "Not Relevant";
}

export function shouldHideChangedField(item, field) {
  if (item?.status !== "new") {
    return false;
  }

  if (field?.afterValue === null || field?.afterValue === undefined) {
    return true;
  }

  return Array.isArray(field?.afterValue) && field.afterValue.length === 0;
}

export function filterChangedFieldsByRelevancy(changedFields, selectedRelevancies) {
  return (changedFields ?? []).filter((field) => selectedRelevancies.has(getFieldRelevancy(field)));
}

export function hasVisibleChangedFields(item, selectedRelevancies) {
  return filterChangedFieldsByRelevancy(item?.changedFields, selectedRelevancies)
    .filter((field) => !shouldHideChangedField(item, field))
    .length > 0;
}

export function getVisibleChangeTypeCounts(changedFields) {
  return changedFields.reduce(
    (counts, field) => {
      counts[getFieldRelevancy(field)] += 1;
      return counts;
    },
    { Relevant: 0, "Not Relevant": 0 },
  );
}

export function getTotalVisibleChangeTypeCounts(items, selectedRelevancies) {
  return items.reduce(
    (totals, item) => {
      const visibleChangedFields = filterChangedFieldsByRelevancy(item.changedFields, selectedRelevancies)
        .filter((field) => !shouldHideChangedField(item, field));

      visibleChangedFields.forEach((field) => {
        totals[getFieldRelevancy(field)] += 1;
      });

      return totals;
    },
    { Relevant: 0, "Not Relevant": 0 },
  );
}

export function countVisibleStatuses(items) {
  return items.reduce(
    (summary, item) => {
      if (item.status === "new") {
        summary.new += 1;
      } else if (item.status === "updated") {
        summary.updated += 1;
      } else if (item.status === "deleted") {
        summary.deleted += 1;
      }
      return summary;
    },
    { deleted: 0, new: 0, updated: 0 },
  );
}

function filterHierarchyNodeByStatus(node, selectedStatuses) {
  const filteredChildren = node.children
    .map((child) => filterHierarchyNodeByStatus(child, selectedStatuses))
    .filter(Boolean);
  const filteredDishes = node.dishes.filter((dish) => selectedStatuses.has(dish.status));
  const includeSelf = selectedStatuses.has(node.item.status);
  const keepAsContext = !includeSelf && (filteredChildren.length > 0 || filteredDishes.length > 0);

  if (!includeSelf && !keepAsContext) {
    return null;
  }

  return {
    ...node,
    children: filteredChildren,
    dishes: filteredDishes,
    contextOnly: keepAsContext,
  };
}

export function filterHierarchyByStatus(roots, orphanDishes, selectedStatuses) {
  return {
    roots: roots
      .map((node) => filterHierarchyNodeByStatus(node, selectedStatuses))
      .filter(Boolean),
    orphanDishes: orphanDishes.filter((dish) => selectedStatuses.has(dish.status)),
  };
}

function passesRelevancyFilter(item, selectedRelevancies) {
  return item?.status === "unchanged" || hasVisibleChangedFields(item, selectedRelevancies);
}

function filterHierarchyNodeByRelevancy(node, selectedRelevancies) {
  const filteredChildren = node.children
    .map((child) => filterHierarchyNodeByRelevancy(child, selectedRelevancies))
    .filter(Boolean);
  const filteredDishes = node.dishes.filter((dish) => passesRelevancyFilter(dish, selectedRelevancies));
  const includeSelf = passesRelevancyFilter(node.item, selectedRelevancies);
  const keepAsContext = !includeSelf && (filteredChildren.length > 0 || filteredDishes.length > 0);

  if (!includeSelf && !keepAsContext) {
    return null;
  }

  return {
    ...node,
    children: filteredChildren,
    dishes: filteredDishes,
    contextOnly: keepAsContext,
  };
}

export function filterHierarchyByRelevancy(roots, orphanDishes, selectedRelevancies) {
  return {
    roots: roots
      .map((node) => filterHierarchyNodeByRelevancy(node, selectedRelevancies))
      .filter(Boolean),
    orphanDishes: orphanDishes.filter((dish) => passesRelevancyFilter(dish, selectedRelevancies)),
  };
}
