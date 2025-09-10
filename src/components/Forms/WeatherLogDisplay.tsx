import React from 'react';
import type { WeatherLog } from '../../types';

export interface WeatherLogDisplayProps {
  weatherLogs: WeatherLog[];
  onEdit?: (weatherLog: WeatherLog) => void;
  onDelete?: (weatherLogId: number) => void;
  isLoading?: boolean;
}

/**
 * WeatherLogDisplay component for showing weather logs in trip details
 * Features:
 * - Display weather conditions with icons
 * - Edit and delete functionality
 * - Responsive layout for multiple weather logs
 */
export const WeatherLogDisplay: React.FC<WeatherLogDisplayProps> = ({
  weatherLogs,
  onEdit,
  onDelete,
  isLoading = false
}) => {
  // Get weather icon based on sky condition
  const getWeatherIcon = (sky: string): string => {
    const iconMap: Record<string, string> = {
      'Clear': 'fas fa-sun',
      'Partly Cloudy': 'fas fa-cloud-sun',
      'Cloudy': 'fas fa-cloud',
      'Overcast': 'fas fa-cloud',
      'Light Rain': 'fas fa-cloud-rain',
      'Heavy Rain': 'fas fa-cloud-showers-heavy',
      'Stormy': 'fas fa-bolt'
    };
    return iconMap[sky] || 'fas fa-cloud';
  };

  // Get wind icon based on wind condition
  const getWindIcon = (windCondition: string): string => {
    const iconMap: Record<string, string> = {
      'Calm': 'fas fa-leaf',
      'Light Breeze': 'fas fa-wind',
      'Moderate Breeze': 'fas fa-wind',
      'Strong Breeze': 'fas fa-wind',
      'Gale': 'fas fa-wind',
      'Storm': 'fas fa-wind'
    };
    return iconMap[windCondition] || 'fas fa-wind';
  };

  // Format temperature display
  const formatTemperature = (temp: string): string => {
    return temp ? `${temp}°C` : 'Not recorded';
  };

  // Handle delete with confirmation
  const handleDelete = (weatherLogId: number) => {
    if (onDelete && confirm('Are you sure you want to delete this weather log?')) {
      onDelete(weatherLogId);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading weather logs...</span>
      </div>
    );
  }

  if (weatherLogs.length === 0) {
    return (
      <div className="text-center py-6">
        <i className="fas fa-cloud-sun text-3xl text-gray-400 dark:text-gray-600 mb-3"></i>
        <p className="text-gray-500 dark:text-gray-400">No weather conditions logged</p>
      </div>
    );
  }

  return (
    <div className="weather-log-display space-y-4">
      {weatherLogs.map((weatherLog) => (
        <WeatherLogCard
          key={weatherLog.id}
          weatherLog={weatherLog}
          onEdit={onEdit}
          onDelete={onDelete ? () => handleDelete(weatherLog.id) : undefined}
          getWeatherIcon={getWeatherIcon}
          getWindIcon={getWindIcon}
          formatTemperature={formatTemperature}
        />
      ))}
    </div>
  );
};

// Individual weather log card component
interface WeatherLogCardProps {
  weatherLog: WeatherLog;
  onEdit?: (weatherLog: WeatherLog) => void;
  onDelete?: () => void;
  getWeatherIcon: (sky: string) => string;
  getWindIcon: (windCondition: string) => string;
  formatTemperature: (temp: string) => string;
}

const WeatherLogCard: React.FC<WeatherLogCardProps> = ({
  weatherLog,
  onEdit,
  onDelete,
  getWeatherIcon,
  getWindIcon,
  formatTemperature
}) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center">
          <i className={`${getWeatherIcon(weatherLog.sky)} text-blue-500 text-xl mr-3`}></i>
          <div>
            <h4 className="font-medium text-gray-800 dark:text-gray-200">
              {weatherLog.timeOfDay}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {weatherLog.sky}
            </p>
          </div>
        </div>
        
        {(onEdit || onDelete) && (
          <div className="flex space-x-2">
            {onEdit && (
              <button
                onClick={() => onEdit(weatherLog)}
                className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                title="Edit weather log"
              >
                <i className="fas fa-edit"></i>
              </button>
            )}
            {onDelete && (
              <button
                onClick={onDelete}
                className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                title="Delete weather log"
              >
                <i className="fas fa-trash"></i>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="flex items-center">
          <i className={`${getWindIcon(weatherLog.windCondition)} text-gray-500 mr-2`}></i>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block">Wind:</span>
            <span className="text-gray-700 dark:text-gray-300">
              {weatherLog.windCondition}
            </span>
          </div>
        </div>
        
        <div className="flex items-center">
          <i className="fas fa-compass text-gray-500 mr-2"></i>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block">Direction:</span>
            <span className="text-gray-700 dark:text-gray-300">
              {weatherLog.windDirection}
            </span>
          </div>
        </div>
        
        <div className="flex items-center">
          <i className="fas fa-thermometer-half text-gray-500 mr-2"></i>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block">Air:</span>
            <span className="text-gray-700 dark:text-gray-300">
              {formatTemperature(weatherLog.airTemp)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center">
          <i className="fas fa-water text-gray-500 mr-2"></i>
          <div>
            <span className="text-gray-500 dark:text-gray-400 block">Water:</span>
            <span className="text-gray-700 dark:text-gray-300">
              {formatTemperature(weatherLog.waterTemp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeatherLogDisplay;