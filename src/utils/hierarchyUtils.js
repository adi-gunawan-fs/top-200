function getMenuTitleParentId(item) {
  const value = item?.after?.parentId ?? item?.before?.parentId;
  if (value === undefined || value === null || value === "") {
    return "";
  }
  return String(value);
}

function sortById(a, b) {
  return Number(a.id) - Number(b.id);
}

export function buildHierarchy(menuTitleRows, dishRows) {
  const nodesById = new Map();

  menuTitleRows.forEach((item) => {
    nodesById.set(String(item.id), {
      id: String(item.id),
      item,
      children: [],
      dishes: [],
    });
  });

  const roots = [];

  nodesById.forEach((node) => {
    const parentId = getMenuTitleParentId(node.item);
    const parent = nodesById.get(parentId);

    if (parent) {
      parent.children.push(node);
      return;
    }

    roots.push(node);
  });

  const orphanDishes = [];

  dishRows.forEach((dish) => {
    const menuTitleId = String(dish.menuTitleId ?? "");
    const node = nodesById.get(menuTitleId);
    if (!node) {
      orphanDishes.push(dish);
      return;
    }
    node.dishes.push(dish);
  });

  const sortNode = (node) => {
    node.children.sort((a, b) => sortById(a.item, b.item));
    node.dishes.sort(sortById);
    node.children.forEach(sortNode);
  };

  roots.sort((a, b) => sortById(a.item, b.item));
  roots.forEach(sortNode);
  orphanDishes.sort(sortById);

  return { roots, orphanDishes };
}

export function collectTitleIds(nodes, output = []) {
  nodes.forEach((node) => {
    output.push(node.id);
    collectTitleIds(node.children, output);
  });
  return output;
}
