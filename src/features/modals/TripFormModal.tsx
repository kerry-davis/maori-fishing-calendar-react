import React, { useState, useCallback } from "react";
import { Button } from "@shared/components/Button";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { useDatabaseService } from '../../app/providers/DatabaseContext';
import type { Trip, SavedLocation } from "@shared/types";

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
  const db = useDatabaseService();
  const [formData, setFormData] = useState({
    water: "",
    location: "",
    hours: 1,
    companions: "",
    notes: "",
  });
  const [selectedSavedLocationId, setSelectedSavedLocationId] = useState<string>("");
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
      setSelectedSavedLocationId("");
    }
  }, [isOpen]);

  const handleInputChange = useCallback((field: string, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    if (field === "water" || field === "location") {
      setSelectedSavedLocationId("");
    }

    if (error) {
      setError(null);
    }
  }, [error]);

  const handleSavedLocationSelect = useCallback((savedLocation: SavedLocation | null) => {
    if (!savedLocation) {
      setSelectedSavedLocationId("");
      return;
    }

    setSelectedSavedLocationId(savedLocation.id);

    setFormData(prev => ({
      ...prev,
      water: savedLocation.water ?? prev.water,
      location: savedLocation.location ?? prev.location,
      notes: prev.notes?.trim().length ? prev.notes : (savedLocation.notes ?? ""),
    }));

    setError(null);
  }, []);

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

      const tripId = await db.createTrip(tripData);

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
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--error-background)', border: '1px solid var(--error-border)' }}>
              <div className="flex items-center">
                <i className="fas fa-exclamation-triangle mr-2" style={{ color: 'var(--error-text)' }}></i>
                <span className="text-sm" style={{ color: 'var(--error-text)' }}>{error}</span>
              </div>
            </div>
          )}

          {/* Water Body */}
          <div>
            <label htmlFor="water" className="form-label" style={{ color: 'var(--primary-text)' }}>
              Water Body
            </label>
            <input
              type="text"
              id="water"
              value={formData.water}
              onChange={(e) => handleInputChange("water", e.target.value)}
              placeholder="Water Body (e.g., Lake Taupo)"
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--input-background)',
                border: '1px solid var(--border-color)',
                color: 'var(--primary-text)'
              }}
              required
            />
          </div>

          {/* Specific Location */}
          <div>
            <label htmlFor="location" className="form-label" style={{ color: 'var(--primary-text)' }}>
              Specific Location
            </label>
            <input
              type="text"
              id="location"
              value={formData.location}
              onChange={(e) => handleInputChange("location", e.target.value)}
              placeholder="Specific Location (e.g., Stump Bay)"
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                backgroundColor: 'var(--input-background)',
                border: '1px solid var(--border-color)',
                color: 'var(--primary-text)'
              }}
              required
            />
          </div>

          {/* Hours Fished and Fished With */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="hours" className="form-label" style={{ color: 'var(--primary-text)' }}>
                Hours Fished
              </label>
              <input
                type="number"
                id="hours"
                min="0.5"
                step="0.5"
                value={formData.hours}
                onChange={(e) => handleInputChange("hours", parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-text)'
                }}
                required
              />
            </div>

            <div>
              <label htmlFor="companions" className="form-label" style={{ color: 'var(--primary-text)' }}>
                Fished with
              </label>
              <input
                type="text"
                id="companions"
                value={formData.companions}
                onChange={(e) => handleInputChange("companions", e.target.value)}
                placeholder="Fished with"
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-text)'
                }}
              />
            </div>
          </div>

          {/* Best Times / Notes */}
          <div>
            <label htmlFor="notes" className="form-label" style={{ color: 'var(--primary-text)' }}>
              Best Times / Notes
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              placeholder="Best Times / Notes"
              rows={3}
              className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              style={{
                backgroundColor: 'var(--input-background)',
                border: '1px solid var(--border-color)',
                color: 'var(--primary-text)'
              }}
            />
          </div>
        </ModalBody>

        <ModalFooter>
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Trip"}
            </Button>
          </div>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default TripFormModal;