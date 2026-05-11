import { supabase } from "./supabase";

const TABLE = "experiment_rows";
const INSERT_CHUNK_SIZE = 500;

export async function saveExperimentRows(userId, rows) {
  const payload = (rows ?? []).map((row) => ({
    user_id: userId,
    brand_name: row.brand_name ?? "",
    dish_id: row.dish_id ?? "",
    dish_name: row.dish_name ?? "",
    before_name: row.before_name ?? "",
    after_name: row.after_name ?? "",
    name_status: row.name_status ?? "",
    before_description: row.before_description ?? "",
    after_description: row.after_description ?? "",
    description_status: row.description_status ?? "",
    before_ingredient: row.before_ingredient ?? "",
    after_ingredient: row.after_ingredient ?? "",
    ingredient_status: row.ingredient_status ?? "",
    before_addons: row.before_addons ?? "",
    after_addons: row.after_addons ?? "",
    addons_status: row.addons_status ?? "",
    before_allergens: row.before_allergens ?? "",
    after_allergens: row.after_allergens ?? "",
    allergens_status: row.allergens_status ?? "",
    before_diets: row.before_diets ?? "",
    after_diets: row.after_diets ?? "",
    diets_status: row.diets_status ?? "",
    name_label: row.name_label ?? "",
    description_label: row.description_label ?? "",
    ingredient_label: row.ingredient_label ?? "",
    addons_label: row.addons_label ?? "",
    allergens_label: row.allergens_label ?? "",
    diets_label: row.diets_label ?? "",
  }));

  if (payload.length === 0) return { inserted: 0 };

  for (let i = 0; i < payload.length; i += INSERT_CHUNK_SIZE) {
    const chunk = payload.slice(i, i + INSERT_CHUNK_SIZE);
    const { error } = await supabase.from(TABLE).insert(chunk);
    if (error) throw error;
  }

  return { inserted: payload.length };
}

export async function fetchExperimentRows(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, created_at, brand_name, dish_id, dish_name, before_name, after_name, name_status, before_description, after_description, description_status, before_ingredient, after_ingredient, ingredient_status, before_addons, after_addons, addons_status, before_allergens, after_allergens, allergens_status, before_diets, after_diets, diets_status, name_label, description_label, ingredient_label, addons_label, allergens_label, diets_label")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) throw error;
  return data ?? [];
}

export async function updateExperimentRowLabel(userId, rowId, label) {
  const { error } = await supabase
    .from(TABLE)
    .update({ label: label ?? "" })
    .eq("user_id", userId)
    .eq("id", rowId);

  if (error) throw error;
}

export async function updateExperimentCellLabel(userId, rowId, labelColumn, labelValue) {
  const allowed = new Set([
    "name_label",
    "description_label",
    "ingredient_label",
    "addons_label",
    "allergens_label",
    "diets_label",
  ]);
  if (!allowed.has(labelColumn)) throw new Error("Invalid label column");

  const { error } = await supabase
    .from(TABLE)
    .update({ [labelColumn]: labelValue ?? "" })
    .eq("user_id", userId)
    .eq("id", rowId);

  if (error) throw error;
}

export async function deleteExperimentRow(userId, rowId) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("id", rowId);

  if (error) throw error;
}

export async function deleteAllExperimentRows(userId) {
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId);

  if (error) throw error;
}
