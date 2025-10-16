import React, { useState, useEffect } from 'react';
import type { WeatherLog, FormValidation } from '../../types';
import { PROD_ERROR } from '../../utils/loggingHelpers';

export interface WeatherLogFormProps {
  tripId: number;
  weatherLog?: WeatherLog;
  onSave: (weatherData: Omit<WeatherLog, 'id'>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * WeatherLogForm component for creating and editing weather logs
 * Features:
 * - Weather condition selection and temperature input
 * - Form validation and error handling
 * - Support for both create and edit modes
 */
export const WeatherLogForm: React.FC<WeatherLogFormProps> = ({
  tripId,
  weatherLog,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<Omit<WeatherLog, 'id'>>({
    tripId,
    timeOfDay: 'Morning',
    sky: 'Clear',
    windCondition: 'Calm',
    windDirection: 'North',
    waterTemp: '',
    airTemp: ''
  });

  const [validation, setValidation] = useState<FormValidation>({
    isValid: true,
    errors: {}
  });

  const [isSaving, setIsSaving] = useState(false);

  const isEditing = weatherLog !== undefined;

  // Initialize form data
  useEffect(() => {
    if (isEditing && weatherLog) {
      setFormData({
        tripId: weatherLog.tripId,
        timeOfDay: weatherLog.timeOfDay,
        sky: weatherLog.sky,
        windCondition: weatherLog.windCondition,
        windDirection: weatherLog.windDirection,
        waterTemp: weatherLog.waterTemp,
        airTemp: weatherLog.airTemp
      });
    }
  }, [isEditing, weatherLog]);

  // Handle form field changes
  const handleInputChange = (field: keyof Omit<WeatherLog, 'id'>, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear validation error for this field
    if (validation.errors[field]) {
      setValidation(prev => ({
        ...prev,
        errors: {
          ...prev.errors,
          [field]: ''
        }
      }));
    }
  };

  // Validate form data
  const validateForm = (): FormValidation => {
    const errors: Record<string, string> = {};

    // Temperature validation (optional but if provided, should be valid)
    if (formData.airTemp && (isNaN(Number(formData.airTemp)) || Number(formData.airTemp) < -50 || Number(formData.airTemp) > 60)) {
      errors.airTemp = 'Air temperature must be between -50°C and 60°C';
    }

    if (formData.waterTemp && (isNaN(Number(formData.waterTemp)) || Number(formData.waterTemp) < -5 || Number(formData.waterTemp) > 40)) {
      errors.waterTemp = 'Water temperature must be between -5°C and 40°C';
    }

    const isValid = Object.keys(errors).length === 0;
    return { isValid, errors };
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationResult = validateForm();
    setValidation(validationResult);

    if (!validationResult.isValid) {
      return;
    }

    setIsSaving(true);

    try {
      await onSave(formData);
    } catch (error) {
      PROD_ERROR('Error saving weather log:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Time of day options
  const timeOfDayOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];

  // Sky condition options
  const skyOptions = ['Clear', 'Partly Cloudy', 'Cloudy', 'Overcast', 'Light Rain', 'Heavy Rain', 'Stormy'];

  // Wind condition options
  const windOptions = ['Calm', 'Light Breeze', 'Moderate Breeze', 'Strong Breeze', 'Gale', 'Storm'];

  // Wind direction options
  const windDirectionOptions = ['North', 'Northeast', 'East', 'Southeast', 'South', 'Southwest', 'West', 'Northwest'];

  return (
    <div className="weather-log-form">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Time of Day */}
          <div>
            <label htmlFor="timeOfDay" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time of Day
            </label>
            <select
              id="timeOfDay"
              value={formData.timeOfDay}
              onChange={(e) => handleInputChange('timeOfDay', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {timeOfDayOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          {/* Sky Conditions */}
          <div>
            <label htmlFor="sky" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sky Conditions
            </label>
            <select
              id="sky"
              value={formData.sky}
              onChange={(e) => handleInputChange('sky', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {skyOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Wind Condition */}
          <div>
            <label htmlFor="windCondition" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Wind Condition
            </label>
            <select
              id="windCondition"
              value={formData.windCondition}
              onChange={(e) => handleInputChange('windCondition', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {windOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>

          {/* Wind Direction */}
          <div>
            <label htmlFor="windDirection" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Wind Direction
            </label>
            <select
              id="windDirection"
              value={formData.windDirection}
              onChange={(e) => handleInputChange('windDirection', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              {windDirectionOptions.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Air Temperature */}
          <div>
            <label htmlFor="airTemp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Air Temperature (°C)
            </label>
            <input
              type="number"
              id="airTemp"
              value={formData.airTemp}
              onChange={(e) => handleInputChange('airTemp', e.target.value)}
              placeholder="e.g., 18"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validation.errors.airTemp ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validation.errors.airTemp && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validation.errors.airTemp}</p>
            )}
          </div>

          {/* Water Temperature */}
          <div>
            <label htmlFor="waterTemp" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Water Temperature (°C)
            </label>
            <input
              type="number"
              id="waterTemp"
              value={formData.waterTemp}
              onChange={(e) => handleInputChange('waterTemp', e.target.value)}
              placeholder="e.g., 15"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validation.errors.waterTemp ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validation.errors.waterTemp && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validation.errors.waterTemp}</p>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving || isLoading}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center"
          >
            {isSaving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            {isEditing ? 'Update Weather' : 'Save Weather'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default WeatherLogForm;