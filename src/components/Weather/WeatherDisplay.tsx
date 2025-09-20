/**
 * WeatherDisplay Component
 * Displays weather forecast information with existing styling
 */

import React from 'react';
import type { WeatherData } from '../../services/weatherService';
import { formatTemperatureRange, formatWindInfo } from '../../services/weatherService';

interface WeatherDisplayProps {
  weather: WeatherData | null;
  loading?: boolean;
  error?: string | null;
  className?: string;
}

export const WeatherDisplay: React.FC<WeatherDisplayProps> = ({
  weather,
  loading = false,
  error = null,
  className = ''
}) => {
  // Loading state
  if (loading) {
    return (
      <div className={`text-sm ${className}`}>
        <p>Loading weather...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`text-sm ${className}`}>
        <p>Could not load weather forecast.</p>
      </div>
    );
  }

  // No weather data
  if (!weather) {
    return (
      <div className={`text-sm ${className}`}>
        <p>Weather data is not available for this day.</p>
      </div>
    );
  }

  // Display weather data
  return (
    <div className={`text-sm ${className}`}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="font-semibold">Temperature:</p>
          <p>{formatTemperatureRange(weather.temperatureMin, weather.temperatureMax)}</p>
        </div>
        <div>
          <p className="font-semibold">Wind:</p>
          <p>{formatWindInfo(weather.windSpeed, weather.windDirectionCardinal)}</p>
        </div>
      </div>
    </div>
  );
};

export default WeatherDisplay;