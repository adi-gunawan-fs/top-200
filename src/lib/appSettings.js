import { supabase } from "./supabase";

const TABLE = "app_settings";

export async function fetchWeights(userId) {
  const { data, error } = await supabase
    .from(TABLE)
    .select("weights")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.weights ?? null;
}

export async function saveWeights(userId, weights) {
  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, weights }, { onConflict: "user_id" });

  if (error) throw error;
}
