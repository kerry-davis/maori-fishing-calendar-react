import { useCallback, useEffect, useState } from "react";
import { useLocationContext } from "../contexts/LocationContext";
import {
  getTideErrorMessage,
  type TideError,
  type TideForecast,
  TideProviderFactory,
} from "../services/tideProviderFactory";

interface UseTideDataResult {
  tide: TideForecast | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  providerUsed?: string;
}

export function useTideData(date: Date | null): UseTideDataResult {
  const { userLocation } = useLocationContext();
  const [tide, setTide] = useState<TideForecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | undefined>(undefined);

  const loadTide = useCallback(async () => {
    if (!date) {
      setTide(null);
      setError(null);
      return;
    }

    if (!userLocation) {
      setTide(null);
      setError("Location not available");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await TideProviderFactory.fetchTideWithFallback(
        userLocation.lat,
        userLocation.lon,
        date
      );
      setTide(result.forecast);
      setProviderUsed(result.provider.name);
      console.log(`✅ UI displaying tide data from: ${result.provider.name}`);
      console.log(`📊 Tides: ${result.forecast.extrema.map(e => `${e.type} ${e.time.split('T')[1].substring(0,5)} ${e.height}m`).join(', ')}`);
    } catch (err) {
      setTide(null);
      setProviderUsed(undefined);
      setError(getTideErrorMessage(err as TideError));
    } finally {
      setLoading(false);
    }
  }, [userLocation, date]);

  useEffect(() => {
    loadTide();
  }, [loadTide]);

  return {
    tide,
    loading,
    error,
    refetch: loadTide,
    providerUsed,
  };
}

export default useTideData;
