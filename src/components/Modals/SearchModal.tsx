import React, { useState, useEffect, useMemo } from "react";
import { Modal, ModalHeader, ModalBody } from "./Modal";
import type { Trip, FishCaught, ModalProps } from "../../types";
import { databaseService } from "../../services/databaseService";

interface SearchResult {
  type: "trip" | "fish";
  id: number;
  title: string;
  subtitle: string;
  date: string;
  content: string;
  matchedText?: string;
}

interface SearchModalProps extends ModalProps {
  onTripSelect?: (tripId: number) => void;
  onFishSelect?: (fishId: number, tripId: number) => void;
}

/**
 * SearchModal component for searching trip logs and fish catches
 *
 * Features:
 * - Real-time search filtering
 * - Search across trips and fish catches
 * - Highlighted search results
 * - Click to navigate to specific records
 */
export const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  onTripSelect,
  onFishSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [fishCaught, setFishCaught] = useState<FishCaught[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Clear search when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setError(null);
    }
  }, [isOpen]);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [tripsData, fishData] = await Promise.all([
        databaseService.getAllTrips(),
        databaseService.getAllFishCaught(),
      ]);

      setTrips(tripsData);
      setFishCaught(fishData);
    } catch (err) {
      console.error("Error loading search data:", err);
      setError("Failed to load data for search");
    } finally {
      setLoading(false);
    }
  };

  // Filter and format search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search trips
    trips.forEach((trip) => {
      const searchableContent = [
        trip.water,
        trip.location,
        trip.companions,
        trip.notes,
      ]
        .join(" ")
        .toLowerCase();

      if (searchableContent.includes(query)) {
        // Find the matched text for highlighting
        let matchedText = "";
        const fields = [
          { label: "Water", value: trip.water },
          { label: "Location", value: trip.location },
          { label: "Companions", value: trip.companions },
          { label: "Notes", value: trip.notes },
        ];

        for (const field of fields) {
          if (field.value.toLowerCase().includes(query)) {
            matchedText = field.value;
            break;
          }
        }

        results.push({
          type: "trip",
          id: trip.id,
          title: `${trip.water} - ${trip.location}`,
          subtitle: `${trip.hours} hours${trip.companions ? ` with ${trip.companions}` : ""}`,
          date: trip.date,
          content: trip.notes || "No notes",
          matchedText,
        });
      }
    });

    // Search fish catches
    fishCaught.forEach((fish) => {
      const searchableContent = [
        fish.species,
        fish.details,
        fish.gear.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      if (searchableContent.includes(query)) {
        // Find the trip for this fish
        const trip = trips.find((t) => t.id === fish.tripId);

        // Find the matched text for highlighting
        let matchedText = "";
        const fields = [
          { label: "Species", value: fish.species },
          { label: "Details", value: fish.details },
          { label: "Gear", value: fish.gear.join(", ") },
        ];

        for (const field of fields) {
          if (field.value.toLowerCase().includes(query)) {
            matchedText = field.value;
            break;
          }
        }

        results.push({
          type: "fish",
          id: fish.id,
          title: `${fish.species} - ${fish.length || "Unknown length"}`,
          subtitle: `${fish.weight || "Unknown weight"} at ${fish.time}`,
          date: trip?.date || "Unknown date",
          content: fish.details || "No details",
          matchedText,
        });
      }
    });

    // Sort results by date (newest first)
    return results.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [searchQuery, trips, fishCaught]);

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    );
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark
          key={index}
          className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === "trip" && onTripSelect) {
      onTripSelect(result.id);
    } else if (result.type === "fish" && onFishSelect) {
      const fish = fishCaught.find((f) => f.id === result.id);
      if (fish) {
        onFishSelect(result.id, fish.tripId);
      }
    }
    onClose();
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        title="Search Trips & Catches"
        subtitle="Search through your trip logs and fish catches"
        onClose={onClose}
      />

      <ModalBody className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fas fa-search text-gray-400"></i>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search trips, locations, species, notes..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     placeholder-gray-500 dark:placeholder-gray-400"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">
              Loading...
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

        {/* Search Results */}
        {!loading && !error && (
          <div className="space-y-2">
            {searchQuery.trim() === "" ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <i className="fas fa-search text-4xl mb-4 opacity-50"></i>
                <p>Enter a search term to find trips and catches</p>
                <p className="text-sm mt-2">
                  Search by location, species, companions, notes, or gear
                </p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <i className="fas fa-search text-4xl mb-4 opacity-50"></i>
                <p>No results found for "{searchQuery}"</p>
                <p className="text-sm mt-2">
                  Try different keywords or check your spelling
                </p>
              </div>
            ) : (
              <>
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Found {searchResults.length} result
                  {searchResults.length !== 1 ? "s" : ""}
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2">
                  {searchResults.map((result, index) => (
                    <div
                      key={`${result.type}-${result.id}-${index}`}
                      onClick={() => handleResultClick(result)}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg
                               hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer
                               transition-colors duration-200"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <i
                              className={`fas ${result.type === "trip" ? "fa-map-marker-alt" : "fa-fish"}
                                         text-blue-500 text-sm`}
                            ></i>
                            <span
                              className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900
                                           text-blue-800 dark:text-blue-200 font-medium"
                            >
                              {result.type === "trip" ? "Trip" : "Fish"}
                            </span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(result.date)}
                            </span>
                          </div>

                          <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                            {highlightText(result.title, searchQuery)}
                          </h4>

                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {highlightText(result.subtitle, searchQuery)}
                          </p>

                          {result.content && (
                            <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                              {highlightText(result.content, searchQuery)}
                            </p>
                          )}
                        </div>

                        <div className="ml-4 flex-shrink-0">
                          <i className="fas fa-chevron-right text-gray-400"></i>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
};

export default SearchModal;
