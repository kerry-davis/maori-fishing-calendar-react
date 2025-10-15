import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Modal, ModalHeader, ModalBody } from "./Modal";
import { useLocationContext } from "../../contexts/LocationContext";
// import { useAuth } from "../../contexts/AuthContext"; // Not currently used
import { useDatabaseService } from "../../contexts/DatabaseContext";
import {
  getLunarPhase,
  getMoonPhaseData,
  calculateBiteTimes,
  getSunMoonTimes,
} from "../../services/lunarService";
import type { BiteTime, UserLocation } from "../../types";
import { BITE_QUALITY_COLORS } from "../../types";
import { WeatherSection } from "../Weather/WeatherSection";

export interface LunarModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onTripLogOpen?: (date: Date, hasTrips: boolean) => void;
}

/**
 * LunarModal Component
 *
 * Displays detailed lunar phase information for a selected date including:
 * - Lunar phase details and moon age/illumination
 * - Day navigation (previous/next day)
 * - Bite times with location-based calculations
 * - Weather forecast integration
 * - Sun and moon rise/set times
 * - Trip log access button
 */
export const LunarModal: React.FC<LunarModalProps> = ({
  isOpen,
  onClose,
  selectedDate,
  onTripLogOpen,
}) => {
  // const { user } = useAuth(); // Not currently used
  const {
    userLocation,
    setLocation,
    requestLocation,
    searchLocation,
    searchLocationSuggestions,
  } = useLocationContext();
  const db = useDatabaseService();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [locationInput, setLocationInput] = useState("");
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<
    UserLocation[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [hasTripsForDate, setHasTripsForDate] = useState<boolean>(false);

  // Touch/swipe handling for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Debounced search timeout ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update current date when modal opens or selectedDate changes
  useEffect(() => {
    if (isOpen && selectedDate) {
      setCurrentDate(new Date(selectedDate));
    }
  }, [isOpen, selectedDate]);

  // Check for trips when date changes
  useEffect(() => {
    let isMounted = true;

    const checkTripsForDate = async () => {
      try {
        // Query database service (handles both Firebase and local data)
        // This works for both authenticated users and guests
        const allTrips = await db.getAllTrips();

        // Filter trips for the current date
        const dateStr = currentDate.toLocaleDateString("en-CA");
        const hasTrips = allTrips.some((trip) => trip.date === dateStr);

        console.log(
          `Checking trips for date ${dateStr}: found ${allTrips.length} total trips`,
        );
        console.log(
          "Trip dates:",
          allTrips.map((trip) => trip.date),
        );
        console.log(`${hasTrips ? "Has" : "No"} trips for this date`);

        if (isMounted) {
          setHasTripsForDate(hasTrips);
        }
      } catch (error) {
        console.error("Error checking trips for date:", error);
        if (isMounted) {
          setHasTripsForDate(false);
        }
      }
    };

    checkTripsForDate();

    return () => {
      isMounted = false;
    };
  }, [currentDate, db]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Calculate lunar phase data for current date
  const lunarData = useMemo(() => {
    const phase = getLunarPhase(currentDate);
    const phaseData = getMoonPhaseData(currentDate);
    return {
      phase,
      phaseIndex: phaseData.phaseIndex,
      moonAge: phaseData.moonAge,
      illumination: phaseData.illumination,
    };
  }, [currentDate]);

  // Calculate bite times if location is available
  const biteTimesData = useMemo(() => {
    if (!userLocation) return null;

    try {
      return calculateBiteTimes(
        currentDate,
        userLocation.lat,
        userLocation.lon,
      );
    } catch (error) {
      console.error("Error calculating bite times:", error);
      return null;
    }
  }, [currentDate, userLocation]);

  // Calculate sun and moon times if location is available
  const sunMoonTimes = useMemo(() => {
    if (!userLocation) return null;

    try {
      return getSunMoonTimes(currentDate, userLocation);
    } catch (error) {
      console.error("Error calculating sun/moon times:", error);
      return null;
    }
  }, [currentDate, userLocation]);

  // Navigation handlers
  const handlePrevDay = useCallback(() => {
    const prevDay = new Date(currentDate);
    prevDay.setDate(prevDay.getDate() - 1);
    setCurrentDate(prevDay);
  }, [currentDate]);

  const handleNextDay = useCallback(() => {
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setCurrentDate(nextDay);
  }, [currentDate]);

  // Location handlers
  const handleLocationRequest = useCallback(async () => {
    setIsRequestingLocation(true);
    try {
      await requestLocation();
    } catch (error) {
      console.error("Location request failed:", error);
      // Error handling could be improved with user feedback
    } finally {
      setIsRequestingLocation(false);
    }
  }, [requestLocation]);

  const handleLocationSearch = useCallback(async () => {
    if (!locationInput.trim()) {
      return; // Don't search for empty input
    }

    setIsSearchingLocation(true);
    setLocationError(null); // Clear any previous errors

    try {
      await searchLocation(locationInput.trim());
      setLocationInput(""); // Clear the input after successful search
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : "Failed to search location",
      );
    } finally {
      setIsSearchingLocation(false);
    }
  }, [locationInput, searchLocation]);

  // Handle Enter key press in location input
  const handleLocationInputKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !isSearchingLocation) {
        if (showSuggestions && locationSuggestions.length > 0) {
          // Select the highlighted suggestion
          const selectedSuggestion =
            locationSuggestions[
              selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0
            ];
          handleSuggestionSelect(selectedSuggestion);
        } else {
          handleLocationSearch();
        }
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      } else if (e.key === "ArrowDown" && showSuggestions) {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev < locationSuggestions.length - 1 ? prev + 1 : 0,
        );
      } else if (e.key === "ArrowUp" && showSuggestions) {
        e.preventDefault();
        setSelectedSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : locationSuggestions.length - 1,
        );
      }
    },
    [
      handleLocationSearch,
      isSearchingLocation,
      showSuggestions,
      locationSuggestions,
      selectedSuggestionIndex,
    ],
  );

  // Handle location input change with debounced search
  const handleLocationInputChange = useCallback(
    (value: string) => {
      setLocationInput(value);

      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (value.trim().length < 2) {
        setLocationSuggestions([]);
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        setIsLoadingSuggestions(false);
        return;
      }

      // Set loading state
      setIsLoadingSuggestions(true);

      // Debounce the search by 300ms
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const suggestions = await searchLocationSuggestions(value.trim());
          setLocationSuggestions(suggestions);
          setShowSuggestions(suggestions.length > 0);
          setSelectedSuggestionIndex(-1);
        } catch (error) {
          console.error("Location suggestions error:", error);
          setLocationSuggestions([]);
          setShowSuggestions(false);
        } finally {
          setIsLoadingSuggestions(false);
        }
      }, 300);
    },
    [searchLocationSuggestions],
  );

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback(
    (suggestion: UserLocation) => {
      setLocation(suggestion);
      setLocationInput("");
      setLocationSuggestions([]);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      setLocationError(null);
    },
    [setLocation],
  );

  // Trip log handler
  const handleTripLogOpen = useCallback(() => {
    if (onTripLogOpen) {
      onTripLogOpen(currentDate, hasTripsForDate);
    }
  }, [currentDate, onTripLogOpen, hasTripsForDate]);

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

    if (isLeftSwipe) {
      // Swipe left - go to next day (forwards in time)
      handleNextDay();
    } else if (isRightSwipe) {
      // Swipe right - go to previous day (backwards in time)
      handlePrevDay();
    }
  };

  // Get moon phase icon based on phase index
  const getMoonPhaseIcon = (phaseIndex: number): string => {
    if (phaseIndex === 0 || phaseIndex === 29) return "🌑"; // New Moon
    if (phaseIndex >= 1 && phaseIndex <= 6) return "🌒"; // Waxing Crescent
    if (phaseIndex === 7) return "🌓"; // First Quarter
    if (phaseIndex >= 8 && phaseIndex <= 13) return "🌔"; // Waxing Gibbous
    if (phaseIndex === 14) return "🌕"; // Full Moon
    if (phaseIndex >= 15 && phaseIndex <= 21) return "🌖"; // Waning Gibbous
    if (phaseIndex === 22) return "🌗"; // Last Quarter
    if (phaseIndex >= 23 && phaseIndex <= 28) return "🌘"; // Waning Crescent
    return "🌙"; // Default fallback
  };

  // Format date for display
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString("en-NZ", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Get quality color class
  const getQualityColorClass = (quality: string): string => {
    switch (quality.toLowerCase()) {
      case "excellent":
        return "bg-green-500";
      case "good":
        return "bg-blue-500";
      case "average":
        return "bg-yellow-500";
      case "poor":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  // Render bite time item
  const renderBiteTime = (bite: BiteTime, index: number) => (
    <div key={index} className="bite-time-item flex items-center py-1">
      <i
        className="fas fa-fish mr-2"
        style={{ color: BITE_QUALITY_COLORS[bite.quality] }}
      ></i>
      <span className="text-sm">
        {bite.start} - {bite.end}
      </span>
    </div>
  );

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg" maxHeight="90vh">
      <ModalHeader
        title={lunarData.phase.name}
        subtitle={formatDate(currentDate)}
        onClose={onClose}
      >
        {/* Navigation buttons */}
        <button
          onClick={handlePrevDay}
          className="icon-btn"
          aria-label="Previous day"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <button
          onClick={handleNextDay}
          className="icon-btn ml-2"
          aria-label="Next day"
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </ModalHeader>

      <ModalBody className="max-h-[70vh] overflow-y-auto">
        <div
          className="lunar-modal-body"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Moon Phase Info */}
          <div className="flex items-center mb-4">
            <span className="text-4xl mr-3">{getMoonPhaseIcon(lunarData.phaseIndex)}</span>
            <div>
              <div
                className={`inline-block px-2 py-1 rounded text-white text-sm font-bold ${getQualityColorClass(lunarData.phase.quality)}`}
              >
                {lunarData.phase.quality}
              </div>
              <p className="text-sm mt-1" style={{ color: "#000000 !important" }}>
                Moon age: {lunarData.moonAge.toFixed(1)} days
              </p>
              <p className="text-sm" style={{ color: "#000000 !important" }}>
                Illumination: {Math.round(lunarData.illumination * 100)}%
              </p>
            </div>
          </div>
          <p className="text-sm mb-4" style={{ color: "#000000 !important" }}>
            {lunarData.phase.description}
          </p>
          {/* Trip Log Section */}
          <div className="border-t dark:border-gray-700 pt-4 mb-4">
            <button
              onClick={handleTripLogOpen}
              className="btn btn-primary w-full"
            >
              <i className="fas fa-book-open mr-2"></i>
              {hasTripsForDate ? "View / Manage Trip Log" : "Create Trip Log"}
            </button>
          </div>
          {/* Bite Times Section */}
          <div className="border-t dark:border-gray-700 pt-4 mb-4">
            <h4 className="form-label text-lg mb-3">
              Bite Times
            </h4>

            {/* Location Input */}
            <div className="mb-4">
              <label htmlFor="location-input" className="form-label">
                Location
              </label>
              <div className="flex items-center space-x-1">
                <div className="relative">
                  <input
                    type="text"
                    id="location-input"
                    value={locationInput}
                    onChange={(e) => handleLocationInputChange(e.target.value)}
                    onKeyDown={handleLocationInputKeyPress}
                    onFocus={() =>
                      locationInput.trim().length >= 2 &&
                      setShowSuggestions(true)
                    }
                    onBlur={() =>
                      setTimeout(() => setShowSuggestions(false), 200)
                    }
                    placeholder="Enter a location"
                    className="w-full px-3 py-2 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      backgroundColor: 'var(--input-background)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--primary-text)'
                    }}
                  />

                  {/* Location Suggestions Dropdown */}
                  {showSuggestions && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {isLoadingSuggestions ? (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          Searching locations...
                        </div>
                      ) : locationSuggestions.length > 0 ? (
                        locationSuggestions.map((suggestion, index) => (
                          <div
                            key={`${suggestion.lat}-${suggestion.lon}`}
                            onClick={() => handleSuggestionSelect(suggestion)}
                            className={`px-3 py-2 cursor-pointer text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                              index === selectedSuggestionIndex
                                ? "bg-blue-50 dark:bg-blue-900"
                                : ""
                            }`}
                          >
                            <div className="font-medium text-gray-900 dark:text-gray-100">
                              {suggestion.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {suggestion.lat.toFixed(4)},{" "}
                              {suggestion.lon.toFixed(4)}
                            </div>
                          </div>
                        ))
                      ) : locationInput.trim().length >= 2 ? (
                        <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                          No locations found
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleLocationSearch}
                  disabled={isSearchingLocation}
                  className="px-3 py-2 bg-gray-500 text-white hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Search location"
                >
                  <i
                    className={`fas ${isSearchingLocation ? "fa-spinner fa-spin" : "fa-search"}`}
                  ></i>
                </button>
                <button
                  onClick={handleLocationRequest}
                  disabled={isRequestingLocation}
                  className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  title="Use current location"
                >
                  <i
                    className={`fas ${isRequestingLocation ? "fa-spinner fa-spin" : "fa-map-marker-alt"}`}
                  ></i>
                </button>
              </div>
              {locationError && (
                <p className="text-sm text-red-500 mt-1">
                  <i className="fas fa-exclamation-triangle mr-1"></i>
                  {locationError}
                </p>
              )}
              {userLocation && (
                <p className="text-sm mt-1" style={{ color: "#000000 !important" }}>
                  {userLocation.name}
                </p>
              )}
            </div>

            {/* Bite Times Display */}
            {biteTimesData ? (
              <>
                <div className="mb-4">
                  <h5 className="form-label text-green-600 dark:text-green-400 mb-2">
                    Major Bites
                  </h5>
                  <div className="space-y-1">
                    {biteTimesData.major.length > 0 ? (
                      biteTimesData.major.map(renderBiteTime)
                    ) : (
                      <p className="text-sm" style={{ color: "#000000 !important" }}>
                        No major bite times for this day
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h5 className="form-label text-blue-600 dark:text-blue-400 mb-2">
                    Minor Bites
                  </h5>
                  <div className="space-y-1">
                    {biteTimesData.minor.length > 0 ? (
                      biteTimesData.minor.map(renderBiteTime)
                    ) : (
                      <p className="text-sm" style={{ color: "#000000 !important" }}>
                        No minor bite times for this day
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: "#000000 !important" }}>
                Set a location to see bite times
              </p>
            )}
          </div>
          <WeatherSection date={currentDate} />
          {/* Sun and Moon Times Section */}
          <div className="border-t dark:border-gray-700 pt-4 mb-4">
            <h4 className="form-label text-lg mb-3">
              Sun & Moon
            </h4>
            <div className="text-sm" style={{ color: "#000000 !important" }}>
              {sunMoonTimes ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p>Sunrise: {sunMoonTimes.sunrise}</p>
                    <p>Sunset: {sunMoonTimes.sunset}</p>
                  </div>
                  <div>
                    <p>Moonrise: {sunMoonTimes.moonrise}</p>
                    <p>Moonset: {sunMoonTimes.moonset}</p>
                  </div>
                </div>
              ) : (
                <p style={{ color: "#000000 !important" }}>Set a location to see sun and moon times</p>
              )}
            </div>{" "}
          </div>
          {/* Bite Time Quality Legend */}
          <div className="border-t dark:border-gray-700 pt-4" style={{ color: "#000000 !important" }}>
            <h5 className="form-label mb-2">
              Bite Time Quality Legend
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2" style={{ color: "#000000 !important" }}>
              <div className="flex items-center">
                <i
                  className="fas fa-fish mr-2"
                  style={{ color: BITE_QUALITY_COLORS.excellent }}
                ></i>
                <span className="text-sm" style={{ color: "#000000 !important" }}>Excellent</span>
              </div>
              <div className="flex items-center">
                <i
                  className="fas fa-fish mr-2"
                  style={{ color: BITE_QUALITY_COLORS.good }}
                ></i>
                <span className="text-sm" style={{ color: "#000000 !important" }}>Good</span>
              </div>
              <div className="flex items-center">
                <i
                  className="fas fa-fish mr-2"
                  style={{ color: BITE_QUALITY_COLORS.average }}
                ></i>
                <span className="text-sm" style={{ color: "#000000 !important" }}>Average</span>
              </div>
              <div className="flex items-center">
                <i
                  className="fas fa-fish mr-2"
                  style={{ color: BITE_QUALITY_COLORS.fair }}
                ></i>
                <span className="text-sm" style={{ color: "#000000 !important" }}>Fair</span>
              </div>
              <div className="flex items-center">
                <i
                  className="fas fa-fish mr-2"
                  style={{ color: BITE_QUALITY_COLORS.poor }}
                ></i>
                <span className="text-sm" style={{ color: "#000000 !important" }}>Poor</span>
              </div>
            </div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default LunarModal;
