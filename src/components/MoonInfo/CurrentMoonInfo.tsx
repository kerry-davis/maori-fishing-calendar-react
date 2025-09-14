import { useState, useEffect } from "react";
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
  const { userLocation, setLocation, requestLocation } = useLocationContext();
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

  // Handle manual location input
  const handleLocationChange = (location: UserLocation) => {
    setLocation(location);
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

  // Get quality color class
  const getQualityColor = (quality: string): string => {
    const colorMap: Record<string, string> = {
      Excellent: "text-green-600 dark:text-green-400",
      Good: "text-blue-600 dark:text-blue-400",
      Average: "text-yellow-600 dark:text-yellow-400",
      Poor: "text-red-600 dark:text-red-400",
    };
    return colorMap[quality] || "text-gray-600 dark:text-gray-400";
  };

  if (!moonInfo) {
    return (
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${className}`}
      >
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
          Current Moon Info
        </h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${className}`}
    >
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
        Current Moon Info
      </h3>

      {/* Moon Phase Display */}
      <div className="flex items-center mb-4">
        <div className="text-4xl mr-3">
          {getMoonPhaseIcon(moonInfo.phase.name)}
        </div>
        <div>
          <h4 className="font-semibold text-gray-800 dark:text-gray-100">
            {moonInfo.phase.name}
          </h4>
          <p
            className={`text-sm font-medium ${getQualityColor(moonInfo.phase.quality)}`}
          >
            {moonInfo.phase.quality} Fishing
          </p>
        </div>
      </div>

      {/* Moon Phase Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {moonInfo.phase.description}
      </p>

      {/* Moon Data */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide">
            Moon Age
          </p>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {moonInfo.formattedAge} days
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-500 uppercase tracking-wide">
            Illumination
          </p>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {moonInfo.formattedIllumination}
          </p>
        </div>
      </div>

      {/* Location Section */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center justify-between mb-2">
          <h5 className="text-sm font-medium text-gray-800 dark:text-gray-100">
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
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              <i className="fas fa-map-marker-alt mr-1"></i>
              {userLocation.name}
            </p>

            {/* Sun/Moon Times */}
            {sunMoonTimes && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-500 dark:text-gray-500">
                    <i className="fas fa-sun mr-1"></i>
                    Sunrise: {sunMoonTimes.sunrise}
                  </p>
                  <p className="text-gray-500 dark:text-gray-500">
                    <i className="fas fa-sun mr-1"></i>
                    Sunset: {sunMoonTimes.sunset}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 dark:text-gray-500">
                    <i className="fas fa-moon mr-1"></i>
                    Moonrise: {sunMoonTimes.moonrise}
                  </p>
                  <p className="text-gray-500 dark:text-gray-500">
                    <i className="fas fa-moon mr-1"></i>
                    Moonset: {sunMoonTimes.moonset}
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => setLocation(null)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mt-2"
            >
              <i className="fas fa-times mr-1"></i>
              Clear location
            </button>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Set your location to see sun and moon times
            </p>

            {locationError && (
              <p className="text-xs text-red-500 mb-2">
                <i className="fas fa-exclamation-triangle mr-1"></i>
                {locationError}
              </p>
            )}

            {/* Manual Location Input */}
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Location name"
                className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const target = e.target as HTMLInputElement;
                    const name = target.value.trim();
                    if (name) {
                      // For now, use default coordinates - this could be enhanced with geocoding
                      handleLocationChange({
                        lat: -36.8485, // Auckland, NZ default
                        lon: 174.7633,
                        name: name,
                      });
                      target.value = "";
                    }
                  }
                }}
              />
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Press Enter to set location (uses Auckland coordinates)
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
