import React, { useState, useCallback, useEffect } from "react";
import { Button } from "../UI";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { useDatabaseService } from "../../contexts/DatabaseContext";
import { useAuth } from "../../contexts/AuthContext";
import { GearSelectionModal } from "./GearSelectionModal";
import { storage } from "../../services/firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import type { FishCaught } from "../../types";

export interface FishCatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: number;
  fishId?: string;
  onFishCaught?: (fish: FishCaught) => void;
}

export const FishCatchModal: React.FC<FishCatchModalProps> = ({
  isOpen,
  onClose,
  tripId,
  fishId,
  onFishCaught,
}) => {
  const db = useDatabaseService();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    species: "",
    length: "",
    weight: "",
    time: "",
    gear: [] as string[],
    details: "",
    photo: "",
    photoPath: "",
  });
  const [validation, setValidation] = useState({
    isValid: true,
    errors: {} as Record<string, string>
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGearModal, setShowGearModal] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const isEditing = fishId !== undefined;

  const loadFishData = useCallback(async (id: string) => {
    setError(null);
    try {
      const fish = await db.getFishCaughtById(id);
      if (fish) {
        setFormData({
          species: fish.species,
          length: fish.length,
          weight: fish.weight,
          time: fish.time,
          gear: fish.gear,
          details: fish.details,
          photo: fish.photo || "",
          photoPath: "",
        });
      } else {
        setError('Fish catch not found');
      }
    } catch (err) {
      console.error('Error loading fish catch:', err);
      setError('Failed to load fish catch data');
    }
  }, [db]);

  useEffect(() => {
    if (isOpen) {
      if (isEditing && fishId) {
        loadFishData(fishId);
      } else {
        setFormData({
          species: "",
          length: "",
          weight: "",
          time: "",
          gear: [],
          details: "",
          photo: "",
          photoPath: "",
        });
      }
      setError(null);
      setValidation({ isValid: true, errors: {} });
    }
  }, [isOpen, isEditing, fishId, loadFishData]);

  const handleInputChange = useCallback((field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));

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

    // Clear general error
    if (error) setError(null);
  }, [error, validation.errors]);

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!formData.species.trim()) {
      errors.species = "Species is required";
    }

    const isValid = Object.keys(errors).length === 0;
    setValidation({ isValid, errors });
    return { isValid, errors };
  }, [formData]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    const validationResult = validateForm();
    setValidation(validationResult);

    if (!validationResult.isValid) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const fishData: Omit<FishCaught, "id"> = {
        tripId,
        species: formData.species.trim(),
        length: formData.length.trim(),
        weight: formData.weight.trim(),
        time: formData.time.trim(),
        gear: formData.gear,
        details: formData.details.trim(),
        photo: formData.photo,
      };

      let savedData: FishCaught;
      if (isEditing && fishId) {
        await db.updateFishCaught({ id: fishId, ...fishData });
        savedData = { id: fishId, ...fishData };
      } else {
        const newId = await db.createFishCaught(fishData);
        savedData = { id: newId.toString(), ...fishData };
      }

      if (onFishCaught) onFishCaught(savedData);
      onClose();
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} fish catch:`, err);
      setError(`Failed to ${isEditing ? 'update' : 'save'} fish catch. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  }, [db, formData, isEditing, onClose, onFishCaught, tripId, validateForm, fishId]);

  const handlePhotoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    setIsUploadingPhoto(true);
    setError(null);

    try {
      const catchId = fishId || `temp_${Date.now()}`;
      const storagePath = `users/${user.uid}/catches/${catchId}/${file.name}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      handleInputChange("photo", downloadURL);
      handleInputChange("photoPath", storagePath);
    } catch (err) {
      console.error('Photo upload failed:', err);
      setError('Failed to upload photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }, [user, fishId, handleInputChange]);

  const handleGearSelection = (selectedGear: string[]) => {
    handleInputChange("gear", selectedGear);
    setShowGearModal(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl">
        <ModalHeader
          title={isEditing ? "Edit Fish Catch" : "Add Fish Catch"}
          subtitle={isEditing ? "Update details of your catch" : "Record details of your catch"}
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

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Species */}
            <div>
              <label htmlFor="species" className="form-label">
                Species *
              </label>
              <input
                type="text"
                id="species"
                value={formData.species}
                onChange={(e) => handleInputChange("species", e.target.value)}
                placeholder="e.g., Rainbow Trout, Snapper"
                className={`w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  validation.errors.species ? 'border-red-500' : ''
                }`}
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: `1px solid ${validation.errors.species ? 'var(--error-border)' : 'var(--border-color)'}`,
                  color: 'var(--primary-text)'
                }}
                required
              />
              {validation.errors.species && (
                <p className="mt-1 text-sm" style={{ color: 'var(--error-text)' }}>{validation.errors.species}</p>
              )}
            </div>

            {/* Length and Weight Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="length" className="form-label">
                  Length
                </label>
                <input
                  type="text"
                  id="length"
                  value={formData.length}
                  onChange={(e) => handleInputChange("length", e.target.value)}
                  placeholder="e.g., 55cm"
                  className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--input-background)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary-text)'
                  }}
                />
              </div>
              <div>
                <label htmlFor="weight" className="form-label">
                  Weight
                </label>
                <input
                  type="text"
                  id="weight"
                  value={formData.weight}
                  onChange={(e) => handleInputChange("weight", e.target.value)}
                  placeholder="e.g., 2.5kg"
                  className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--input-background)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary-text)'
                  }}
                />
              </div>
            </div>

            {/* Time of Catch */}
            <div>
              <label htmlFor="time" className="form-label">
                Time of Catch
              </label>
              <input
                type="time"
                id="time"
                value={formData.time}
                onChange={(e) => handleInputChange("time", e.target.value)}
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-text)'
                }}
              />
            </div>

            {/* Gear Used */}
            <div>
              <label className="form-label">
                Gear Used
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.gear.map((gearItem, index) => (
                  <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs" style={{ backgroundColor: 'var(--chip-background)', color: 'var(--chip-text)' }}>
                    {gearItem}
                    <button type="button" onClick={() => handleInputChange("gear", formData.gear.filter((_, i) => i !== index))} className="ml-1" style={{ color: 'var(--chip-text)' }}>
                      <i className="fas fa-times"></i>
                    </button>
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowGearModal(true)}
                className="w-full px-3 py-2 rounded-md hover:opacity-80 transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-text)'
                }}
              >
                <i className="fas fa-plus mr-2"></i>
                {formData.gear.length > 0 ? "Add More Gear" : "Select Gear"}
              </button>
            </div>

            {/* Photo Section */}
            <div>
              <label className="form-label">
                Photo (Optional)
              </label>
              {isEditing && formData.photo && (
                <div className="mt-2">
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--secondary-text)' }}>Current Photo</div>
                  <div className="relative inline-block">
                    <img src={formData.photo} alt="Current catch" className="w-32 h-32 object-cover rounded" style={{ border: '1px solid var(--border-color)' }} />
                    <button
                      type="button"
                      onClick={async () => {
                        if (formData.photoPath) {
                          try {
                            const storageRef = ref(storage, formData.photoPath);
                            await deleteObject(storageRef);
                          } catch (err) {
                            console.warn('Failed to delete photo from storage:', err);
                          }
                        }
                        handleInputChange("photo", "");
                        handleInputChange("photoPath", "");
                      }}
                      className="absolute top-2 right-2 btn btn-danger px-2 py-1 text-xs"
                    >
                      Delete Photo
                    </button>
                  </div>
                </div>
              )}
              <div className="mt-4">
                <button
                  type="button"
                  className="w-full border-2 border-dashed rounded-lg p-6 text-center hover:opacity-80 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ backgroundColor: 'var(--input-background)', borderColor: 'var(--border-color)' }}
                  onClick={() => document.getElementById('photo-upload')?.click()}
                >
                  <div className="space-y-2">
                    <div className="flex justify-center">
                      <i className="fas fa-camera text-2xl" style={{ color: 'var(--secondary-text)' }}></i>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--secondary-text)' }}>{isUploadingPhoto ? "Uploading..." : "Upload New Photo"}</div>
                  </div>
                </button>
                <input type="file" id="photo-upload" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
              </div>
            </div>

            {/* Details */}
            <div>
              <label htmlFor="details" className="form-label">
                Details (Optional)
              </label>
              <textarea
                id="details"
                rows={3}
                value={formData.details}
                onChange={(e) => handleInputChange("details", e.target.value)}
                placeholder="Additional notes about the catch..."
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-text)'
                }}
              />
            </div>
          </form>
        </ModalBody>

        <ModalFooter>
          <div className="flex justify-end space-x-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" onClick={handleSubmit} loading={isSubmitting} disabled={isSubmitting}>
              {isSubmitting ? (isEditing ? 'Updating…' : 'Saving…') : (isEditing ? 'Update' : 'Save')}
            </Button>
          </div>
        </ModalFooter>
      </Modal>
      <GearSelectionModal isOpen={showGearModal} onClose={() => setShowGearModal(false)} selectedGear={formData.gear} onGearSelected={handleGearSelection} />
    </>
  );
};

export default FishCatchModal;