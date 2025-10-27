import { useState, useEffect } from "react";
import { useLocationContext } from "@app/providers";
import { TideSummary } from "../tide/TideSummary";
import {
  getCurrentMoonInfo,
  getSunMoonTimes,
} from "@shared/services/lunarService";
import { createLocalCalendarDateUTC } from "@shared/services/tideService";
import type { LunarPhase } from "@shared/types";

interface CurrentMoonInfoProps {
  className?: string;
  onSettingsClick?: () => void;
}

export function CurrentMoonInfo({ className = "", onSettingsClick }: CurrentMoonInfoProps) {
  const { userLocation } = useLocationContext();
  const [moonInfo, setMoonInfo] = useState<{
    phase: LunarPhase;
    phaseIndex: number;
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
  // Tide date state that updates to match current local calendar date
  const [tideDate, setTideDate] = useState(() => createLocalCalendarDateUTC());

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

  // Update tide date every minute to catch day changes
  useEffect(() => {
    const updateTideDate = () => {
      const newTideDate = createLocalCalendarDateUTC();
      
      // Only update if the date actually changed
      if (newTideDate.getTime() !== tideDate.getTime()) {
        setTideDate(newTideDate);
      }
    };

    const interval = setInterval(updateTideDate, 60000);
    return () => clearInterval(interval);
  }, [tideDate]);

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
          {getMoonPhaseIcon(moonInfo.phaseIndex)}
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
          {onSettingsClick && (
            <button
              onClick={onSettingsClick}
              className="text-xs px-2 py-1 rounded transition"
              style={{ 
                color: 'var(--secondary-text)',
                backgroundColor: 'var(--tertiary-background)'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--secondary-background)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--tertiary-background)';
              }}
              title="Change location in Settings"
            >
              <i className="fas fa-cog mr-1"></i>
              Change Location
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

            {(() => {
              const isDark = typeof document !== 'undefined' && (
                document.documentElement.classList.contains('dark') ||
                document.body.classList.contains('dark-theme')
              );
              const axisColor = isDark ? 'rgba(255, 255, 255, 0.92)' : undefined;
              const gridColor = isDark ? 'rgba(255, 255, 255, 0.12)' : undefined;

              return (
                <TideSummary
                  date={userLocation ? tideDate : null}
                  className="mt-3"
                  title={<span style={{ color: 'var(--tertiary-text)' }}>Tide Forecast</span>}
                  titleClassName="text-xs uppercase tracking-wide mb-1"
                  bodyClassName="text-xs space-y-1"
                  retryButtonClassName="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  loadingMessage="Loading tide forecast…"
                  emptyMessage="Tide data unavailable."
                  axisColor={axisColor}
                  gridColor={gridColor}
                />
              );
            })()}
          </div>
        ) : (
          <div>
            <p className="text-sm mb-2" style={{ color: 'var(--tertiary-text)' }}>
              No location set. Set your location to see sun and moon times.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
