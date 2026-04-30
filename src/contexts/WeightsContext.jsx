import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { PARAMETER_WEIGHTS } from "../utils/analysisReview";
import { fetchWeights, saveWeights } from "../lib/appSettings";

const WeightsContext = createContext(null);

export function WeightsProvider({ userId, children }) {
  const [weights, setWeights] = useState({ ...PARAMETER_WEIGHTS });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetchWeights(userId)
      .then((stored) => {
        if (stored && Object.keys(stored).length > 0) {
          setWeights({ ...PARAMETER_WEIGHTS, ...stored });
        }
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [userId]);

  const updateWeights = useCallback((newWeights) => {
    setWeights(newWeights);
    if (userId) {
      saveWeights(userId, newWeights).catch(() => {});
    }
  }, [userId]);

  const resetWeights = useCallback(() => {
    const defaults = { ...PARAMETER_WEIGHTS };
    setWeights(defaults);
    if (userId) {
      saveWeights(userId, defaults).catch(() => {});
    }
  }, [userId]);

  return (
    <WeightsContext.Provider value={{ weights, updateWeights, resetWeights, loaded }}>
      {children}
    </WeightsContext.Provider>
  );
}

export function useWeights() {
  const ctx = useContext(WeightsContext);
  if (!ctx) throw new Error("useWeights must be used inside WeightsProvider");
  return ctx;
}
