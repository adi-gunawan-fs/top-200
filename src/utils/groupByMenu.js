function toGroupMeta(row) {
  return {
    menuId: row.message?.menu?.id ?? "-",
    menuUrl: row.message?.menu?.url ?? "-",
    brandId: row.message?.brand?.id ?? "-",
    brandName: row.message?.brand?.name ?? "-",
    brandWebsite: row.message?.brand?.website ?? "",
  };
}

function safeCompare(a, b) {
  if (a.updatedAtMs !== b.updatedAtMs) {
    return a.updatedAtMs - b.updatedAtMs;
  }

  if (a.createdAtMs !== b.createdAtMs) {
    return a.createdAtMs - b.createdAtMs;
  }

  const left = a.id ? Number(a.id) : 0;
  const right = b.id ? Number(b.id) : 0;
  return left - right;
}

export function createMenuGrouper() {
  const groups = new Map();

  const addRow = (row) => {
    const menuId = row?.message?.menu?.id;
    if (menuId === undefined || menuId === null) {
      return;
    }

    const key = String(menuId);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        key,
        count: 1,
        latest: row,
        records: [row],
        ...toGroupMeta(row),
      });
      return;
    }

    existing.count += 1;
    existing.records.push(row);

    if (safeCompare(row, existing.latest) > 0) {
      existing.latest = row;
      const nextMeta = toGroupMeta(row);
      existing.menuUrl = nextMeta.menuUrl;
      existing.brandId = nextMeta.brandId;
      existing.brandName = nextMeta.brandName;
      existing.brandWebsite = nextMeta.brandWebsite;
    }
  };

  const finalize = () => {
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        records: [...group.records].sort(safeCompare),
      }))
      .sort((a, b) => Number(a.menuId) - Number(b.menuId));
  };

  return {
    addRow,
    finalize,
    size: () => groups.size,
  };
}
