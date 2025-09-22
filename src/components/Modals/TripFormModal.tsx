import React, { useState, useCallback } from "react";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { useIndexedDB } from "../../hooks/useIndexedDB";
import type { Trip } from "../../types";

export interface TripFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  onTripCreated?: (trip: Trip) => void;
}

/**
 * TripFormModal component for creating new fishing trips
 * Features:
 * - Form fields for water body, location, hours, companions, and notes
 * - Form validation
 * - Database integration for saving trips
 */
export const TripFormModal: React.FC<TripFormModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onTripCreated,
}) => {
  const db = useIndexedDB();
  const [formData, setFormData] = useState({
    water: "",
    location: "",
    hours: 1,
    companions: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        water: "",
        location: "",
        hours: 1,
        companions: "",
        notes: "",
      });
      setError(null);
    }
  }, [isOpen]);

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
    if (!formData.water.trim()) {
      setError("Water body is required");
      return false;
    }
    if (!formData.location.trim()) {
      setError("Location is required");
      return false;
    }
    if (formData.hours < 0.5) {
      setError("Hours must be at least 0.5");
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
      // Use local date string to avoid timezone conversion issues
      const dateStr = selectedDate.toLocaleDateString("en-CA");

      const tripData: Omit<Trip, "id"> = {
        date: dateStr,
        water: formData.water.trim(),
        location: formData.location.trim(),
        hours: formData.hours,
        companions: formData.companions.trim(),
        notes: formData.notes.trim(),
      };

      const tripId = await db.trips.create(tripData);

      const newTrip: Trip = {
        id: tripId,
        ...tripData,
      };

      console.log('TripFormModal: Trip created successfully, calling onTripCreated callback');
      if (onTripCreated) {
        console.log('TripFormModal: Executing onTripCreated callback');
        onTripCreated(newTrip);
        // Don't call onClose() when callback is provided - let the callback handle navigation
        console.log('TripFormModal: Callback executed, not calling onClose()');
      } else {
        console.log('TripFormModal: No onTripCreated callback provided, calling onClose()');
        onClose();
      }
    } catch (err) {
      console.error("Error creating trip:", err);
      setError("Failed to save trip. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="md">
      <ModalHeader
        title="Log a New Trip"
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

          {/* Water Body */}
          <div>
            <label htmlFor="water" className="form-label">
              Water Body
            </label>
            <input
              type="text"
              id="water"
              value={formData.water}
              onChange={(e) => handleInputChange("water", e.target.value)}
              placeholder="Water Body (e.g., Lake Taupo)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Specific Location */}
          <div>
            <label htmlFor="location" className="form-label">
              Specific Location
            </label>
            <input
              type="text"
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange("location", e.target.value)}
              placeholder="Specific Location (e.g., Stump Bay)"
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Hours Fished and Fished With */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="hours" className="form-label">
                Hours Fished
              </label>
              <input
                type="number"
                id="hours"
                min="0.5"
                step="0.5"
                value={formData.hours}
                onChange={(e) => handleInputChange("hours", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="companions" className="form-label">
                Fished with
              </label>
              <input
                type="text"
                id="companions"
                value={formData.companions}
                onChange={(e) => handleInputChange("companions", e.target.value)}
                placeholder="Fished with"
                className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Best Times / Notes */}
          <div>
            <label htmlFor="notes" className="form-label">
              Best Times / Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Best Times / Notes"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
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
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Saving...
                </>
              ) : (
                "Save Trip"
              )}
            </button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default TripFormModal;