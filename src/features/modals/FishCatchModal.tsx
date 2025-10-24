import React, { useState, useCallback, useEffect } from "react";
import { firebaseDataService } from "@shared/services/firebaseDataService";
import { Button } from "@shared/components/Button";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "./Modal";
import { useDatabaseService } from '../../app/providers/DatabaseContext';
import { useAuth } from '../../app/providers/AuthContext';
import { useFirebaseTackleBox } from "@shared/hooks/useFirebaseTackleBox";
import { storage } from "@shared/services/firebase";
import { ref, deleteObject } from "firebase/storage";
import type { FishCaught } from "@shared/types";
import { createSignInEncryptedPlaceholder } from "@shared/utils/photoPreviewUtils";
import { getOrCreateGuestSessionId } from "@shared/services/guestSessionService";

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
  const [tackleBox] = useFirebaseTackleBox();
  const [formData, setFormData] = useState({
    species: "",
    length: "",
    weight: "",
    time: "",
    gear: [] as string[],
    details: "",
    photo: "",
    photoPath: "",
    encryptedMetadata: undefined as string | undefined,
  });
  const [validation, setValidation] = useState({
    isValid: true,
    errors: {} as Record<string, string>
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
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
          photoPath: fish.photoPath || "",
          encryptedMetadata: fish.encryptedMetadata ?? undefined,
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
          encryptedMetadata: undefined,
        });
      }
      setError(null);
      setValidation({ isValid: true, errors: {} });
      setPhotoPreview(null);
      setUploadError(null);
    }
  }, [isOpen, isEditing, fishId, loadFishData]);

  // Cleanup photo preview URL when preview changes or component unmounts
  useEffect(() => {
    return () => {
      if (photoPreview && photoPreview.startsWith('blob:')) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  // Async decryption for encrypted photos
  useEffect(() => {
    let isMounted = true;
    const tryDecryptPhoto = async () => {
      if (formData.encryptedMetadata && formData.photoPath) {
        setIsPhotoLoading(true);
        try {
          // If guest (unauthenticated), show sign-in placeholder instead of attempting decrypt
          if (!user) {
            if (isMounted) setPhotoPreview(createSignInEncryptedPlaceholder());
          } else {
            const result = await firebaseDataService.getDecryptedPhoto(formData.photoPath, formData.encryptedMetadata);
            if (isMounted && result && result.data) {
              const blob = new Blob([result.data], { type: result.mimeType });
              const url = URL.createObjectURL(blob);
              setPhotoPreview(url);
            } else if (isMounted) {
              setPhotoPreview(createSignInEncryptedPlaceholder());
            }
          }
        } catch (err) {
          if (isMounted) setPhotoPreview(createSignInEncryptedPlaceholder());
        } finally {
          if (isMounted) setIsPhotoLoading(false);
        }
      } else {
        setIsPhotoLoading(false);
      }
    };
    tryDecryptPhoto();
    return () => { isMounted = false; };
  }, [formData.encryptedMetadata, formData.photoPath, user]);

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

      // If the photo field contains a data URL, we want the server side
      // `ensurePhotoInStorage` to move it into Storage and set `photoPath` and
      // `encryptedMetadata`. Ensure we don't accidentally persist stale
      // `photoPath`/`photoUrl`/`encryptedMetadata` from an earlier edit.
      if (typeof formData.photo === 'string' && formData.photo.startsWith('data:')) {
        // Explicitly ensure these fields are not set on the client payload so the
        // server/data service takes ownership of storing and populating them.
        (fishData as any).photoPath = '';
        (fishData as any).photoUrl = '';
        (fishData as any).encryptedMetadata = undefined;
      }
      // If the photo was cleared by the user, ensure storage references are removed
      if (!formData.photo) {
        (fishData as any).photoPath = '';
        (fishData as any).photoUrl = '';
        (fishData as any).encryptedMetadata = undefined;
      }

      let savedData: FishCaught;
      if (isEditing && fishId) {
        const payload: any = { id: fishId, ...fishData };
        if (!user) {
          payload.guestSessionId = getOrCreateGuestSessionId();
        }
        await db.updateFishCaught(payload);
        savedData = { id: fishId, ...payload };
      } else {
        const payload: any = { ...fishData };
        if (!user) {
          payload.guestSessionId = getOrCreateGuestSessionId();
        }
        const newId = await db.createFishCaught(payload);
        savedData = { id: newId.toString(), ...payload };
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
    if (!file) return;

    // Clean up previous preview URL to prevent memory leaks
    if (photoPreview && photoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(photoPreview);
    }

    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB.');
      return;
    }

    // Create preview URL for selected file immediately
    const previewUrl = URL.createObjectURL(file);
    setPhotoPreview(previewUrl);
    setUploadError(null);
    setError(null);

    // If not authenticated: persist as data URL (local-only) and keep preview
    if (!user) {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          handleInputChange("photo", dataUrl);
          handleInputChange("photoPath", "");
          setPhotoPreview(dataUrl);
          if (previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
          }
        };
        reader.onerror = () => {
          // Clean up the preview URL on error
          if (previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl);
          }
          setUploadError('Failed to process photo. Please try again.');
        };
        reader.readAsDataURL(file);
      } catch (e) {
        // Clean up the preview URL on error
        if (previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
        setUploadError('Failed to process photo. Please try again.');
      }
      return;
    }

    // For authenticated users: read the file as a data URL and let the data service
    // handle encryption and moving the inline data to storage. This centralizes
    // encryption behavior under firebaseDataService.ensurePhotoInStorage and keeps
    // handling consistent across create/update flows.
    setIsUploadingPhoto(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;

        // Pass the data URL to the form state; firebaseDataService will handle
        // moving this inline photo to storage and setting photoPath/photoUrl and
        // encryptedMetadata accordingly when the record is saved.
        handleInputChange("photo", dataUrl);

        // Clear any existing storage-backed fields when replacing a photo
        handleInputChange("photoPath", "");
        // Keep UI preview as the local data URL for instant feedback
        setPhotoPreview(dataUrl);

        // Revoke the temporary blob preview URL if created
        if (previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
      };
      reader.onerror = () => {
        // Clean up the preview URL on error
        if (previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl);
        }
        setUploadError('Failed to process photo. Please try again.');
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Photo processing failed:', err);
      // Clean up the preview URL on error
      if (previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setUploadError('Failed to process photo. Please try again.');
    } finally {
      setIsUploadingPhoto(false);
    }
  }, [user, fishId, handleInputChange, photoPreview]);

  // Filter and group gear items
  const filteredAndGroupedGear = React.useMemo(() => {
    let filtered = tackleBox;

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = tackleBox.filter(item =>
        item.name.toLowerCase().includes(search) ||
        item.brand.toLowerCase().includes(search) ||
        item.type.toLowerCase().includes(search)
      );
    }

    // Group by type
    const grouped = filtered.reduce((acc, item) => {
      const type = item.type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(item);
      return acc;
    }, {} as Record<string, typeof tackleBox>);

    return grouped;
  }, [tackleBox, searchTerm]);

  const toggleTypeExpansion = (type: string) => {
    const newExpanded = new Set(expandedTypes);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedTypes(newExpanded);
  };

  const selectAllInType = (type: string) => {
    const typeItems = filteredAndGroupedGear[type] || [];
    const typeItemNames = typeItems.map(item => item.name);
    const newSelection = [...new Set([...formData.gear, ...typeItemNames])];
    handleInputChange("gear", newSelection);
  };

  const clearAllInType = (type: string) => {
    const typeItems = filteredAndGroupedGear[type] || [];
    const typeItemNames = typeItems.map(item => item.name);
    const newSelection = formData.gear.filter(gear => !typeItemNames.includes(gear));
    handleInputChange("gear", newSelection);
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

              {/* Search Input */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search gear items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{
                    backgroundColor: 'var(--input-background)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--primary-text)'
                  }}
                />
              </div>

              {tackleBox.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Object.entries(filteredAndGroupedGear).map(([type, items]) => {
                    const isExpanded = expandedTypes.has(type);
                    const selectedCount = items.filter(item => formData.gear.includes(item.name)).length;
                    const totalCount = items.length;

                    return (
                      <div key={type} className="border rounded-lg" style={{ borderColor: 'var(--border-color)' }}>
                        {/* Type Header */}
                        <div
                          className="flex items-center justify-between p-3 cursor-pointer hover:opacity-80 transition-all"
                          style={{ backgroundColor: 'var(--secondary-background)' }}
                          onClick={() => toggleTypeExpansion(type)}
                        >
                          <div className="flex items-center">
                            <i className={`fas fa-chevron-${isExpanded ? 'down' : 'right'} mr-2`} style={{ color: 'var(--secondary-text)' }}></i>
                            <div>
                              <div className="font-medium" style={{ color: 'var(--primary-text)' }}>
                                {type}s ({totalCount} item{totalCount !== 1 ? 's' : ''})
                              </div>
                              {selectedCount > 0 && (
                                <div className="text-xs" style={{ color: 'var(--secondary-text)' }}>
                                  {selectedCount} selected
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex space-x-1">
                            {selectedCount > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  clearAllInType(type);
                                }}
                                className="px-2 py-1 text-xs rounded"
                                style={{ backgroundColor: 'var(--error-background)', color: 'var(--error-text)' }}
                              >
                                Clear All
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectAllInType(type);
                              }}
                              className="px-2 py-1 text-xs rounded"
                              style={{ backgroundColor: 'var(--button-primary)', color: 'white' }}
                            >
                              Select All
                            </button>
                          </div>
                        </div>

                        {/* Type Items */}
                        {isExpanded && (
                          <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                            {items.map(item => (
                              <label
                                key={item.id}
                                className="flex items-center p-2 rounded hover:opacity-80 cursor-pointer transition-all"
                                style={{
                                  backgroundColor: formData.gear.includes(item.name) ? 'var(--button-primary)' : 'var(--input-background)',
                                  border: formData.gear.includes(item.name) ? '1px solid var(--button-primary)' : '1px solid transparent'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.gear.includes(item.name)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      handleInputChange("gear", [...formData.gear, item.name]);
                                    } else {
                                      handleInputChange("gear", formData.gear.filter(gear => gear !== item.name));
                                    }
                                  }}
                                  className="mr-3 w-4 h-4 text-white bg-transparent border-2 rounded focus:ring-0"
                                  style={{
                                    borderColor: formData.gear.includes(item.name) ? 'white' : 'var(--border-color)',
                                    backgroundColor: formData.gear.includes(item.name) ? 'var(--button-primary)' : 'transparent'
                                  }}
                                />
                                <div className="flex-1">
                                  <div className="text-sm font-medium" style={{ color: formData.gear.includes(item.name) ? 'white' : 'var(--primary-text)' }}>
                                    {item.name}
                                  </div>
                                  <div className="text-xs" style={{ color: formData.gear.includes(item.name) ? 'rgba(255,255,255,0.8)' : 'var(--secondary-text)' }}>
                                    {item.brand}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6 border rounded-md" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--secondary-background)' }}>
                  <i className="fas fa-toolbox text-2xl mb-2" style={{ color: 'var(--secondary-text)' }}></i>
                  <p style={{ color: 'var(--secondary-text)' }}>No gear available</p>
                  <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>Add gear items to your tackle box first</p>
                </div>
              )}

              {/* Selected Gear Summary */}
              {formData.gear.length > 0 && (
                <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary-background)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium" style={{ color: 'var(--secondary-text)' }}>
                      Selected Gear ({formData.gear.length} item{formData.gear.length !== 1 ? 's' : ''}):
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => handleInputChange("gear", [])}
                    >
                      Clear All
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {formData.gear.map((gearItem, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs"
                        style={{ backgroundColor: 'var(--chip-background)', color: 'var(--chip-text)' }}
                      >
                        {gearItem}
                        <button
                          type="button"
                          onClick={() => handleInputChange("gear", formData.gear.filter((_, i) => i !== index))}
                          className="ml-1"
                          style={{ color: 'var(--chip-text)' }}
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Photo Section */}
            <div>
              <label className="form-label">
                Photo (Optional)
              </label>
              {isEditing && formData.photo && !photoPreview && (
                <div className="mt-2">
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--secondary-text)' }}>Current Photo</div>
                  <div className="relative inline-block">
                    <img src={formData.photo} alt="Current catch" className="w-32 h-32 object-cover rounded" style={{ border: '1px solid var(--border-color)' }} />
                    {!user && (formData.photoPath || formData.encryptedMetadata) && (
                      <div className="absolute inset-0 flex items-center justify-center rounded"
                           style={{ backgroundColor: 'rgba(17,24,39,0.6)', color: 'white', border: '1px solid var(--border-color)' }}>
                        <span className="text-[10px] font-medium">🔒 Sign in</span>
                      </div>
                    )}
                    {(user || !formData.photoPath) && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (user && formData.photoPath) {
                          try {
                            const storageRef = ref(storage, formData.photoPath);
                            await deleteObject(storageRef);
                          } catch (err) {
                            console.warn('Failed to delete photo from storage:', err);
                          }
                        }
                        handleInputChange("photo", "");
                        handleInputChange("photoPath", "");
                        setPhotoPreview(null);
                        setUploadError(null);
                      }}
                      className="absolute top-2 right-2 btn btn-danger px-2 py-1 text-xs"
                    >
                      Delete Photo
                    </button>)}
                  </div>
                </div>
              )}

              {/* Photo Preview for newly selected or decrypted photos */}
              <div className="mt-2">
                {(isPhotoLoading || isUploadingPhoto || uploadError || photoPreview) && (
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--secondary-text)' }}>
                    {isPhotoLoading || isUploadingPhoto ? 'Loading Photo...' : uploadError ? 'Upload Failed' : photoPreview ? 'Selected Photo' : ''}
                  </div>
                )}
                <div className="relative inline-block">
                  {isPhotoLoading ? (
                    <div className="flex items-center justify-center w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                  ) : photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Selected catch"
                      className={`w-32 h-32 object-cover rounded ${uploadError ? 'opacity-50' : ''}`}
                      style={{ border: `1px solid ${uploadError ? 'var(--error-border)' : 'var(--border-color)'}` }}
                    />
                  ) : null}
                  {!user && (formData.photoPath || formData.encryptedMetadata) && (
                    <div className="absolute inset-0 flex items-center justify-center rounded"
                         style={{ backgroundColor: 'rgba(17,24,39,0.6)', color: 'white', border: '1px solid var(--border-color)' }}>
                      <span className="text-[10px] font-medium">🔒 Sign in</span>
                    </div>
                  )}
                  {photoPreview && !isPhotoLoading && (
                    <button
                      type="button"
                      onClick={() => {
                        // Clean up the preview URL to prevent memory leaks
                        if (photoPreview && photoPreview.startsWith('blob:')) {
                          URL.revokeObjectURL(photoPreview);
                        }
                        setPhotoPreview(null);
                        setUploadError(null);
                        // Also clear selected photo from form state so it won't be saved
                        handleInputChange("photo", "");
                        handleInputChange("photoPath", "");
                        // Clear the file input properly
                        const fileInput = document.getElementById('photo-upload') as HTMLInputElement;
                        if (fileInput) {
                          fileInput.value = '';
                          // Force re-render to ensure file input is cleared across all browsers
                          fileInput.replaceWith(fileInput.cloneNode(true));
                        }
                      }}
                      className="absolute top-2 right-2 btn btn-danger px-2 py-1 text-xs"
                    >
                      Remove
                    </button>
                  )}
                </div>
                {uploadError && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--error-text)' }}>{uploadError}</p>
                )}
              </div>
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
    </>
  );
};

export default FishCatchModal;