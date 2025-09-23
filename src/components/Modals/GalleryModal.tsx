import React, { useState, useEffect, useMemo } from "react";
import { Modal, ModalHeader, ModalBody } from "./Modal";
import type {
  ModalProps,
  GallerySortOrder,
} from "../../types";
import { useDatabaseService } from "../../contexts/DatabaseContext";
import { useAuth } from "../../contexts/AuthContext";

interface PhotoItem {
  id: string;
  fishId: number;
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
  const db = useDatabaseService();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [sortOrder, setSortOrder] = useState<GallerySortOrder>("desc");
  const [filterMonth, setFilterMonth] = useState<number | null>(
    selectedMonth || null,
  );
  const [filterYear, setFilterYear] = useState<number | null>(
    selectedYear || null,
  );

  // Load photos when modal opens
  useEffect(() => {
    if (isOpen) {
      loadPhotos();
    }
  }, [isOpen]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSelectedPhoto(null);
      setError(null);
    }
  }, [isOpen]);

  const loadPhotos = async () => {
    if (!user) {
      setPhotos([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [trips, fishCaught] = await Promise.all([
        db.getAllTrips(),
        db.getAllFishCaught(),
      ]);

      // Create photo items from fish catches that have photos
      const photoItems: PhotoItem[] = [];

      fishCaught.forEach((fish: any) => {
        if (fish.photo) {
          const trip = trips.find((t: any) => t.id === fish.tripId);
          if (trip) {
            photoItems.push({
              id: `${fish.id}-${fish.tripId}`,
              fishId: fish.id,
              tripId: fish.tripId,
              photo: fish.photo,
              species: fish.species,
              length: fish.length,
              weight: fish.weight,
              date: trip.date,
              location: trip.location,
              water: trip.water,
              time: fish.time,
            });
          }
        }
      });

      setPhotos(photoItems);
    } catch (err) {
      console.error("Error loading photos:", err);
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
    filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === "desc" ? dateB - dateA : dateA - dateB;
    });

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
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="desc">Newest First</option>
                <option value="asc">Oldest First</option>
              </select>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              {filteredAndSortedPhotos.length} of {photos.length} photos
            </div>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">
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
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
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
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b pb-2">
                      {monthGroup.label}
                      <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                        ({monthGroup.photos.length} photo
                        {monthGroup.photos.length !== 1 ? "s" : ""})
                      </span>
                    </h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {monthGroup.photos.map((photo) => (
                        <div
                          key={photo.id}
                          onClick={() => handlePhotoClick(photo)}
                          className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden
                                   cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all duration-200
                                   group"
                        >
                          <img
                            src={photo.photo}
                            alt={`${photo.species} - ${photo.length}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                          />

                          {/* Overlay with info */}
                          <div
                            className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50
                                        transition-all duration-200 flex items-end"
                          >
                            <div className="p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <p className="text-sm font-semibold">
                                {photo.species}
                              </p>
                              <p className="text-xs">
                                {photo.length} • {photo.weight}
                              </p>
                              <p className="text-xs">
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
          className="bg-black"
        >
          <div className="relative">
            {/* Navigation buttons */}
            {filteredAndSortedPhotos.length > 1 && (
              <>
                <button
                  onClick={handlePreviousPhoto}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10
                           bg-black bg-opacity-50 text-white p-3 rounded-full
                           hover:bg-opacity-75 transition-all duration-200"
                >
                  <i className="fas fa-chevron-left"></i>
                </button>

                <button
                  onClick={handleNextPhoto}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10
                           bg-black bg-opacity-50 text-white p-3 rounded-full
                           hover:bg-opacity-75 transition-all duration-200"
                >
                  <i className="fas fa-chevron-right"></i>
                </button>
              </>
            )}

            {/* Close button */}
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 z-10
                       bg-black bg-opacity-50 text-white p-3 rounded-full
                       hover:bg-opacity-75 transition-all duration-200"
            >
              <i className="fas fa-times"></i>
            </button>

            {/* Photo */}
            <div className="flex items-center justify-center min-h-[60vh] max-h-[80vh]">
              <img
                src={selectedPhoto.photo}
                alt={`${selectedPhoto.species} - ${selectedPhoto.length}`}
                className="max-w-full max-h-full object-contain"
              />
            </div>

            {/* Photo info */}
            <div className="bg-black bg-opacity-75 text-white p-6">
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
