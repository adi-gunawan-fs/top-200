import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEFAULT_DIFFICULTY_THRESHOLD, PARAMETER_WEIGHTS } from "../utils/analysisReview";
import { fetchSettings, saveSettings } from "../lib/appSettings";

const WeightsContext = createContext(null);

export function WeightsProvider({ userId, children }) {
  const [weights, setWeights] = useState({ ...PARAMETER_WEIGHTS });
  const [difficultyThreshold, setDifficultyThreshold] = useState(DEFAULT_DIFFICULTY_THRESHOLD);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchSettings(userId)
      .then(({ weights: stored, difficultyThreshold: storedThreshold }) => {
        if (stored && Object.keys(stored).length > 0) {
          setWeights({ ...PARAMETER_WEIGHTS, ...stored });
        }
        if (storedThreshold != null) {
          setDifficultyThreshold(storedThreshold);
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [userId]);

  const updateWeights = useCallback((newWeights) => {
    setWeights(newWeights);
    if (userId) {
      saveSettings(userId, newWeights, difficultyThreshold).catch(() => {});
    }
  }, [userId, difficultyThreshold]);

  const updateDifficultyThreshold = useCallback((newThreshold) => {
    setDifficultyThreshold(newThreshold);
    if (userId) {
      saveSettings(userId, weights, newThreshold).catch(() => {});
    }
  }, [userId, weights]);

  const resetWeights = useCallback(() => {
    const defaults = { ...PARAMETER_WEIGHTS };
    setWeights(defaults);
    setDifficultyThreshold(DEFAULT_DIFFICULTY_THRESHOLD);
    if (userId) {
      saveSettings(userId, defaults, DEFAULT_DIFFICULTY_THRESHOLD).catch(() => {});
    }
  }, [userId]);

  return (
    <WeightsContext.Provider value={{ weights, updateWeights, difficultyThreshold, updateDifficultyThreshold, resetWeights, loaded }}>
      {children}
    </WeightsContext.Provider>
  );
}

export function useWeights() {
  const ctx = useContext(WeightsContext);
  if (!ctx) throw new Error("useWeights must be used inside WeightsProvider");
  return ctx;
}
