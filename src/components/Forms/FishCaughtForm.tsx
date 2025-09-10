import React, { useState, useEffect } from 'react';
import type { FishCaught, FormValidation } from '../../types';

export interface FishCaughtFormProps {
  tripId: number;
  fishCaught?: FishCaught;
  onSave: (fishData: Omit<FishCaught, 'id'>) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 * FishCaughtForm component for creating and editing fish catch records
 * Features:
 * - Fish catch logging form with species, size, weight inputs
 * - Time selection and gear selection from tackle box (placeholder)
 * - Photo upload and display functionality (placeholder)
 * - Form validation and error handling
 */
export const FishCaughtForm: React.FC<FishCaughtFormProps> = ({
  tripId,
  fishCaught,
  onSave,
  onCancel,
  isLoading = false
}) => {
  const [formData, setFormData] = useState<Omit<FishCaught, 'id'>>({
    tripId,
    species: '',
    length: '',
    weight: '',
    time: '',
    gear: [],
    details: '',
    photo: undefined
  });

  const [validation, setValidation] = useState<FormValidation>({
    isValid: true,
    errors: {}
  });

  const [isSaving, setIsSaving] = useState(false);

  const isEditing = fishCaught !== undefined;

  // Initialize form data
  useEffect(() => {
    if (isEditing && fishCaught) {
      setFormData({
        tripId: fishCaught.tripId,
        species: fishCaught.species,
        length: fishCaught.length,
        weight: fishCaught.weight,
        time: fishCaught.time,
        gear: fishCaught.gear,
        details: fishCaught.details,
        photo: fishCaught.photo
      });
    }
  }, [isEditing, fishCaught]);

  // Handle form field changes
  const handleInputChange = (field: keyof Omit<FishCaught, 'id'>, value: string | string[]) => {
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

  // Handle gear selection (placeholder - will be integrated with tackle box later)
  const handleGearChange = (gear: string) => {
    const currentGear = formData.gear;
    const isSelected = currentGear.includes(gear);
    
    if (isSelected) {
      handleInputChange('gear', currentGear.filter(g => g !== gear));
    } else {
      handleInputChange('gear', [...currentGear, gear]);
    }
  };

  // Validate form data
  const validateForm = (): FormValidation => {
    const errors: Record<string, string> = {};

    if (!formData.species.trim()) {
      errors.species = 'Species is required';
    }

    // Length validation (optional but if provided, should be valid)
    if (formData.length && (isNaN(Number(formData.length)) || Number(formData.length) <= 0)) {
      errors.length = 'Length must be a positive number';
    }

    // Weight validation (optional but if provided, should be valid)
    if (formData.weight && (isNaN(Number(formData.weight)) || Number(formData.weight) <= 0)) {
      errors.weight = 'Weight must be a positive number';
    }

    // Time validation is handled by the HTML5 time input type, so no custom validation needed

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
      console.error('Error saving fish catch:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Common fish species for quick selection
  const commonSpecies = [
    'Trout', 'Salmon', 'Snapper', 'Kahawai', 'Kingfish', 'Trevally', 
    'Gurnard', 'Flounder', 'John Dory', 'Tarakihi', 'Blue Cod', 'Hapuka'
  ];

  // Placeholder gear options (will be replaced with tackle box integration)
  const placeholderGear = [
    'Spinning Rod', 'Fly Rod', 'Bait Rod', 'Soft Bait', 'Hard Lure', 
    'Fly', 'Live Bait', 'Berley', 'Sinker', 'Hook'
  ];

  return (
    <div className="fish-caught-form">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Species */}
        <div>
          <label htmlFor="species" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Species *
          </label>
          <div className="space-y-2">
            <input
              type="text"
              id="species"
              value={formData.species}
              onChange={(e) => handleInputChange('species', e.target.value)}
              placeholder="Enter fish species"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validation.errors.species ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {validation.errors.species && (
              <p className="text-sm text-red-600 dark:text-red-400">{validation.errors.species}</p>
            )}
            
            {/* Quick species selection */}
            <div className="flex flex-wrap gap-2">
              {commonSpecies.map(species => (
                <button
                  key={species}
                  type="button"
                  onClick={() => handleInputChange('species', species)}
                  className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded transition-colors"
                >
                  {species}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Length */}
          <div>
            <label htmlFor="length" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Length (cm)
            </label>
            <input
              type="number"
              id="length"
              value={formData.length}
              onChange={(e) => handleInputChange('length', e.target.value)}
              placeholder="e.g., 35"
              min="0"
              step="0.1"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validation.errors.length ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validation.errors.length && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validation.errors.length}</p>
            )}
          </div>

          {/* Weight */}
          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Weight (kg)
            </label>
            <input
              type="number"
              id="weight"
              value={formData.weight}
              onChange={(e) => handleInputChange('weight', e.target.value)}
              placeholder="e.g., 1.5"
              min="0"
              step="0.01"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validation.errors.weight ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validation.errors.weight && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validation.errors.weight}</p>
            )}
          </div>

          {/* Time */}
          <div>
            <label htmlFor="time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Time Caught
            </label>
            <input
              type="time"
              id="time"
              value={formData.time}
              onChange={(e) => handleInputChange('time', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                validation.errors.time ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {validation.errors.time && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validation.errors.time}</p>
            )}
          </div>
        </div>

        {/* Gear Selection - Placeholder */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Gear Used
          </label>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Select the gear used to catch this fish:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {placeholderGear.map(gear => (
                <label key={gear} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.gear.includes(gear)}
                    onChange={() => handleGearChange(gear)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{gear}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Note: Gear selection will be integrated with tackle box in a future update
            </p>
          </div>
        </div>

        {/* Details */}
        <div>
          <label htmlFor="details" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Additional Details
          </label>
          <textarea
            id="details"
            rows={3}
            value={formData.details}
            onChange={(e) => handleInputChange('details', e.target.value)}
            placeholder="Any additional details about the catch..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-vertical"
          />
        </div>

        {/* Photo Upload - Placeholder */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Photo
          </label>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
            <div className="text-center">
              <i className="fas fa-camera text-3xl text-gray-400 dark:text-gray-600 mb-2"></i>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Photo upload functionality will be available in a future update
              </p>
            </div>
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
            {isEditing ? 'Update Catch' : 'Save Catch'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FishCaughtForm;