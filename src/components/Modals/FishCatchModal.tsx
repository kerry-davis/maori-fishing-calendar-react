import React, { useState, useCallback } from "react";
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
  fishId?: string; // For editing existing fish catch
  onFishCaught?: (fish: FishCaught) => void;
}

/**
 * FishCatchModal component for adding fish catches to a trip
 * Features:
 * - Form fields for species, length, weight, time, details
 * - Gear selection integration
 * - Photo upload functionality
 * - Form validation and database integration
 */
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showGearModal, setShowGearModal] = useState(false);
  const [_uploadingPhoto, setUploadingPhoto] = useState(false);
  const isEditing = fishId !== undefined;

  // Load existing fish data when editing
  const loadFishData = async (id: string) => {
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
  };

  // Reset form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      if (isEditing && fishId) {
        loadFishData(fishId);
      } else {
        // Creating new fish catch
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
    }
  }, [isOpen, isEditing, fishId]);

  const handleInputChange = useCallback((field: string, value: string | string[]) => {
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
    if (!formData.species.trim()) {
      setError("Species is required");
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
      const fishData: Omit<FishCaught, "id"> = {
        tripId,
        species: formData.species.trim(),
        length: formData.length.trim(),
        weight: formData.weight.trim(),
        time: formData.time.trim(),
        gear: formData.gear,
        details: formData.details.trim(),
        ...(formData.photo && { photo: formData.photo }),
      };

      if (isEditing && fishId) {
        // Update existing fish catch
        await db.updateFishCaught({
          id: fishId,
          ...fishData
        });

        const updatedFish: FishCaught = {
          id: fishId,
          ...fishData,
        };

        if (onFishCaught) {
          onFishCaught(updatedFish);
        }
      } else {
        // Create new fish catch
        const newFishId = await db.createFishCaught(fishData);

        const newFish: FishCaught = {
          id: newFishId.toString(),
          ...fishData,
        };

        if (onFishCaught) {
          onFishCaught(newFish);
        }
      }

      onClose();
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} fish catch:`, err);
      setError(`Failed to ${isEditing ? 'update' : 'save'} fish catch. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    setUploadingPhoto(true);
    setError(null);

    try {
      // Create storage reference: users/{userId}/catches/{catchId}/{filename}
      // For new catches, we'll use a temporary ID, for edits we'll use the existing catch ID
      const catchId = fishId || `temp_${Date.now()}`;
      const storagePath = `users/${user.uid}/catches/${catchId}/${file.name}`;
      const storageRef = ref(storage, storagePath);

      // Upload file
      await uploadBytes(storageRef, file);

      // Get download URL
      const downloadURL = await getDownloadURL(storageRef);

      // Update form data with the download URL
      handleInputChange("photo", downloadURL);

      // Store the storage path for potential cleanup
      handleInputChange("photoPath", storagePath);

    } catch (err) {
      console.error('Photo upload failed:', err);
      setError('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleGearSelection = (selectedGear: string[]) => {
    handleInputChange("gear", selectedGear);
    setShowGearModal(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="md" maxHeight="80vh">
        <ModalHeader
          title={isEditing ? "Edit Fish Catch" : "Add Fish Catch"}
          subtitle={isEditing ? "Update details of your catch" : "Record details of your catch"}
          onClose={onClose}
        />

        <form onSubmit={handleSubmit}>
          <ModalBody className="space-y-4 max-h-[60vh] overflow-y-auto">
            {/* Error display */}
            {error && (
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--error-background)', border: '1px solid var(--error-border)' }}>
                <div className="flex items-center">
                  <i className="fas fa-exclamation-triangle mr-2" style={{ color: 'var(--error-text)' }}></i>
                  <span className="text-sm" style={{ color: 'var(--error-text)' }}>{error}</span>
                </div>
              </div>
            )}

            {/* Species */}
            <div>
              <label htmlFor="species" className="form-label" style={{ color: 'var(--primary-text)' }}>
                Species *
              </label>
              <input
                type="text"
                id="species"
                value={formData.species}
                onChange={(e) => handleInputChange("species", e.target.value)}
                placeholder="e.g., Rainbow Trout, Snapper"
                className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                style={{
                  backgroundColor: 'var(--input-background)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--primary-text)'
                }}
                required
              />
            </div>

            {/* Length and Weight */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="length" className="form-label" style={{ color: 'var(--primary-text)' }}>
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
                <label htmlFor="weight" className="form-label" style={{ color: 'var(--primary-text)' }}>
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
              <label htmlFor="time" className="form-label" style={{ color: 'var(--primary-text)' }}>
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

            {/* Gear Selection */}
            <div>
              <label className="form-label" style={{ color: 'var(--primary-text)' }}>
                Gear Used
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.gear.map((gearItem, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs"
                    style={{ backgroundColor: 'var(--chip-background)', color: 'var(--chip-text)' }}
                  >
                    {gearItem}
                    <button
                      type="button"
                      onClick={() => {
                        const newGear = formData.gear.filter((_, i) => i !== index);
                        handleInputChange("gear", newGear);
                      }}
                      className="ml-1"
                      style={{ color: 'var(--chip-text)' }}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </span>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowGearModal(true)}
                className="w-full px-3 py-2 rounded-md hover:opacity-80 transition-colors text-left"
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

            {/* Photo Upload */}
            <div>
              <label className="form-label" style={{ color: 'var(--primary-text)' }}>
                Photo (Optional)
              </label>

              {/* Current Photo Section (when editing) */}
              {isEditing && formData.photo && (
                <div className="mt-2">
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--secondary-text)' }}>
                    Current Photo
                  </div>
                  <div className="relative inline-block">
                    <img
                      src={formData.photo}
                      alt="Current catch photo"
                      className="w-32 h-32 object-cover rounded"
                      style={{ border: '1px solid var(--border-color)' }}
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (formData.photoPath && user) {
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

              {/* Upload New Photo Section */}
              <div className="mt-4">
                <button
                  type="button"
                  className="w-full border-2 border-dashed rounded-lg p-6 text-center hover:opacity-80 transition-colors"
                  style={{
                    backgroundColor: 'var(--input-background)',
                    borderColor: 'var(--border-color)',
                  }}
                  onClick={() => document.getElementById('photo')?.click()}
                >
                  <div className="space-y-2">
                    <div className="flex justify-center">
                      <i className="fas fa-camera text-2xl" style={{ color: 'var(--secondary-text)' }}></i>
                    </div>
                    <div className="text-sm" style={{ color: 'var(--secondary-text)' }}>
                      Upload New Photo
                    </div>
                  </div>
                </button>

                <input
                  type="file"
                  id="photo"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {/* New Photo Preview (when adding new photo) */}
              {formData.photo && !isEditing && (
                <div className="mt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium" style={{ color: 'var(--secondary-text)' }}>
                      Selected Photo:
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        if (formData.photoPath && user) {
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
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      <i className="fas fa-times"></i> Remove
                    </button>
                  </div>
                  <div className="mt-2">
                    <img
                      src={formData.photo}
                      alt="Catch preview"
                      className="w-32 h-32 object-cover rounded"
                      style={{ border: '1px solid var(--border-color)' }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Details */}
            <div>
              <label htmlFor="details" className="form-label" style={{ color: 'var(--primary-text)' }}>
                Details (Optional)
              </label>
              <textarea
                id="details"
                rows={3}
                value={formData.details}
                onChange={(e) => handleInputChange("details", e.target.value)}
                placeholder="Additional notes about the catch..."
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
            <div className="flex justify-end space-x-3 w-full">
              <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting} disabled={isSubmitting}>
                {isSubmitting ? (isEditing ? 'Updating...' : 'Saving...') : (isEditing ? 'Update Fish' : 'Save Fish')}
              </Button>
            </div>
          </ModalFooter>
        </form>
      </Modal>

      {/* Gear Selection Modal */}
      <GearSelectionModal
        isOpen={showGearModal}
        onClose={() => setShowGearModal(false)}
        selectedGear={formData.gear}
        onGearSelected={handleGearSelection}
      />
    </>
  );
};

export default FishCatchModal;