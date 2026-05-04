import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "./Modal";
import { fetchDishSnapshots } from "../../lib/dbFetch";

const SNAPSHOT_COLUMNS = [
  { key: "id", label: "ID" },
  { key: "type", label: "Type" },
  { key: "createdAt", label: "Created At" },
  { key: "dishTypeId", label: "Dish Type" },
  { key: "courseTypeId", label: "Course Type" },
  { key: "dietIds", label: "Diet IDs" },
  { key: "allergenIds", label: "Allergen IDs" },
  { key: "mainIngredientIds", label: "Main Ingredient IDs" },
  { key: "choiceIngredientIds", label: "Choice Ingredient IDs" },
  { key: "additionalIngredientIds", label: "Additional Ingredient IDs" },
  { key: "certainty", label: "Certainty" },
  { key: "tier", label: "Tier" },
  { key: "areIngredientsInAgreement", label: "Ingredients Agreement" },
  { key: "miscAndChoiceCertainty", label: "Misc & Choice Certainty" },
  { key: "dishTypeCertainty", label: "Dish Type Certainty" },
  { key: "courseTypeCertainty", label: "Course Type Certainty" },
  { key: "dietsCertainty", label: "Diets Certainty" },
  { key: "allergensCertainty", label: "Allergens Certainty" },
  { key: "ingredientsCertainty", label: "Ingredients Certainty" },
];

function formatCellValue(value) {
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-400">[]</span>;
    return value.join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && value.includes("T") && value.includes("Z")) {
    return new Date(value).toLocaleString();
  }
  return String(value);
}

export function DishSnapshotsModal({ dishId, afterDate, dishName, onClose }) {
  const [snapshots, setSnapshots] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setSnapshots(null);
    setError(null);

    fetchDishSnapshots(dishId, afterDate)
      .then((rows) => { if (!cancelled) setSnapshots(rows); })
      .catch((err) => { if (!cancelled) setError(err.message); });

    return () => { cancelled = true; };
  }, [dishId, afterDate]);

  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Dish Snapshots — ${dishName || dishId}`}
      subtitle={`Dish menu ID ${dishId} · snapshots after ${new Date(afterDate).toLocaleString()}`}
    >
      <div className="p-4">
        {error ? (
          <p className="text-xs text-rose-600">{error}</p>
        ) : snapshots === null ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading snapshots…
          </div>
        ) : snapshots.length === 0 ? (
          <p className="text-xs text-slate-500">No snapshots found for this dish after the selected date.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-xs">
              <thead className="bg-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-600">
                <tr>
                  {SNAPSHOT_COLUMNS.map((col) => (
                    <th key={col.key} className="whitespace-nowrap px-3 py-2 font-medium">{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshots.map((row, i) => (
                  <tr key={row.id ?? i} className="border-b border-slate-100 hover:bg-slate-50">
                    {SNAPSHOT_COLUMNS.map((col) => (
                      <td key={col.key} className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {formatCellValue(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
