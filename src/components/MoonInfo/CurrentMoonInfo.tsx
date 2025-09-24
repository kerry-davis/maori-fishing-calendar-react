import { useState, useEffect, useRef } from "react";
import { useLocationContext } from "../../contexts";
import {
  getCurrentMoonInfo,
  getSunMoonTimes,
} from "../../services/lunarService";
import type { LunarPhase, UserLocation } from "../../types";

interface CurrentMoonInfoProps {
  className?: string;
}

export function CurrentMoonInfo({ className = "" }: CurrentMoonInfoProps) {
  const { userLocation, setLocation, requestLocation, searchLocation, searchLocationSuggestions } = useLocationContext();
  const [moonInfo, setMoonInfo] = useState<{
    phase: LunarPhase;
    moonAge: number;
    illumination: number;
    formattedAge: string;
    formattedIllumination: string;
  } | null>(null);
  const [sunMoonTimes, setSunMoonTimes] = useState<{
    sunrise: string;
    sunset: string;
    moonrise: string;
    moonset: string;
  } | null>(null);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationInput, setLocationInput] = useState("");
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<UserLocation[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);

  // Debounced search timeout ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update moon info every minute
  useEffect(() => {
    const updateMoonInfo = () => {
      const info = getCurrentMoonInfo();
      setMoonInfo(info);
    };

    // Initial update
    updateMoonInfo();

    // Update every minute
    const interval = setInterval(updateMoonInfo, 60000);

    return () => clearInterval(interval);
  }, []);

  // Update sun/moon times when location changes
  useEffect(() => {
    if (userLocation) {
      const now = new Date();
      const times = getSunMoonTimes(now, userLocation);
      setSunMoonTimes(times);
    } else {
      setSunMoonTimes(null);
    }
  }, [userLocation]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle location request
  const handleLocationRequest = async () => {
    if (isRequestingLocation) return;

    setIsRequestingLocation(true);
    setLocationError(null);

    try {
      await requestLocation();
    } catch (error) {
      setLocationError(
        error instanceof Error ? error.message : "Failed to get location",
      );
    } finally {
      setIsRequestingLocation(false);
    }
  };

  // Handle location search
  const handleLocationSearch = async () => {
    if (!locationInput.trim()) {
      return; // Don't search for empty input
    }

    setIsSearchingLocation(true);

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
  };

  // Handle Enter key press in location input
  const handleLocationInputKeyPress = (e: React.KeyboardEvent) => {
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
  };

  // Handle location input change with debounced search
  const handleLocationInputChange = (value: string) => {
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
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: UserLocation) => {
    setLocation(suggestion);
    setLocationInput("");
    setLocationSuggestions([]);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
    setLocationError(null);
  };

  // Get moon phase icon based on phase name
  const getMoonPhaseIcon = (phaseName: string): string => {
    // Map Māori phase names to moon phase icons
    const phaseIconMap: Record<string, string> = {
      Whiro: "🌑", // New moon
      Tirea: "🌒", // Waxing crescent
      Hoata: "🌒", // Waxing crescent
      Oue: "🌓", // First quarter
      Okoro: "🌓", // First quarter
      "Tamatea-a-hotu": "🌔", // Waxing gibbous
      "Tamatea-a-ngana": "🌔", // Waxing gibbous
      "Tamatea-whakapau": "🌔", // Waxing gibbous
      Huna: "🌕", // Full moon
      Ari: "🌕", // Full moon
      Hotu: "🌕", // Full moon
      Mawharu: "🌕", // Full moon
      Atua: "🌖", // Waning gibbous
      Ohua: "🌖", // Waning gibbous
      Oanui: "🌕", // Full moon
      Oturu: "🌖", // Waning gibbous
      "Rakau-nui": "🌖", // Waning gibbous
      "Rakau-matohi": "🌖", // Waning gibbous
      Takirau: "🌗", // Last quarter
      Oike: "🌗", // Last quarter
      "Korekore-te-whiwhia": "🌘", // Waning crescent
      "Korekore-te-rawea": "🌘", // Waning crescent
      "Korekore-whakapau": "🌘", // Waning crescent
      "Tangaroa-a-mua": "🌘", // Waning crescent
      "Tangaroa-a-roto": "🌘", // Waning crescent
      "Tangaroa-kiokio": "🌘", // Waning crescent
      Otane: "🌘", // Waning crescent
      Orongonui: "🌘", // Waning crescent
      Mauri: "🌘", // Waning crescent
      Mutuwhenua: "🌑", // New moon
    };

    return phaseIconMap[phaseName] || "🌙";
  };

  // Get quality color style
  const getQualityColor = (quality: string): React.CSSProperties => {
    const colorMap: Record<string, string> = {
      Excellent: "var(--quality-excellent)",
      Good: "var(--quality-good)",
      Average: "var(--quality-average)",
      Poor: "var(--quality-poor)",
    };
    return { color: colorMap[quality] || "var(--secondary-text)" };
  };

  if (!moonInfo) {
    return (
      <div
        className={`rounded-lg shadow-md p-4 ${className}`}
        style={{ backgroundColor: 'var(--card-background)', border: '1px solid var(--card-border)' }}
      >
        <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--primary-text)' }}>
          Current Moon Info
        </h3>
        <div className="animate-pulse">
          <div className="h-4 rounded w-3/4 mb-2" style={{ backgroundColor: 'var(--tertiary-background)' }}></div>
          <div className="h-4 rounded w-1/2" style={{ backgroundColor: 'var(--tertiary-background)' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg shadow-md p-4 ${className}`}
      style={{ backgroundColor: 'var(--card-background)', border: '1px solid var(--card-border)' }}
    >
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--primary-text)' }}>
        Current Moon Info
      </h3>

      {/* Moon Phase Display */}
      <div className="flex items-center mb-4">
        <div className="text-4xl mr-3">
          {getMoonPhaseIcon(moonInfo.phase.name)}
        </div>
        <div>
          <h4 className="font-semibold" style={{ color: 'var(--primary-text)' }}>
            {moonInfo.phase.name}
          </h4>
          <p
            className="text-sm font-medium"
            style={getQualityColor(moonInfo.phase.quality)}
          >
            {moonInfo.phase.quality} Fishing
          </p>
        </div>
      </div>

      {/* Moon Phase Description */}
      <p className="text-sm mb-4" style={{ color: 'var(--secondary-text)' }}>
        {moonInfo.phase.description}
      </p>

      {/* Moon Data */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--tertiary-text)' }}>
            Moon Age
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--primary-text)' }}>
            {moonInfo.formattedAge} days
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--tertiary-text)' }}>
            Illumination
          </p>
          <p className="text-sm font-medium" style={{ color: 'var(--primary-text)' }}>
            {moonInfo.formattedIllumination}
          </p>
        </div>
      </div>

      {/* Location Section */}
      <div className="border-t pt-4" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-sm font-medium" style={{ color: 'var(--primary-text)' }}>
            Location
          </h5>
          {!userLocation && (
            <button
              onClick={handleLocationRequest}
              disabled={isRequestingLocation}
              className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isRequestingLocation ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1"></i>
                  Getting...
                </>
              ) : (
                <>
                  <i className="fas fa-location-arrow mr-1"></i>
                  Get Location
                </>
              )}
            </button>
          )}
        </div>

        {userLocation ? (
          <div>
            <p className="text-sm mb-3" style={{ color: 'var(--secondary-text)' }}>
              <i className="fas fa-map-marker-alt mr-1"></i>
              {userLocation.name}
            </p>

            {/* Sun/Moon Times */}
            {sunMoonTimes && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p style={{ color: 'var(--tertiary-text)' }}>
                    <i className="fas fa-sun mr-1"></i>
                    Sunrise: {sunMoonTimes.sunrise}
                  </p>
                  <p style={{ color: 'var(--tertiary-text)' }}>
                    <i className="fas fa-sun mr-1"></i>
                    Sunset: {sunMoonTimes.sunset}
                  </p>
                </div>
                <div>
                  <p style={{ color: 'var(--tertiary-text)' }}>
                    <i className="fas fa-moon mr-1"></i>
                    Moonrise: {sunMoonTimes.moonrise}
                  </p>
                  <p style={{ color: 'var(--tertiary-text)' }}>
                    <i className="fas fa-moon mr-1"></i>
                    Moonset: {sunMoonTimes.moonset}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setLocation(null)}
              className="text-xs mt-2"
              style={{ color: 'var(--tertiary-text)' }}
              onMouseOver={(e) => e.currentTarget.style.color = 'var(--secondary-text)'}
              onMouseOut={(e) => e.currentTarget.style.color = 'var(--tertiary-text)'}
            >
              <i className="fas fa-times mr-1"></i>
              Clear location
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm mb-2" style={{ color: 'var(--tertiary-text)' }}>
              Set your location to see sun and moon times
            </p>

            {locationError && (
              <p className="text-xs mb-2" style={{ color: 'var(--quality-poor)' }}>
                <i className="fas fa-exclamation-triangle mr-1"></i>
                {locationError}
              </p>
            )}

            {/* Location Search Input */}
            <div className="space-y-2">
              <div className="flex items-center space-x-1">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={locationInput}
                    onChange={(e) => handleLocationInputChange(e.target.value)}
                    onKeyDown={handleLocationInputKeyPress}
                    onFocus={() => locationInput.trim().length >= 2 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                    placeholder="Enter a location"
                    className="w-full text-xs px-2 py-1 border rounded-l focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{
                      borderColor: 'var(--input-border)',
                      backgroundColor: 'var(--input-background)',
                      color: 'var(--primary-text)'
                    }}
                  />

                  {/* Location Suggestions Dropdown */}
                  {showSuggestions && (
                    <div className="absolute z-50 w-full mt-1 border rounded-md shadow-lg max-h-60 overflow-y-auto" style={{
                      backgroundColor: 'var(--card-background)',
                      borderColor: 'var(--card-border)'
                    }}>
                      {isLoadingSuggestions ? (
                        <div className="px-2 py-1 text-xs" style={{ color: 'var(--secondary-text)' }}>
                          <i className="fas fa-spinner fa-spin mr-1"></i>
                          Searching locations...
                        </div>
                      ) : locationSuggestions.length > 0 ? (
                        locationSuggestions.map((suggestion, index) => (
                          <div
                            key={`${suggestion.lat}-${suggestion.lon}`}
                            onClick={() => handleSuggestionSelect(suggestion)}
                            className="px-2 py-1 cursor-pointer text-xs"
                            style={{
                              backgroundColor: index === selectedSuggestionIndex ? 'var(--secondary-background)' : 'transparent'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--tertiary-background)'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = index === selectedSuggestionIndex ? 'var(--secondary-background)' : 'transparent'}
                          >
                            <div className="font-medium" style={{ color: 'var(--primary-text)' }}>
                              {suggestion.name}
                            </div>
                            <div className="text-xs" style={{ color: 'var(--tertiary-text)' }}>
                              {suggestion.lat.toFixed(4)}, {suggestion.lon.toFixed(4)}
                            </div>
                          </div>
                        ))
                      ) : locationInput.trim().length >= 2 ? (
                        <div className="px-2 py-1 text-xs" style={{ color: 'var(--secondary-text)' }}>
                          No locations found
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleLocationSearch}
                  disabled={isSearchingLocation}
                  className="px-2 py-1 rounded-r transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: 'var(--button-secondary)', color: 'white' }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--button-secondary-hover)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'var(--button-secondary)'}
                  title="Search location"
                >
                  <i className={`fas ${isSearchingLocation ? "fa-spinner fa-spin" : "fa-search"} text-xs`}></i>
                </button>
              </div>
              <p className="text-xs" style={{ color: 'var(--tertiary-text)' }}>
                Start typing to see location suggestions
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
