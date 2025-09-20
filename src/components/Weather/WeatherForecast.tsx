/**
 * WeatherForecast Component
 * Handles weather data fetching and displays weather information
 */

import React, { useState, useEffect, useCallback } from 'react';
import { WeatherDisplay } from './WeatherDisplay';
import { 
  fetchWeatherForLocation, 
  getWeatherErrorMessage,
  isWeatherAvailable,
  type WeatherData,
  type WeatherError 
} from '../../services/weatherService';
import { useLocationContext } from '../../contexts/LocationContext';

interface WeatherForecastProps {
  date: Date;
  className?: string;
  onWeatherLoad?: (weather: WeatherData | null) => void;
}

export const WeatherForecast: React.FC<WeatherForecastProps> = ({
  date,
  className = '',
  onWeatherLoad
}) => {
  const { userLocation } = useLocationContext();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = useCallback(async () => {
    // Reset state
    setError(null);
    setWeather(null);

    // Check if location is available
    if (!userLocation) {
      setError('Location not available');
      return;
    }

    // Check if weather is available for this date
    if (!isWeatherAvailable(date)) {
      setError('Weather forecast not available for this date');
      return;
    }

    setLoading(true);

    try {
      const weatherData = await fetchWeatherForLocation(userLocation, date);
      setWeather(weatherData);
      onWeatherLoad?.(weatherData);
    } catch (err) {
      const weatherError = err as WeatherError;
      const errorMessage = getWeatherErrorMessage(weatherError);
      setError(errorMessage);
      onWeatherLoad?.(null);
    } finally {
      setLoading(false);
    }
  }, [userLocation, date, onWeatherLoad]);

  // Fetch weather when location or date changes
  useEffect(() => {
    fetchWeather();
  }, [fetchWeather]);

  // Retry function for error states
  const handleRetry = useCallback(() => {
    fetchWeather();
  }, [fetchWeather]);

  return (
    <div className={className}>
      <WeatherDisplay 
        weather={weather}
        loading={loading}
        error={error}
      />
      
      {/* Retry button for errors */}
      {error && !loading && (
        <button
          onClick={handleRetry}
          className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
};

export default WeatherForecast;