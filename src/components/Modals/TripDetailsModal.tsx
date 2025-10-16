import React, { useState, useEffect } from 'react';
import { Button } from '../UI';
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal';
import { useAuth } from '../../contexts/AuthContext';
import { firebaseDataService } from '../../services/firebaseDataService';
import { databaseService } from '../../services/databaseService';
import type { Trip, TripModalProps, FormValidation } from '../../types';
import { DEV_LOG, PROD_ERROR } from '../../utils/loggingHelpers';

/**
 * TripDetailsModal component for creating and editing trips
 * Features:
 * - Trip creation/editing form with validation
 * - Form state management and data persistence
 * - Focus on core trip information (weather and fish catches managed separately)
 */
export const TripDetailsModal: React.FC<TripModalProps> = ({
  isOpen,
  onClose,
  tripId,
  selectedDate,
  onTripUpdated,
  onCancelEdit
}) => {
  const { user } = useAuth();
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

  const isEditing = tripId !== undefined;

  // Format date for input field (YYYY-MM-DD)
  const formatDateForInput = (date: Date): string => {
    // Use local date string to avoid timezone conversion issues
    return date.toLocaleDateString("en-CA");
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
      // Try local storage first (works for both guest and authenticated users)
      let trip = await databaseService.getTripById(id);

      // If not found locally and user is authenticated, try Firebase as fallback
      if (!trip && user) {
        DEV_LOG('Trip not found in local storage, trying Firebase...');
        trip = await firebaseDataService.getTripById(id);
      }

      // Additional Firebase fallback for authenticated users
      if (!trip && user) {
        DEV_LOG('Trip not found via ID mapping, trying direct Firebase lookup...');

        // First, try to get all trips and find the one with matching ID
        const allTrips = await firebaseDataService.getAllTrips();
        const foundTrip = allTrips.find(t => t.id === id);
        if (foundTrip) {
          trip = foundTrip;
        }

        // If still not found, try the new Firebase ID lookup method
        if (!trip) {
          DEV_LOG('Searching for trip with ID:', id);
          // Try to find the Firebase document ID by searching through all trips
          const allFirebaseTrips = await firebaseDataService.getAllTrips();
          const matchingTrip = allFirebaseTrips.find(t => t.id === id);

          if (matchingTrip && matchingTrip.firebaseDocId) {
            DEV_LOG('Found trip via search, trying direct Firebase lookup with doc ID:', matchingTrip.firebaseDocId);
            trip = await firebaseDataService.getTripByFirebaseId(matchingTrip.firebaseDocId);
          }
        }
      }

      if (trip) {
        setFormData({
          date: trip.date,
          water: trip.water,
          location: trip.location,
          hours: trip.hours,
          companions: trip.companions,
          notes: trip.notes
        });
        DEV_LOG('Trip loaded successfully for editing:', trip.id);
      } else {
        PROD_ERROR('Trip not found in either local storage or Firebase:', id);
        setError('Trip not found');
      }
    } catch (err) {
      PROD_ERROR('Error loading trip:', err);
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

    // Allow trip saving for both authenticated and guest users

    const validationResult = validateForm();
    setValidation(validationResult);

    if (!validationResult.isValid) {
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      if (isEditing && tripId) {
        // Update existing trip - use local storage first for reliability
        await databaseService.updateTrip({ id: tripId, ...formData });

        // Also update in Firebase if online - try multiple approaches
        try {
          // First, try to get the trip from Firebase to see if it has firebaseDocId
          const allTrips = await firebaseDataService.getAllTrips();
          const existingTrip = allTrips.find(t => t.id === tripId);

          if (existingTrip && existingTrip.firebaseDocId) {
            // Use the direct Firebase document ID if available
            DEV_LOG('Using direct Firebase document ID for update:', existingTrip.firebaseDocId);
            await firebaseDataService.updateTripWithFirebaseId(existingTrip.firebaseDocId, { id: tripId, ...formData });
          } else {
            // Fall back to the regular update method
            await firebaseDataService.updateTrip({ id: tripId, ...formData });
          }
        } catch (firebaseError) {
          DEV_LOG('Firebase update failed, but local update succeeded:', firebaseError);
        }
      } else {
        // Create new trip
        await firebaseDataService.createTrip(formData);
      }

      // Call the trip updated callback and close modal on success
      if (onTripUpdated) {
        onTripUpdated();
        // Don't call onClose() when callback is provided - let the callback handle navigation
      } else {
        onClose();
      }
    } catch (err) {
      PROD_ERROR('Error saving trip:', err);
      setError('Failed to save trip. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    if (isEditing && onCancelEdit) {
      // When editing and canceling, return to trip log
      onCancelEdit();
    } else {
      // When creating new trip and canceling, just close
      onClose();
    }
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
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: 'var(--error-background)', border: '1px solid var(--error-border)' }}>
            <div className="flex items-center">
              <i className="fas fa-exclamation-triangle mr-2" style={{ color: 'var(--error-text)' }}></i>
              <span style={{ color: 'var(--error-text)' }}>{error}</span>
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
                <label htmlFor="date" className="form-label">
                  Date *
                </label>
                <input
                  type="date"
                  id="date"
                  value={formData.date}
                  onChange={(e) => handleInputChange('date', e.target.value)}
                  className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validation.errors.date ? 'border-red-500' : ''
                  }`}
                  style={{
                    backgroundColor: 'var(--input-background)',
                    border: `1px solid ${validation.errors.date ? 'var(--error-border)' : 'var(--border-color)'}`,
                    color: 'var(--primary-text)'
                  }}
                  required
                />
                {validation.errors.date && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--error-text)' }}>{validation.errors.date}</p>
                )}
              </div>

              {/* Hours */}
              <div>
                <label htmlFor="hours" className="form-label">
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
                  className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    validation.errors.hours ? 'border-red-500' : ''
                  }`}
                  style={{
                    backgroundColor: 'var(--input-background)',
                    border: `1px solid ${validation.errors.hours ? 'var(--error-border)' : 'var(--border-color)'}`,
                    color: 'var(--primary-text)'
                  }}
                  required
                />
                {validation.errors.hours && (
                  <p className="mt-1 text-sm" style={{ color: 'var(--error-text)' }}>{validation.errors.hours}</p>
                )}
              </div>
            </div>

            {/* Water Body */}
            <div>
              <label htmlFor="water" className="form-label">
                Water Body *
              </label>
              <input
                type="text"
                id="water"
                value={formData.water}
                onChange={(e) => handleInputChange('water', e.target.value)}
                placeholder="e.g., Lake Taupo, Waikato River"
                className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validation.errors.water ? 'border-red-500' : ''
                }`}
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: `1px solid ${validation.errors.water ? 'var(--error-border)' : 'var(--border-color)'}`,
                  color: 'var(--primary-text)'
                }}
                required
              />
              {validation.errors.water && (
                <p className="mt-1 text-sm" style={{ color: 'var(--error-text)' }}>{validation.errors.water}</p>
              )}
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="form-label">
                Specific Location *
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => handleInputChange('location', e.target.value)}
                placeholder="e.g., Western Bays, Hamilton Gardens"
                className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validation.errors.location ? 'border-red-500' : ''
                }`}
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: `1px solid ${validation.errors.location ? 'var(--error-border)' : 'var(--border-color)'}`,
                  color: 'var(--primary-text)'
                }}
                required
              />
              {validation.errors.location && (
                <p className="mt-1 text-sm" style={{ color: 'var(--error-text)' }}>{validation.errors.location}</p>
              )}
            </div>

            {/* Companions */}
            <div>
              <label htmlFor="companions" className="form-label">
                Companions
              </label>
              <input
                type="text"
                id="companions"
                value={formData.companions}
                onChange={(e) => handleInputChange('companions', e.target.value)}
                placeholder="e.g., John, Sarah (optional)"
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-text)'
                }}
              />
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="form-label">
                Notes
              </label>
              <textarea
                id="notes"
                rows={4}
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Any additional notes about the trip..."
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-text)'
                }}
              />
            </div>

          </form>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex justify-end space-x-3">
          <Button type="button" variant="secondary" onClick={handleCancel} disabled={isSaving}>Cancel</Button>
          <Button type="submit" onClick={handleSubmit} loading={isSaving} disabled={isSaving || isLoading}>
            {isSaving ? (isEditing ? 'Updating…' : 'Saving…') : (isEditing ? 'Update' : 'Save')}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
};

export default TripDetailsModal;