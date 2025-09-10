import React, { useState, useEffect, useCallback } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
import { useIndexedDB } from '../../hooks/useIndexedDB';
import type { Trip, TripModalProps, FormValidation } from '../../types';

/**
 * TripDetailsModal component for creating and editing trips
 * Features:
 * - Trip creation/editing form with validation
 * - Form state management and data persistence
 * - Weather and fish catch sub-sections (placeholders for now)
 * - Gear selection integration with tackle box (placeholder for now)
 */
export const TripDetailsModal: React.FC<TripModalProps> = ({
  isOpen,
  onClose,
  tripId,
  selectedDate
}) => {
  const [formData, setFormData] = useState<Omit<Trip, 'id'>>({
    date: '',
    water: '',
    location: '',
    hours: 1,
    companions: '',
    notes: ''
  });
  
  const [validation, setValidation] = useState<FormValidation>({
    isValid: true,
    errors: {}
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const db = useIndexedDB();
  const isEditing = tripId !== undefined;

  // Format date for input field (YYYY-MM-DD)
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Initialize form data
  useEffect(() => {
    if (!isOpen) return;

    if (isEditing && tripId) {
      // Load existing trip data
      loadTripData(tripId);
    } else {
      // Initialize with selected date for new trip
      setFormData({
        date: formatDateForInput(selectedDate),
        water: '',
        location: '',
        hours: 1,
        companions: '',
        notes: ''
      });
    }
    
    // Reset validation and error state
    setValidation({ isValid: true, errors: {} });
    setError(null);
  }, [isOpen, isEditing, tripId, selectedDate]);

  // Load trip data for editing
  const loadTripData = async (id: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const trip = await db.trips.getById(id);
      if (trip) {
        setFormData({
          date: trip.date,
          water: trip.water,
          location: trip.location,
          hours: trip.hours,
          companions: trip.companions,
          notes: trip.notes
        });
      } else {
        setError('Trip not found');
      }
    } catch (err) {
      console.error('Error loading trip:', err);
      setError('Failed to load trip data');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form field changes
  const handleInputChange = (field: keyof Omit<Trip, 'id'>, value: string | number) => {
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

    if (!formData.water.trim()) {
      errors.water = 'Water body is required';
    }

    if (!formData.location.trim()) {
      errors.location = 'Location is required';
    }

    if (!formData.date) {
      errors.date = 'Date is required';
    }

    if (formData.hours < 0.5 || formData.hours > 24) {
      errors.hours = 'Hours must be between 0.5 and 24';
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
    setError(null);

    try {
      if (isEditing && tripId) {
        // Update existing trip
        await db.trips.update({
          id: tripId,
          ...formData
        });
      } else {
        // Create new trip
        await db.trips.create(formData);
      }

      // Close modal on success
      onClose();
    } catch (err) {
      console.error('Error saving trip:', err);
      setError('Failed to save trip. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      className="trip-details-modal"
    >
      <ModalHeader
        title={isEditing ? 'Edit Trip' : 'New Trip'}
        subtitle={isEditing ? 'Update trip details' : 'Log a new fishing trip'}
        onClose={onClose}
      />

      <ModalBody>
        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
            <div className="flex items-center">
              <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
              <span className="text-red-700 dark:text-red-300">{error}</span>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading trip data...</span>
          </div>
        )}

        {/* Form */}
        {!isLoading && (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Trip Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Date */}
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    validation.errors.date ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {validation.errors.date && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validation.errors.date}</p>
                )}
              </div>

              {/* Hours */}
              <div>
                <label htmlFor="hours" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Duration (hours) *
                </label>
                <input
                  type="number"
                  id="hours"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={formData.hours}
                  onChange={(e) => handleInputChange('hours', parseFloat(e.target.value) || 1)}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                    validation.errors.hours ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {validation.errors.hours && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validation.errors.hours}</p>
                )}
              </div>
            </div>

            {/* Water Body */}
            <div>
              <label htmlFor="water" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Water Body *
              </label>
              <input
                type="text"
                id="water"
                value={formData.water}
                onChange={(e) => handleInputChange('water', e.target.value)}
                placeholder="e.g., Lake Taupo, Waikato River"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  validation.errors.water ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {validation.errors.water && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validation.errors.water}</p>
              )}
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Specific Location *
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="e.g., Western Bays, Hamilton Gardens"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  validation.errors.location ? 'border-red-500' : 'border-gray-300'
                }`}
                required
              />
              {validation.errors.location && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validation.errors.location}</p>
              )}
            </div>

            {/* Companions */}
            <div>
              <label htmlFor="companions" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Companions
              </label>
              <input
                type="text"
                id="companions"
                value={formData.companions}
                onChange={(e) => handleInputChange('companions', e.target.value)}
                placeholder="e.g., John, Sarah (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                id="notes"
                rows={4}
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Any additional notes about the trip..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-vertical"
              />
            </div>

            {/* Weather and Fish Catch Sections - Placeholders for future implementation */}
            <div className="border-t pt-6 dark:border-gray-600">
              <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-4">
                Additional Information
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <i className="fas fa-cloud-sun mr-2"></i>
                    Weather Conditions
                  </h5>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Weather logging will be available in a future update
                  </p>
                </div>
                
                <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    <i className="fas fa-fish mr-2"></i>
                    Fish Caught
                  </h5>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Fish catch logging will be available in a future update
                  </p>
                </div>
              </div>
            </div>
          </form>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={isSaving || isLoading}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center"
          >
            {isSaving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            {isEditing ? 'Update Trip' : 'Create Trip'}
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default TripDetailsModal;