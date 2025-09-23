import React, { useState, useCallback } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { useDatabaseService } from "../../contexts/DatabaseContext";
import type { WeatherLog } from "../../types";

export interface WeatherLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  weatherId?: string; // For editing existing weather log
  onWeatherLogged?: (weatherLog: WeatherLog) => void;
}

/**
 * WeatherLogModal component for adding weather conditions to a trip
 * Features:
 * - Form fields for time of day, sky conditions, wind conditions
 * - Inputs for wind direction, water temp, air temp
 * - Form validation and database integration
 */
export const WeatherLogModal: React.FC<WeatherLogModalProps> = ({
  isOpen,
  onClose,
  tripId,
  weatherId,
  onWeatherLogged,
}) => {
  const db = useDatabaseService();
  const [formData, setFormData] = useState({
    timeOfDay: "AM",
    sky: "",
    windCondition: "",
    windDirection: "",
    waterTemp: "",
    airTemp: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isEditing = weatherId !== undefined;

  // Load existing weather data when editing
  const loadWeatherData = async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // Convert string ID to number for database lookup
      const numericId = parseInt(id.split('-').pop() || '0', 10);
      const weather = await db.getWeatherLogById(numericId);
      if (weather) {
        setFormData({
          timeOfDay: weather.timeOfDay,
          sky: weather.sky,
          windCondition: weather.windCondition,
          windDirection: weather.windDirection,
          waterTemp: weather.waterTemp,
          airTemp: weather.airTemp,
        });
      } else {
        setError('Weather log not found');
      }
    } catch (err) {
      console.error('Error loading weather log:', err);
      setError('Failed to load weather data');
    } finally {
      setIsLoading(false);
    }
  };

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (isEditing && weatherId) {
        loadWeatherData(weatherId);
      } else {
        // Creating new weather log
        setFormData({
          timeOfDay: "AM",
          sky: "",
          windCondition: "",
          windDirection: "",
          waterTemp: "",
          airTemp: "",
        });
      }
      setError(null);
    }
  }, [isOpen, isEditing, weatherId]);

  const handleInputChange = useCallback((field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear error when user starts typing
    if (error) {
      setError(null);
    }
  }, [error]);

  const validateForm = (): boolean => {
    if (!formData.timeOfDay.trim()) {
      setError("Time of day is required");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const weatherData: Omit<WeatherLog, "id"> = {
        tripId,
        timeOfDay: formData.timeOfDay,
        sky: formData.sky.trim(),
        windCondition: formData.windCondition.trim(),
        windDirection: formData.windDirection.trim(),
        waterTemp: formData.waterTemp.trim(),
        airTemp: formData.airTemp.trim(),
      };

      if (isEditing && weatherId) {
        // Update existing weather log
        await db.updateWeatherLog({
          id: weatherId,
          ...weatherData
        });

        const updatedWeatherLog: WeatherLog = {
          id: weatherId,
          ...weatherData,
        };

        if (onWeatherLogged) {
          onWeatherLogged(updatedWeatherLog);
        }
      } else {
        // Create new weather log
        const newWeatherId = await db.createWeatherLog(weatherData);

        const newWeatherLog: WeatherLog = {
          id: newWeatherId.toString(),
          ...weatherData,
        };

        if (onWeatherLogged) {
          onWeatherLogged(newWeatherLog);
        }
      }

      onClose();
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} weather log:`, err);
      setError(`Failed to ${isEditing ? 'update' : 'save'} weather log. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <ModalHeader
        title={isEditing ? "Edit Weather Log" : "Add Weather Log"}
        subtitle={isEditing ? "Update weather conditions for this trip" : "Record weather conditions for this trip"}
        onClose={onClose}
      />

      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-4">
          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
              <div className="flex items-center">
                <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                <span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading weather data...</span>
            </div>
          )}

          {/* Time of Day */}
          <div>
            <label htmlFor="timeOfDay" className="form-label">
              Time of Day *
            </label>
            <select
              id="timeOfDay"
              value={formData.timeOfDay}
              onChange={(e) => handleInputChange("timeOfDay", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select time of day...</option>
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>

          {/* Sky Condition */}
          <div>
            <label htmlFor="sky" className="form-label">
              Sky Condition
            </label>
            <select
              id="sky"
              value={formData.sky}
              onChange={(e) => handleInputChange("sky", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select sky condition...</option>
              <option value="Sunny">Sunny</option>
              <option value="Partly Cloudy">Partly Cloudy</option>
              <option value="Overcast">Overcast</option>
              <option value="Light Rain">Light Rain</option>
              <option value="Heavy Rain">Heavy Rain</option>
              <option value="Stormy">Stormy</option>
            </select>
          </div>

          {/* Wind Condition */}
          <div>
            <label htmlFor="windCondition" className="form-label">
              Wind Condition
            </label>
            <select
              id="windCondition"
              value={formData.windCondition}
              onChange={(e) => handleInputChange("windCondition", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select wind condition...</option>
              <option value="Calm">Calm</option>
              <option value="Light Winds">Light Winds</option>
              <option value="Moderate Winds">Moderate Winds</option>
              <option value="Strong Winds">Strong Winds</option>
              <option value="Gale Force">Gale Force</option>
            </select>
          </div>

          {/* Wind Direction */}
          <div>
            <label htmlFor="windDirection" className="form-label">
              Wind Direction
            </label>
            <select
              id="windDirection"
              value={formData.windDirection}
              onChange={(e) => handleInputChange("windDirection", e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select wind direction...</option>
              <option value="N">North</option>
              <option value="NE">Northeast</option>
              <option value="E">East</option>
              <option value="SE">Southeast</option>
              <option value="S">South</option>
              <option value="SW">Southwest</option>
              <option value="W">West</option>
              <option value="NW">Northwest</option>
            </select>
          </div>

          {/* Temperatures */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="waterTemp" className="form-label">
                Water Temperature (°C)
              </label>
              <input
                type="number"
                id="waterTemp"
                min="0"
                max="40"
                step="0.1"
                value={formData.waterTemp}
                onChange={(e) => handleInputChange("waterTemp", e.target.value)}
                placeholder="15.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="airTemp" className="form-label">
                Air Temperature (°C)
              </label>
              <input
                type="number"
                id="airTemp"
                min="-10"
                max="50"
                step="0.1"
                value={formData.airTemp}
                onChange={(e) => handleInputChange("airTemp", e.target.value)}
                placeholder="18.0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  {isEditing ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                isEditing ? 'Update Weather' : 'Save Weather'
              )}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default WeatherLogModal;