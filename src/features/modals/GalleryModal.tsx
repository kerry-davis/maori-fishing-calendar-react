import React, { useState, useEffect, useMemo } from "react";
import { Modal, ModalHeader, ModalBody } from "./Modal";
import type {
   ModalProps,
   GallerySortOrder,
} from "@shared/types";
import { useDatabaseService } from '../../app/providers/DatabaseContext';
import { firebaseDataService } from "@shared/services/firebaseDataService";
import { photoMigrationService } from "@shared/services/photoMigrationService";


interface PhotoItem {
  id: string;
  fishId: string;
  tripId: number;
  photo: string;
  species: string;
  length: string;
  weight: string;
  date: string;
  location: string;
  water: string;
  time: string;
}

interface GalleryModalProps extends ModalProps {
  selectedMonth?: number;
  selectedYear?: number;
  onPhotoSelect?: (photoItem: PhotoItem) => void;
}

/**
 * GalleryModal component for displaying fish photos
 *
 * Features:
 * - Month-based photo organization
 * - Photo grid display with modal view
 * - Photo sorting and filtering
 * - Click to view full-size photos
 */
export const GalleryModal: React.FC<GalleryModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  selectedYear,
  onPhotoSelect,
}) => {
  // Remove duplicate declarations from previous patch
  const db = useDatabaseService();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [sortOrder, setSortOrder] = useState<GallerySortOrder>("desc");
  const [filterMonth, setFilterMonth] = useState<number | null>(selectedMonth || null);
  const [filterYear, setFilterYear] = useState<number | null>(selectedYear || null);
  const [migrationStatus, setMigrationStatus] = useState<{
    isRunning: boolean;
    progress: number;
    failedPhotos: string[];
  } | null>(null);
  // Touch/swipe handling for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  // Track object URLs for cleanup
  const objectUrlsRef = React.useRef<string[]>([]);

  // Cleanup object URLs on unmount only
  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  // Load photos when modal opens
  useEffect(() => {
    if (isOpen) {
      loadPhotos();
    } else {
      setSelectedPhoto(null);
      setError(null);
    }
  }, [isOpen]);

  // Monitor photo migration status
  useEffect(() => {
    const updateMigrationStatus = () => {
      const progress = photoMigrationService.getProgress();
      if (progress.totalPhotos > 0) {
        setMigrationStatus({
          isRunning: photoMigrationService.isMigrationRunning(),
          progress: progress.totalPhotos > 0 ? (progress.processedPhotos / progress.totalPhotos) * 100 : 0,
          failedPhotos: progress.failedPhotos
        });
      } else {
        setMigrationStatus(null);
      }
    };

    // Initial check
    updateMigrationStatus();

    // Poll for updates every 3 seconds
    const interval = setInterval(updateMigrationStatus, 3000);

    return () => clearInterval(interval);
  }, [isOpen]);

 const loadPhotos = async () => {
  setLoading(true);
  setError(null);
  try {
    const [trips, fishCaught] = await Promise.all([
      db.getAllTrips(),
      db.getAllFishCaught(),
    ]);
    // Create photo items from fish catches that have photos
    const photoItems: PhotoItem[] = [];
  // Do not revoke object URLs here; cleanup is handled on unmount only

    for (const fish of fishCaught) {
      // Detect encrypted photo: must have encryptedMetadata and enc_photos path
      const isEncrypted = Boolean(fish.encryptedMetadata && typeof fish.photoPath === 'string' && fish.photoPath.includes('enc_photos'));
      const rawPhoto: string | undefined = fish.photoUrl || fish.photo;
      let displayPhoto: string | undefined = fixPhotoData(rawPhoto || '');
      if (isEncrypted && typeof fish.photoPath === 'string') {
        try {
          const decryptedData = await firebaseDataService.getDecryptedPhoto(
            fish.photoPath,
            fish.encryptedMetadata
          );
          if (decryptedData) {
            const blob = new Blob([decryptedData.data], { type: decryptedData.mimeType });
            const objectUrl = URL.createObjectURL(blob);
            objectUrlsRef.current.push(objectUrl);
            displayPhoto = objectUrl;
          } else {
            displayPhoto = undefined;
          }
        } catch (decryptError) {
          console.warn('Failed to decrypt photo for display:', decryptError);
          displayPhoto = undefined;
        }
      }
      // Only add if trip found AND displayPhoto is usable
      const trip = trips.find((t: any) => t.id === fish.tripId);
      if (trip && displayPhoto) {
        const photoItem = {
          id: `${fish.id}-${fish.tripId}`,
          fishId: fish.id,
          tripId: fish.tripId,
          photo: displayPhoto,
          species: fish.species,
          length: fish.length,
          weight: fish.weight,
          date: trip.date,
          location: trip.location,
          water: trip.water,
          time: fish.time,
        };
        photoItems.push(photoItem);
      }
    }
    setPhotos(photoItems);
  } catch (err) {
    setError("Failed to load photos");
  } finally {
    setLoading(false);
  }
};

  // Filter and sort photos
  const filteredAndSortedPhotos = useMemo(() => {
    let filtered = [...photos];

    // Filter by month and year if specified
    if (filterMonth !== null || filterYear !== null) {
      filtered = filtered.filter((photo) => {
        const photoDate = new Date(photo.date);
        const photoMonth = photoDate.getMonth();
        const photoYear = photoDate.getFullYear();

        if (filterMonth !== null && photoMonth !== filterMonth) {
          return false;
        }
        if (filterYear !== null && photoYear !== filterYear) {
          return false;
        }
        return true;
      });
    }

    // Sort by date
    if (filtered.length > 0) {
      filtered.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
      });
    }

    return filtered;
  }, [photos, filterMonth, filterYear, sortOrder]);

  // Group photos by month for organization
  const photosByMonth = useMemo(() => {
    const groups: Record<string, PhotoItem[]> = {};

    filteredAndSortedPhotos.forEach((photo) => {
      const date = new Date(photo.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;

      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(photo);
    });

    // Convert to array and sort by date
    return Object.entries(groups)
      .map(([key, photos]) => ({
        key,
        label: new Date(photos[0].date).toLocaleDateString("en-NZ", {
          year: "numeric",
          month: "long",
        }),
        photos,
        date: new Date(photos[0].date),
      }))
      .sort((a, b) => {
        return sortOrder === "desc"
          ? b.date.getTime() - a.date.getTime()
          : a.date.getTime() - b.date.getTime();
      });
  }, [filteredAndSortedPhotos, sortOrder]);

  const handlePhotoClick = (photo: PhotoItem) => {
    setSelectedPhoto(photo);
    if (onPhotoSelect) {
      onPhotoSelect(photo);
    }
  };

  const handlePreviousPhoto = () => {
    if (!selectedPhoto) return;

    const currentIndex = filteredAndSortedPhotos.findIndex(
      (p) => p.id === selectedPhoto.id,
    );
    const previousIndex =
      currentIndex > 0 ? currentIndex - 1 : filteredAndSortedPhotos.length - 1;
    setSelectedPhoto(filteredAndSortedPhotos[previousIndex]);
  };

  const handleNextPhoto = () => {
    if (!selectedPhoto) return;

    const currentIndex = filteredAndSortedPhotos.findIndex(
      (p) => p.id === selectedPhoto.id,
    );
    const nextIndex =
      currentIndex < filteredAndSortedPhotos.length - 1 ? currentIndex + 1 : 0;
    setSelectedPhoto(filteredAndSortedPhotos[nextIndex]);
  };

  // Touch handlers for swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && filteredAndSortedPhotos.length > 1) {
      // Swipe left - go to next photo (forwards)
      handleNextPhoto();
    } else if (isRightSwipe && filteredAndSortedPhotos.length > 1) {
      // Swipe right - go to previous photo (backwards)
      handlePreviousPhoto();
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-NZ", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };



  // Simplified photo data handling
  const fixPhotoData = (photoData: string): string | undefined => {
    // Handle null, undefined, or empty data
    if (!photoData || typeof photoData !== 'string' || photoData.trim() === '') {
      return undefined;
    }

    // If it's already a valid data URL, return as-is
    if (photoData.startsWith('data:image/')) {
      return photoData;
    }

    // If it's an HTTP/HTTPS URL, return as-is
    if (photoData.startsWith('http://') || photoData.startsWith('https://')) {
      return photoData;
    }

    // If it's a Firebase storage URL, return as-is
    if (photoData.startsWith('gs://')) {
      return photoData;
    }

    // Handle base64 data without data URL prefix
    if (!photoData.startsWith('data:')) {
      const cleanData = photoData.trim();

      // Basic base64 validation
      const base64Pattern = /^[A-Za-z0-9+/=]+$/;
      const isValidBase64 = base64Pattern.test(cleanData) && cleanData.length > 100;

      if (isValidBase64) {
        // Try to detect image format from the base64 data
        try {
          // Decode first few characters to detect format
          const header = cleanData.substring(0, 50);

          // Check for common image format signatures
          if (header.includes('iVBORw0KGgo') || header.includes('R0lGOD')) {
            return `data:image/png;base64,${cleanData}`;
          } else if (header.includes('JVBERi0') || header.includes('UEsDB')) {
            return `data:image/jpeg;base64,${cleanData}`;
          } else if (header.includes('UklGR') || header.includes('RIFF')) {
            return `data:image/webp;base64,${cleanData}`;
          } else if (header.includes('PHN2Zy')) {
            // Already an SVG
            return `data:image/svg+xml;base64,${cleanData}`;
          } else {
            // Default to JPEG for most cases - this is usually the safest bet
            return `data:image/jpeg;base64,${cleanData}`;
          }
        } catch (error) {
          console.warn('Error processing image data:', error);
          return undefined;
        }
      }
    }

    // Fallback for any other cases
    return undefined;
  };

  const createPlaceholderSVG = (text: string): string => {
    const svg = `<svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#f3f4f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#e5e7eb;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad1)"/>
      <circle cx="150" cy="120" r="30" fill="#d1d5db" opacity="0.6"/>
      <path d="M140 110 L160 110 L155 125 Z" fill="#d1d5db" opacity="0.6"/>
      <text x="50%" y="180" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="500" fill="#6b7280" text-anchor="middle" dy=".3em">${text}</text>
      <text x="50%" y="200" font-family="system-ui, -apple-system, sans-serif" font-size="12" fill="#9ca3af" text-anchor="middle" dy=".3em">Tap to view details</text>
    </svg>`;
    return `data:image/svg+xml;base64,${btoa(svg)}`;
  };

  const getAvailableMonths = () => {
    const months = new Set<string>();
    photos.forEach((photo) => {
      const date = new Date(photo.date);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      months.add(monthKey);
    });

    return Array.from(months)
      .map((key) => {
        const [year, month] = key.split("-").map(Number);
        return {
          key,
          label: new Date(year, month).toLocaleDateString("en-NZ", {
            year: "numeric",
            month: "long",
          }),
          year,
          month,
        };
      })
      .sort((a, b) => b.year - a.year || b.month - a.month);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} maxWidth="3xl">
        <ModalHeader
          title="Photo Gallery"
          subtitle={`${filteredAndSortedPhotos.length} photo${filteredAndSortedPhotos.length !== 1 ? "s" : ""}`}
          onClose={onClose}
        />

        {/* Photo Migration Status Banner */}
        {migrationStatus && migrationStatus.isRunning && (
          <div className="mx-6 mb-4 p-3 rounded-lg" style={{ backgroundColor: 'var(--secondary-background)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  <span className="text-sm font-medium" style={{ color: 'var(--primary-text)' }}>
                    Encrypting Photos
                  </span>
                </div>
                <div className="text-xs" style={{ color: 'var(--secondary-text)' }}>
                  {Math.round(migrationStatus.progress)}% complete
                </div>
              </div>
              <div className="text-xs" style={{ color: 'var(--secondary-text)' }}>
                {migrationStatus.failedPhotos.length > 0 && (
                  <span className="text-red-500">
                    {migrationStatus.failedPhotos.length} failed
                  </span>
                )}
              </div>
            </div>
            <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${migrationStatus.progress}%` }}
              ></div>
            </div>
          </div>
        )}

        <ModalBody className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b dark:border-gray-700">
            <div className="flex items-center space-x-4">
              {/* Month Filter */}
              <select
                value={
                  filterMonth !== null && filterYear !== null
                    ? `${filterYear}-${filterMonth}`
                    : ""
                }
                onChange={(e) => {
                  if (e.target.value) {
                    const [year, month] = e.target.value.split("-").map(Number);
                    setFilterYear(year);
                    setFilterMonth(month);
                  } else {
                    setFilterYear(null);
                    setFilterMonth(null);
                  }
                }}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ 
                  backgroundColor: 'var(--input-background)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--primary-text)'
                }}
              >
                <option value="">All Months</option>
                {getAvailableMonths().map((month) => (
                  <option key={month.key} value={month.key}>
                    {month.label}
                  </option>
                ))}
              </select>

              {/* Sort Order */}
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as GallerySortOrder)
                }
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ 
                  backgroundColor: 'var(--input-background)',
                  borderColor: 'var(--input-border)',
                  color: 'var(--primary-text)'
                }}
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>

            <div className="text-sm" style={{ color: 'var(--secondary-text)' }}>
              {filteredAndSortedPhotos.length} of {photos.length} photos
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3" style={{ color: 'var(--secondary-text)' }}>
                Loading photos...
              </span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-center">
                <i className="fas fa-exclamation-triangle text-red-500 mr-3"></i>
                <span className="text-red-700 dark:text-red-400">{error}</span>
              </div>
            </div>
          )}


          {/* Photo Gallery */}
          {!loading && !error && (
            <div className="space-y-6">
              {filteredAndSortedPhotos.length === 0 ? (
                <div className="text-center py-12" style={{ color: 'var(--secondary-text)' }}>
                  <i className="fas fa-camera text-4xl mb-4 opacity-50"></i>
                  <p>No photos found</p>
                  <p className="text-sm mt-2">
                    {filterMonth !== null || filterYear !== null
                      ? "Try selecting a different month or clear the filter"
                      : "Add photos to your fish catches to see them here"}
                  </p>
                </div>
              ) : (
                photosByMonth.map((monthGroup) => (
                  <div key={monthGroup.key} className="space-y-3">
                    <h3 className="text-lg font-semibold border-b pb-2" style={{ color: 'var(--primary-text)', borderColor: 'var(--border-color)' }}>
                      {monthGroup.label}
                      <span className="text-sm font-normal ml-2" style={{ color: 'var(--secondary-text)' }}>
                        ({monthGroup.photos.length} photo
                        {monthGroup.photos.length !== 1 ? "s" : ""})
                      </span>
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {monthGroup.photos.map((photo) => (
                        <div
                          key={photo.id}
                          onClick={() => handlePhotoClick(photo)}
                          className="relative aspect-square rounded-lg overflow-hidden
                                   cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all duration-200
                                   group"
                        >
                          {/* Image */}
                          <img
                            src={photo.photo}
                            alt={`${photo.species} - ${photo.length}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            decoding="async"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              const originalSrc = target.src;

                              // If it's not already a placeholder, try to fix the image data
                              if (!originalSrc.includes('data:image/svg+xml')) {
                                console.warn('Image failed to load, attempting to fix:', originalSrc.substring(0, 50) + '...');

                                // Try to reprocess the image data
                                const fixedSrc = fixPhotoData(originalSrc);
                                if (fixedSrc && fixedSrc !== originalSrc && !fixedSrc.includes('data:image/svg+xml')) {
                                  target.src = fixedSrc;
                                } else {
                                  // Use placeholder as final fallback
                                  target.src = createPlaceholderSVG('Image not available');
                                }
                              }
                            }}
                          />

                          {/* Overlay with info */}
                          <div className="absolute inset-0 bg-gray-700/0 group-hover:bg-gray-700/70
                                       transition-all duration-200 flex items-end pointer-events-none z-10">
                            <div className="p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 w-full">
                              <p className="text-sm font-semibold truncate">
                                {photo.species}
                              </p>
                              <p className="text-xs truncate">
                                {photo.length} • {photo.weight}
                              </p>
                              <p className="text-xs truncate">
                                {formatDate(photo.date)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </ModalBody>
      </Modal>

      {/* Full-size Photo Modal */}
      {selectedPhoto && (
        <Modal
           isOpen={true}
           onClose={() => setSelectedPhoto(null)}
           maxWidth="3xl"
         >
          <div className="relative">
            {/* Navigation buttons */}
            {filteredAndSortedPhotos.length > 1 && (
              <>
                <button
                  onClick={handlePreviousPhoto}
                  className="icon-btn absolute left-4 top-1/2 transform -translate-y-1/2 z-10"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>

                <button
                  onClick={handleNextPhoto}
                  className="icon-btn absolute right-4 top-1/2 transform -translate-y-1/2 z-10"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </>
            )}

            {/* Close button */}
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10
                       bg-gray-600 bg-opacity-70 text-white p-3 rounded-full
                       hover:bg-opacity-90 transition-all duration-200"
            >
              <i className="fas fa-times"></i>
            </button>

            {/* Photo */}
            <div
              className="flex items-center justify-center min-h-[60vh] max-h-[80vh] bg-gray-50 dark:bg-gray-600"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={selectedPhoto.photo}
                alt={`${selectedPhoto.species} - ${selectedPhoto.length}`}
                className="max-w-full max-h-full object-contain bg-white dark:bg-gray-700 rounded-lg shadow-lg"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  const originalSrc = target.src;

                  // If it's not already a placeholder, try to fix the image data
                  if (!originalSrc.includes('data:image/svg+xml')) {
                    console.warn('Full-size image failed to load, attempting to fix:', originalSrc.substring(0, 50) + '...');

                    // Try to reprocess the image data
                    const fixedSrc = fixPhotoData(originalSrc);
                    if (fixedSrc && fixedSrc !== originalSrc && !fixedSrc.includes('data:image/svg+xml')) {
                      target.src = fixedSrc;
                    } else {
                      // Use placeholder as final fallback
                      target.src = createPlaceholderSVG('Image not available');
                    }
                  }
                }}
              />
            </div>

            {/* Photo info */}
            <div className="bg-gray-800 dark:bg-gray-900 text-white p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xl font-bold mb-2">
                    {selectedPhoto.species}
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-gray-300">Length:</span>{" "}
                      {selectedPhoto.length}
                    </p>
                    <p>
                      <span className="text-gray-300">Weight:</span>{" "}
                      {selectedPhoto.weight}
                    </p>
                    <p>
                      <span className="text-gray-300">Time:</span>{" "}
                      {selectedPhoto.time}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-gray-300">Date:</span>{" "}
                      {formatDate(selectedPhoto.date)}
                    </p>
                    <p>
                      <span className="text-gray-300">Location:</span>{" "}
                      {selectedPhoto.location}
                    </p>
                    <p>
                      <span className="text-gray-300">Water:</span>{" "}
                      {selectedPhoto.water}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

export default GalleryModal;
