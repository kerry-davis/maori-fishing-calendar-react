import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Modal, ModalHeader, ModalBody } from "./Modal";
import { useLocationContext } from "../../contexts/LocationContext";
import {
  getLunarPhase,
  getMoonPhaseData,
  calculateBiteTimes,
  getSunMoonTimes,
} from "../../services/lunarService";
import {
  fetchWeatherForLocation,
  getWeatherErrorMessage,
  formatTemperatureRange,
  formatWindInfo,
  isWeatherAvailable,
  type WeatherData,
} from "../../services/weatherService";
import type {
  BiteTime,
  UserLocation,
} from "../../types";
import { BITE_QUALITY_COLORS } from "../../types";

export interface LunarModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onTripLogOpen?: (date: Date) => void;
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
  const { userLocation, setLocation, requestLocation, searchLocation, searchLocationSuggestions } = useLocationContext();
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<UserLocation[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Debounced search timeout ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update current date when modal opens or selectedDate changes
  useEffect(() => {
    if (isOpen && selectedDate) {
      setCurrentDate(new Date(selectedDate));
    }
  }, [isOpen, selectedDate]);

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

  // Fetch weather data when date or location changes
  useEffect(() => {
    if (!userLocation || !isWeatherAvailable(currentDate)) {
      setWeatherData(null);
      setWeatherError(null);
      return;
    }

    const fetchWeather = async () => {
      setWeatherLoading(true);
      setWeatherError(null);

      try {
        const weather = await fetchWeatherForLocation(
          userLocation,
          currentDate,
        );
        setWeatherData(weather);
      } catch (error: any) {
        console.error("Weather fetch error:", error);
        setWeatherError(getWeatherErrorMessage(error));
        setWeatherData(null);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
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
  const handleLocationInputKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isSearchingLocation) {
      if (showSuggestions && locationSuggestions.length > 0) {
        // Select the highlighted suggestion
        const selectedSuggestion = locationSuggestions[selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0];
        handleSuggestionSelect(selectedSuggestion);
      } else {
        handleLocationSearch();
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    } else if (e.key === 'ArrowDown' && showSuggestions) {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev < locationSuggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp' && showSuggestions) {
      e.preventDefault();
      setSelectedSuggestionIndex(prev =>
        prev > 0 ? prev - 1 : locationSuggestions.length - 1
      );
    }
  }, [handleLocationSearch, isSearchingLocation, showSuggestions, locationSuggestions, selectedSuggestionIndex]);

  // Handle location input change with debounced search
  const handleLocationInputChange = useCallback((value: string) => {
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
  }, [searchLocationSuggestions]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: UserLocation) => {
    setLocation(suggestion);
    setLocationInput("");
    setLocationSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    setLocationError(null);
  }, [setLocation]);

  // Trip log handler
  const handleTripLogOpen = useCallback(() => {
    if (onTripLogOpen) {
      onTripLogOpen(currentDate);
    }
  }, [currentDate, onTripLogOpen]);

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
    <div
      key={index}
      className="bite-time-item flex items-center py-1"
    >
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
          className="nav-button px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition"
          aria-label="Previous day"
        >
          <i className="fas fa-chevron-left"></i>
        </button>
        <button
          onClick={handleNextDay}
          className="nav-button px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition ml-2"
          aria-label="Next day"
        >
          <i className="fas fa-chevron-right"></i>
        </button>
      </ModalHeader>

      <ModalBody className="max-h-[70vh] overflow-y-auto">
        {/* Moon Phase Info */}
        <div className="flex items-center mb-4">
          <span className="text-4xl mr-3">🌙</span>
          <div>
            <div
              className={`inline-block px-2 py-1 rounded text-white text-sm font-bold ${getQualityColorClass(lunarData.phase.quality)}`}
            >
              {lunarData.phase.quality}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Moon age: {lunarData.moonAge.toFixed(1)} days
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Illumination: {Math.round(lunarData.illumination * 100)}%
            </p>
          </div>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
          {lunarData.phase.description}
        </p>

        {/* Trip Log Section */}
        <div className="border-t dark:border-gray-700 pt-4 mb-4">
          <button
            onClick={handleTripLogOpen}
            className="w-full px-4 py-2 bg-main-500 text-white rounded-md hover:bg-main-600 transition"
            style={{ backgroundColor: "#0AA689" }}
          >
            <i className="fas fa-book-open mr-2"></i>
            View / Manage Trip Log
          </button>
        </div>

        {/* Bite Times Section */}
        <div className="border-t dark:border-gray-700 pt-4 mb-4">
          <h4 className="font-semibold text-lg mb-3 dark:text-gray-100">
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
                  onFocus={() => locationInput.trim().length >= 2 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  placeholder="Enter a location"
                  className="w-full px-3 py-2 border border-gray-300 rounded-l-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            index === selectedSuggestionIndex ? 'bg-blue-50 dark:bg-blue-900' : ''
                          }`}
                        >
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {suggestion.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {suggestion.lat.toFixed(4)}, {suggestion.lon.toFixed(4)}
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
                <i className={`fas ${isSearchingLocation ? "fa-spinner fa-spin" : "fa-search"}`}></i>
              </button>
              <button
                onClick={handleLocationRequest}
                disabled={isRequestingLocation}
                className="px-3 py-2 bg-main-500 text-white rounded-r-md hover:bg-main-600 transition disabled:opacity-50"
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
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Current: {userLocation.name}
              </p>
            )}
          </div>

          {/* Bite Times Display */}
          {biteTimesData ? (
            <>
              <div className="mb-4">
                <h5 className="font-medium text-green-600 mb-2">Major Bites</h5>
                <div className="space-y-1">
                  {biteTimesData.major.length > 0 ? (
                    biteTimesData.major.map(renderBiteTime)
                  ) : (
                    <p className="text-sm text-gray-500">
                      No major bite times for this day
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h5 className="font-medium text-blue-600 mb-2">Minor Bites</h5>
                <div className="space-y-1">
                  {biteTimesData.minor.length > 0 ? (
                    biteTimesData.minor.map(renderBiteTime)
                  ) : (
                    <p className="text-sm text-gray-500">
                      No minor bite times for this day
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">
              Set a location to see bite times
            </p>
          )}
        </div>

        {/* Weather Forecast Section */}
        <div className="border-t dark:border-gray-700 pt-4 mb-4">
          <h4 className="font-semibold text-lg mb-3 dark:text-gray-100">
            Weather Forecast
          </h4>
          <div className="text-sm">
            {weatherLoading ? (
              <p className="text-gray-500">Loading weather...</p>
            ) : weatherError ? (
              <p className="text-red-500">{weatherError}</p>
            ) : weatherData ? (
              <div className="space-y-2">
                <p>
                  <strong>Temperature:</strong>{" "}
                  {formatTemperatureRange(
                    weatherData.temperatureMin,
                    weatherData.temperatureMax,
                  )}
                </p>
                <p>
                  <strong>Wind:</strong>{" "}
                  {formatWindInfo(
                    weatherData.windSpeed,
                    weatherData.windDirectionCardinal,
                  )}
                </p>
              </div>
            ) : !userLocation ? (
              <p className="text-gray-500">
                Set a location to see weather forecast
              </p>
            ) : !isWeatherAvailable(currentDate) ? (
              <p className="text-gray-500">
                Weather forecast not available for this date
              </p>
            ) : (
              <p className="text-gray-500">Weather data unavailable</p>
            )}
          </div>
        </div>

        {/* Sun and Moon Times Section */}
        <div className="border-t dark:border-gray-700 pt-4 mb-4">
          <h4 className="font-semibold text-lg mb-3 dark:text-gray-100">
            Sun & Moon
          </h4>
          <div className="text-sm">
            {sunMoonTimes ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p>
                    <strong>Sunrise:</strong> {sunMoonTimes.sunrise}
                  </p>
                  <p>
                    <strong>Sunset:</strong> {sunMoonTimes.sunset}
                  </p>
                </div>
                <div>
                  <p>
                    <strong>Moonrise:</strong> {sunMoonTimes.moonrise}
                  </p>
                  <p>
                    <strong>Moonset:</strong> {sunMoonTimes.moonset}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-gray-500">
                Set a location to see sun and moon times
              </p>
            )}
          </div>
        </div>

        {/* Bite Time Quality Legend */}
        <div className="border-t dark:border-gray-700 pt-4">
          <h5 className="font-semibold mb-2 dark:text-gray-100">
            Bite Time Quality Legend
          </h5>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 dark:text-gray-300">
            <div className="flex items-center">
              <i
                className="fas fa-fish mr-2"
                style={{ color: BITE_QUALITY_COLORS.excellent }}
              ></i>
              <span className="text-sm">Excellent</span>
            </div>
            <div className="flex items-center">
              <i
                className="fas fa-fish mr-2"
                style={{ color: BITE_QUALITY_COLORS.good }}
              ></i>
              <span className="text-sm">Good</span>
            </div>
            <div className="flex items-center">
              <i
                className="fas fa-fish mr-2"
                style={{ color: BITE_QUALITY_COLORS.average }}
              ></i>
              <span className="text-sm">Average</span>
            </div>
            <div className="flex items-center">
              <i
                className="fas fa-fish mr-2"
                style={{ color: BITE_QUALITY_COLORS.fair }}
              ></i>
              <span className="text-sm">Fair</span>
            </div>
            <div className="flex items-center">
              <i
                className="fas fa-fish mr-2"
                style={{ color: BITE_QUALITY_COLORS.poor }}
              ></i>
              <span className="text-sm">Poor</span>
            </div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default LunarModal;
