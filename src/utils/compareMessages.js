function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export const CHANGE_TYPE_RULES = {
  dish: {
    id: "Not Relevant",
    name: "Relevant",
    diets: "Relevant",
    price: "Not Relevant",
    addons: "Relevant",
    menuId: "Not Relevant",
    calories: "Not Relevant",
    miscInfo: "Not Relevant",
    allergens: "Relevant",
    modifiedAt: "Not Relevant",
    nutritions: "Not Relevant",
    description: "Relevant",
    ingredients: "Relevant",
    menuTitleId: "Not Relevant",
  },
  menuTitle: {
    id: "Not Relevant",
    diets: "Relevant",
    title: "Relevant",
    addons: "Relevant",
    menuId: "Not Relevant",
    calories: "Not Relevant",
    miscInfo: "Not Relevant",
    parentId: "Not Relevant",
    allergens: "Relevant",
    modifiedAt: "Not Relevant",
    nutritions: "Not Relevant",
    description: "Relevant",
  },
};

export const CHALLENGE_RULES = {
  dish: {
    id: "Not Relevant",
    name: "Easy",
    diets: "Easy",
    price: "Not Relevant",
    addons: "Hard",
    menuId: "Not Relevant",
    calories: "Not Relevant",
    miscInfo: "Not Relevant",
    allergens: "Easy",
    modifiedAt: "Not Relevant",
    nutritions: "Not Relevant",
    description: "Easy",
    ingredients: "Easy",
    menuTitleId: "Not Relevant",
  },
  menuTitle: {
    id: "Not Relevant",
    diets: "Easy",
    title: "Easy",
    addons: "Hard",
    menuId: "Not Relevant",
    calories: "Not Relevant",
    miscInfo: "Not Relevant",
    parentId: "Not Relevant",
    allergens: "Easy",
    modifiedAt: "Not Relevant",
    nutritions: "Not Relevant",
    description: "Easy",
  },
};

const CHANGE_TYPE_KEYS = ["Relevant", "Not Relevant"];
const CHALLENGE_KEYS = ["Easy", "Hard", "Not Relevant"];

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function collectChanges(beforeValue, afterValue, path = "", output = []) {
  if (Object.is(beforeValue, afterValue)) {
    return output;
  }

  if (Array.isArray(beforeValue) && Array.isArray(afterValue)) {
    const maxLength = Math.max(beforeValue.length, afterValue.length);
    for (let index = 0; index < maxLength; index += 1) {
      const childPath = `${path}[${index}]`;
      collectChanges(beforeValue[index], afterValue[index], childPath, output);
    }
    return output;
  }

  if (isPlainObject(beforeValue) && isPlainObject(afterValue)) {
    const keys = new Set([...Object.keys(beforeValue), ...Object.keys(afterValue)]);
    keys.forEach((key) => {
      const childPath = path ? `${path}.${key}` : key;
      collectChanges(beforeValue[key], afterValue[key], childPath, output);
    });
    return output;
  }

  output.push({
    path: path || "(root)",
    beforeValue: beforeValue === undefined ? null : beforeValue,
    afterValue: afterValue === undefined ? null : afterValue,
  });

  return output;
}

function getChangedFields(beforeItem, afterItem) {
  if (!beforeItem && afterItem) {
    const output = collectChanges({}, afterItem);
    return output.length
      ? output
      : [{
          path: "(new)",
          beforeValue: null,
          afterValue: afterItem,
        }];
  }

  if (beforeItem && !afterItem) {
    const output = collectChanges(beforeItem, {});
    return output.length
      ? output
      : [{
          path: "(deleted)",
          beforeValue: beforeItem,
          afterValue: null,
        }];
  }

  if (!beforeItem || !afterItem) {
    return [];
  }

  return collectChanges(beforeItem, afterItem);
}

function getRootSchema(path) {
  if (!path || path.startsWith("(")) {
    return "";
  }

  const withoutArrayStart = path.startsWith("[") ? "" : path;
  const dotIndex = withoutArrayStart.indexOf(".");
  const bracketIndex = withoutArrayStart.indexOf("[");
  const stopIndex = [dotIndex, bracketIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0];

  return stopIndex === undefined ? withoutArrayStart : withoutArrayStart.slice(0, stopIndex);
}

function getFieldChangeType(itemType, path) {
  const rules = CHANGE_TYPE_RULES[itemType] ?? {};
  const rootSchema = getRootSchema(path);

  return rules[rootSchema] ?? "Not Relevant";
}

function getFieldChallenge(itemType, path) {
  const rules = CHALLENGE_RULES[itemType] ?? {};
  const rootSchema = getRootSchema(path);

  return rules[rootSchema] ?? "Not Relevant";
}

function collapseChangedFieldsByRoot(beforeItem, afterItem, changedFields) {
  const collapsed = [];
  const seenRoots = new Set();

  changedFields.forEach((field) => {
    const root = getRootSchema(field.path);

    if (!root) {
      collapsed.push(field);
      return;
    }

    if (seenRoots.has(root)) {
      return;
    }

    seenRoots.add(root);
    collapsed.push({
      path: root,
      beforeValue: beforeItem?.[root] === undefined ? null : beforeItem[root],
      afterValue: afterItem?.[root] === undefined ? null : afterItem[root],
    });
  });

  return collapsed;
}

function enrichChangedFields(itemType, changedFields) {
  return changedFields.map((field) => ({
    ...field,
    changeType: getFieldChangeType(itemType, field.path),
    challenge: getFieldChallenge(itemType, field.path),
  }));
}

function countChangeTypes(changedFields) {
  const counts = {
    Relevant: 0,
    "Not Relevant": 0,
  };

  changedFields.forEach((field) => {
    const key = CHANGE_TYPE_KEYS.includes(field.changeType) ? field.changeType : "Not Relevant";
    counts[key] += 1;
  });

  return counts;
}

function countChallenges(changedFields) {
  const counts = {
    Easy: 0,
    Hard: 0,
    "Not Relevant": 0,
  };

  changedFields.forEach((field) => {
    const key = CHALLENGE_KEYS.includes(field.challenge) ? field.challenge : "Not Relevant";
    counts[key] += 1;
  });

  return counts;
}

function getItemChallenge(changedFields, requiresCuration) {
  if (!requiresCuration) {
    return null;
  }

  const counts = countChallenges(changedFields);
  if (counts.Hard > 0) {
    return "Hard";
  }
  if (counts.Easy > 0) {
    return "Easy";
  }
  return "Easy";
}

function byId(list) {
  const map = new Map();
  list.forEach((item) => {
    if (item?.id !== undefined && item?.id !== null) {
      map.set(String(item.id), item);
    }
  });
  return map;
}

function compareModifiedAt(beforeItem, afterItem) {
  const beforeModifiedAt = beforeItem?.modifiedAt ?? "";
  const afterModifiedAt = afterItem?.modifiedAt ?? "";

  if (!beforeItem && afterItem) {
    return "new";
  }

  if (beforeItem && !afterItem) {
    return "deleted";
  }

  if (beforeModifiedAt === afterModifiedAt) {
    return "unchanged";
  }

  if (Date.parse(afterModifiedAt) > Date.parse(beforeModifiedAt)) {
    return "updated";
  }

  return "unchanged";
}

function baseResult(beforeItem, afterItem) {
  return {
    id: String(beforeItem?.id ?? afterItem?.id ?? ""),
    beforeModifiedAt: beforeItem?.modifiedAt ?? null,
    afterModifiedAt: afterItem?.modifiedAt ?? null,
    before: beforeItem ?? null,
    after: afterItem ?? null,
  };
}

function mergeReason(existing, reason) {
  if (!existing) {
    return reason;
  }
  if (existing.includes(reason)) {
    return existing;
  }
  return `${existing}, ${reason}`;
}

function ensureDishStatus(target, status, reason) {
  if (!target) {
    return;
  }

  const priority = {
    deleted: 4,
    new: 3,
    updated: 2,
    unchanged: 0,
  };

  if (priority[status] > priority[target.status]) {
    target.status = status;
  }

  target.reason = mergeReason(target.reason, reason);
}

export function compareMessages(beforeRecord, afterRecord) {
  const beforeMessage = beforeRecord?.message ?? {};
  const afterMessage = afterRecord?.message ?? {};

  const beforeMenu = beforeMessage.menu ?? {};
  const afterMenu = afterMessage.menu ?? {};

  const beforeMenuModifiedAt = beforeMenu.modifiedAt ?? "";
  const afterMenuModifiedAt = afterMenu.modifiedAt ?? "";

  const menuStatus = Date.parse(afterMenuModifiedAt) > Date.parse(beforeMenuModifiedAt)
    ? "updated"
    : "unchanged";

  const shouldProcess = menuStatus === "updated";

  const titleIds = new Set([
    ...byId(asArray(beforeMessage.menuTitles)).keys(),
    ...byId(asArray(afterMessage.menuTitles)).keys(),
  ]);

  const beforeTitlesById = byId(asArray(beforeMessage.menuTitles));
  const afterTitlesById = byId(asArray(afterMessage.menuTitles));
  const menuTitleChanges = [];
  const titleStatusById = new Map();

  titleIds.forEach((id) => {
    const beforeTitle = beforeTitlesById.get(id);
    const afterTitle = afterTitlesById.get(id);
    const status = compareModifiedAt(beforeTitle, afterTitle);
    const rawChangedFields = getChangedFields(beforeTitle, afterTitle);
    const changedFields = enrichChangedFields(
      "menuTitle",
      collapseChangedFieldsByRoot(beforeTitle, afterTitle, rawChangedFields),
    );

    const item = {
      ...baseResult(beforeTitle, afterTitle),
      type: "menuTitle",
      status,
      title: afterTitle?.title ?? beforeTitle?.title ?? "-",
      changedFields,
      changeTypeCounts: countChangeTypes(changedFields),
      reason:
        status === "new"
          ? "new menu title"
          : status === "deleted"
            ? "menu title deleted"
            : status === "updated"
              ? "menu title modifiedAt is newer"
              : "menu title unchanged",
      requiresCuration: status === "new" || status === "updated",
    };
    item.challenge = getItemChallenge(item.changedFields, item.requiresCuration);

    menuTitleChanges.push(item);
    titleStatusById.set(id, status);
  });

  const beforeDishesById = byId(asArray(beforeMessage.dishes));
  const afterDishesById = byId(asArray(afterMessage.dishes));
  const dishIds = new Set([...beforeDishesById.keys(), ...afterDishesById.keys()]);

  const dishChanges = [];

  dishIds.forEach((id) => {
    const beforeDish = beforeDishesById.get(id);
    const afterDish = afterDishesById.get(id);
    const status = compareModifiedAt(beforeDish, afterDish);
    const rawChangedFields = getChangedFields(beforeDish, afterDish);
    const changedFields = enrichChangedFields(
      "dish",
      collapseChangedFieldsByRoot(beforeDish, afterDish, rawChangedFields),
    );

    const result = {
      ...baseResult(beforeDish, afterDish),
      type: "dish",
      status,
      name: afterDish?.name ?? beforeDish?.name ?? "-",
      menuTitleId: String(afterDish?.menuTitleId ?? beforeDish?.menuTitleId ?? ""),
      changedFields,
      changeTypeCounts: countChangeTypes(changedFields),
      reason:
        status === "new"
          ? "new dish"
          : status === "deleted"
            ? "dish removed from new message"
            : status === "updated"
              ? "dish modifiedAt is newer"
              : "dish unchanged",
      requiresCuration: status === "new" || status === "updated",
    };
    result.challenge = getItemChallenge(result.changedFields, result.requiresCuration);

    dishChanges.push(result);
  });

  const hardMenuTitleIds = new Set(
    menuTitleChanges
      .filter((item) => item.requiresCuration && item.challenge === "Hard")
      .map((item) => item.id),
  );

  dishChanges.forEach((dish) => {
    const titleStatus = titleStatusById.get(dish.menuTitleId);

    if (titleStatus === "deleted") {
      ensureDishStatus(dish, "deleted", "parent menu title deleted");
      dish.requiresCuration = false;
      return;
    }

    if (titleStatus === "updated") {
      if (dish.status !== "deleted" && dish.status !== "new") {
        ensureDishStatus(dish, "updated", "parent menu title updated");
      }
      dish.requiresCuration = dish.status === "new" || dish.status === "updated";
    }

    if (dish.requiresCuration && hardMenuTitleIds.has(dish.menuTitleId)) {
      dish.challenge = "Hard";
      dish.reason = mergeReason(dish.reason, "parent menu title challenge is hard");
    } else {
      dish.challenge = getItemChallenge(dish.changedFields, dish.requiresCuration);
    }
  });

  if (!shouldProcess) {
    menuTitleChanges.forEach((item) => {
      item.requiresCuration = false;
      item.challenge = null;
      item.reason = mergeReason(item.reason, "ignored: menu.modifiedAt is not newer");
    });

    dishChanges.forEach((item) => {
      item.requiresCuration = false;
      item.challenge = null;
      item.reason = mergeReason(item.reason, "ignored: menu.modifiedAt is not newer");
    });
  }

  const summary = {
    dishes: {
      new: dishChanges.filter((item) => item.status === "new").length,
      updated: dishChanges.filter((item) => item.status === "updated").length,
      deleted: dishChanges.filter((item) => item.status === "deleted").length,
      unchanged: dishChanges.filter((item) => item.status === "unchanged").length,
      requiresCuration: dishChanges.filter((item) => item.requiresCuration).length,
    },
    menuTitles: {
      new: menuTitleChanges.filter((item) => item.status === "new").length,
      updated: menuTitleChanges.filter((item) => item.status === "updated").length,
      deleted: menuTitleChanges.filter((item) => item.status === "deleted").length,
      unchanged: menuTitleChanges.filter((item) => item.status === "unchanged").length,
      requiresCuration: menuTitleChanges.filter((item) => item.requiresCuration).length,
    },
  };

  return {
    beforeRecordMeta: {
      id: beforeRecord?.id ?? null,
      updatedAt: beforeRecord?.updatedAt ?? null,
      menuModifiedAt: beforeMenuModifiedAt || null,
    },
    afterRecordMeta: {
      id: afterRecord?.id ?? null,
      updatedAt: afterRecord?.updatedAt ?? null,
      menuModifiedAt: afterMenuModifiedAt || null,
    },
    menu: {
      id: String(afterMenu.id ?? beforeMenu.id ?? ""),
      beforeModifiedAt: beforeMenuModifiedAt || null,
      afterModifiedAt: afterMenuModifiedAt || null,
      status: menuStatus,
      shouldProcess,
      reason:
        menuStatus === "updated"
          ? "process: menu.modifiedAt is newer"
          : beforeMenuModifiedAt === afterMenuModifiedAt
            ? "ignored: menu.modifiedAt is unchanged"
            : "ignored: menu.modifiedAt is older than before",
    },
    changes: {
      menuTitles: menuTitleChanges.sort((a, b) => Number(a.id) - Number(b.id)),
      dishes: dishChanges.sort((a, b) => Number(a.id) - Number(b.id)),
    },
    summary,
  };
}
