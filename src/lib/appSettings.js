import { supabase } from "./supabase";

const TABLE = "app_settings";

export async function fetchSettings(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("weights, difficulty_threshold")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return {
    weights: data?.weights ?? null,
    difficultyThreshold: data?.difficulty_threshold ?? null,
  };
}

export async function saveSettings(userId, weights, difficultyThreshold) {
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId, weights, difficulty_threshold: difficultyThreshold },
      { onConflict: "user_id" }
    );

  if (error) throw error;
}

// Legacy — kept so any direct imports still compile during migration
export async function fetchWeights(userId) {
  const { weights } = await fetchSettings(userId);
  return weights;
}

export async function saveWeights(userId, weights) {
  const { data } = await supabase
    .from(TABLE)
    .select("difficulty_threshold")
    .eq("user_id", userId)
    .maybeSingle();
  await saveSettings(userId, weights, data?.difficulty_threshold ?? null);
}
