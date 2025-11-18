import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { Modal, ModalHeader, ModalBody } from "./Modal";
import { useLocationContext } from "@app/providers/LocationContext";
// import { useAuth } from "../../contexts/AuthContext"; // Not currently used
import { useDatabaseService } from '../../app/providers/DatabaseContext';
import {
  getLunarPhase,
  getMoonPhaseData,
  calculateBiteTimes,
  getSunMoonTimes,
  getSolunarDailyQuality,
} from "@shared/services/lunarService";
import { createLocalCalendarDateUTC, addDays } from "@shared/services/tideService";
import type { BiteTime } from "@shared/types";
import { BITE_QUALITY_COLORS } from "@shared/types";
import { WeatherSection } from "../weather/WeatherSection";
import { DEV_LOG, PROD_ERROR } from '../../shared/utils/loggingHelpers';

export interface LunarModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date | null;
  onTripLogOpen?: (date: Date, hasTrips: boolean) => void;
  onSettingsClick?: () => void;
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
  onSettingsClick,
}) => {
  // const { user } = useAuth(); // Not currently used
  const { userLocation } = useLocationContext();
  const db = useDatabaseService();
  const [currentDate, setCurrentDate] = useState<Date>(() => createLocalCalendarDateUTC());
  const [hasTripsForDate, setHasTripsForDate] = useState<boolean>(false);

  // Touch/swipe handling for mobile
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Update current date when modal opens or selectedDate changes
  useEffect(() => {
    if (isOpen && selectedDate) {
      setCurrentDate(createLocalCalendarDateUTC(selectedDate));
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

        DEV_LOG(
          `Checking trips for date ${dateStr}: found ${allTrips.length} total trips`,
        );
        DEV_LOG(
          "Trip dates:",
          allTrips.map((trip) => trip.date),
        );
        DEV_LOG(`${hasTrips ? "Has" : "No"} trips for this date`);

        if (isMounted) {
          setHasTripsForDate(hasTrips);
        }
      } catch (error) {
        PROD_ERROR("Error checking trips for date:", error);
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

  // Calculate lunar phase data for current date
  const lunarData = useMemo(() => {
    const phase = getLunarPhase(currentDate);
    const phaseData = getMoonPhaseData(currentDate);
    const solunarQuality = getSolunarDailyQuality(currentDate);
    return {
      phase,
      phaseIndex: phaseData.phaseIndex,
      moonAge: phaseData.moonAge,
      illumination: phaseData.illumination,
      solunarQuality, // Use solunar quality for display
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
      PROD_ERROR("Error calculating bite times:", error);
      return null;
    }
  }, [currentDate, userLocation]);

  // Calculate sun and moon times if location is available
  const sunMoonTimes = useMemo(() => {
    if (!userLocation) return null;

    try {
      return getSunMoonTimes(currentDate, userLocation);
    } catch (error) {
      PROD_ERROR("Error calculating sun/moon times:", error);
      return null;
    }
  }, [currentDate, userLocation]);

  // Navigation handlers
  const handlePrevDay = useCallback(() => {
    setCurrentDate(addDays(currentDate, -1));
  }, [currentDate]);

  const handleNextDay = useCallback(() => {
    setCurrentDate(addDays(currentDate, 1));
  }, [currentDate]);



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
                className={`inline-block px-2 py-1 rounded text-white text-sm font-bold ${getQualityColorClass(lunarData.solunarQuality)}`}
              >
                {lunarData.solunarQuality}
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--primary-text)' }}>
                Moon age: {lunarData.moonAge.toFixed(1)} days
              </p>
              <p className="text-sm" style={{ color: 'var(--primary-text)' }}>
                Illumination: {Math.round(lunarData.illumination * 100)}%
              </p>
            </div>
          </div>
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
            <div className="flex items-center justify-between mb-3">
              <h4 className="form-label text-lg">
                Bite Times
              </h4>
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
                  title="Set location in Settings"
                >
                  <i className="fas fa-cog mr-1"></i>
                  Set Location
                </button>
              )}
            </div>

            {/* Location Display */}
            <div className="mb-4">
              {userLocation ? (
                <p className="text-sm" style={{ color: 'var(--primary-text)' }}>
                  <i className="fas fa-map-marker-alt mr-1"></i>
                  {userLocation.name}
                </p>
              ) : (
                <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
                  No location set. Click "Set Location" to configure.
                </p>
              )}
            </div>

            {/* Bite Times Display */}
            {biteTimesData ? (
              <>
                <div className="flex gap-4 mb-4">
                  <div className="flex-1">
                    <h5 className="form-label text-green-600 dark:text-green-400 mb-2">
                      Major Bites
                    </h5>
                    <div className="space-y-1">
                      {biteTimesData.major.length > 0 ? (
                        biteTimesData.major.map(renderBiteTime)
                      ) : (
                        <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
                          No major bite times for this day
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <h5 className="form-label text-blue-600 dark:text-blue-400 mb-2">
                      Minor Bites
                    </h5>
                    <div className="space-y-1">
                      {biteTimesData.minor.length > 0 ? (
                        biteTimesData.minor.map(renderBiteTime)
                      ) : (
                        <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
                          No minor bite times for this day
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: 'var(--secondary-text)' }}>
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
            <div className="text-sm" style={{ color: 'var(--primary-text)' }}>
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
                <p style={{ color: 'var(--secondary-text)' }}>Set a location to see sun and moon times</p>
              )}
            </div>{" "}
          </div>
          {/* Bite Time Quality Legend */}
          <div className="border-t dark:border-gray-700 pt-4">
            <h5 className="form-label mb-2">
              Bite Time Quality Legend
            </h5>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="flex items-center">
                <i
                  className="fas fa-fish mr-2"
                  style={{ color: BITE_QUALITY_COLORS.excellent }}
                ></i>
                <span className="text-sm" style={{ color: 'var(--primary-text)' }}>Excellent</span>
              </div>
              <div className="flex items-center">
                <i
                  className="fas fa-fish mr-2"
                  style={{ color: BITE_QUALITY_COLORS.good }}
                ></i>
                <span className="text-sm" style={{ color: 'var(--primary-text)' }}>Good</span>
              </div>
              <div className="flex items-center">
                <i
                  className="fas fa-fish mr-2"
                  style={{ color: BITE_QUALITY_COLORS.average }}
                ></i>
                <span className="text-sm" style={{ color: 'var(--primary-text)' }}>Average</span>
              </div>
              <div className="flex items-center">
                <i
                  className="fas fa-fish mr-2"
                  style={{ color: BITE_QUALITY_COLORS.fair }}
                ></i>
                <span className="text-sm" style={{ color: 'var(--primary-text)' }}>Fair</span>
              </div>
              <div className="flex items-center">
                <i
                  className="fas fa-fish mr-2"
                  style={{ color: BITE_QUALITY_COLORS.poor }}
                ></i>
                <span className="text-sm" style={{ color: 'var(--primary-text)' }}>Poor</span>
              </div>
            </div>
          </div>
        </div>
      </ModalBody>
    </Modal>
  );
};

export default LunarModal;
