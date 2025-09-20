import * as SunCalc from "suncalc";
import type {
  BiteTime,
  MoonPhaseData,
  MoonTransitData,
  LunarPhase,
  UserLocation,
} from "../types";
import { LUNAR_PHASES } from "../types";

/**
 * Lunar Service Module
 *
 * This service provides lunar calculations using the SunCalc library,
 * maintaining compatibility with the existing vanilla JavaScript implementation.
 * It handles moon phase calculations, bite time calculations, and sun/moon rise/set times.
 */

/**
 * Get moon phase data for a specific date
 * @param date - The date to calculate moon phase for
 * @returns Moon phase data including phase index, moon age, and illumination
 */
export function getMoonPhaseData(date: Date): MoonPhaseData {
  const moonIllumination = SunCalc.getMoonIllumination(date);
  const moonAge = moonIllumination.phase * 29.53;
  let phaseIndex = Math.floor(moonAge);
  phaseIndex = Math.min(phaseIndex, LUNAR_PHASES.length - 1);

  return {
    phaseIndex,
    moonAge,
    illumination: moonIllumination.fraction,
  };
}

/**
 * Get the lunar phase information for a specific date
 * @param date - The date to get lunar phase for
 * @returns The lunar phase object with name, quality, description, and bite qualities
 */
export function getLunarPhase(date: Date): LunarPhase {
  const { phaseIndex } = getMoonPhaseData(date);
  return LUNAR_PHASES[phaseIndex];
}

/**
 * Calculate moon transit times for a specific date and location
 * This is a direct port of the existing getMoonTransitTimes function
 * @param date - The date to calculate transits for
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Moon transit data with times and overhead status
 */
export function getMoonTransitTimes(
  date: Date,
  lat: number,
  lng: number,
): MoonTransitData {
  const rc: MoonTransitData = { transits: [] };
  let sign = 1;
  let i: number, j: number;

  // Find first transit
  for (i = 0; i <= 25; i++) {
    const date2 = new Date(date.getTime());
    date2.setHours(i);
    date2.setMinutes(0);
    date2.setSeconds(0);
    date2.setMilliseconds(0);
    const moontimes = SunCalc.getMoonPosition(date2, lat, lng);

    if (i === 0) {
      sign = Math.sign(moontimes.azimuth);
    }
    if (sign !== Math.sign(moontimes.azimuth)) {
      break;
    }
  }

  // Refine first transit time to minute precision
  let signBool = true;
  for (j = 0; j < 60; j++) {
    const date3 = new Date(date.getTime());
    date3.setHours(i - 1);
    date3.setMinutes(j);
    date3.setSeconds(0);
    date3.setMilliseconds(0);
    const moontimes = SunCalc.getMoonPosition(date3, lat, lng);

    if (j === 0) {
      if (moontimes.azimuth < 0) {
        signBool = false;
      }
    }
    if (signBool !== moontimes.azimuth > 0) {
      rc.transits.push({
        time: date3,
        overhead: Math.sign(moontimes.altitude) > 0,
      });
      break;
    }
  }

  // Find second transit
  const start = i;
  for (; i <= 25; i++) {
    const date2 = new Date(date.getTime());
    date2.setHours(i);
    date2.setMinutes(0);
    date2.setSeconds(0);
    date2.setMilliseconds(0);
    const moontimes = SunCalc.getMoonPosition(date2, lat, lng);

    if (i === start) {
      sign = Math.sign(moontimes.azimuth);
    }
    if (sign !== Math.sign(moontimes.azimuth)) {
      break;
    }
  }

  // Refine second transit time if found
  if (i < 25) {
    signBool = true;
    for (j = 0; j < 60; j++) {
      const date3 = new Date(date.getTime());
      date3.setHours(i - 1);
      date3.setMinutes(j);
      date3.setSeconds(0);
      date3.setMilliseconds(0);
      const moontimes = SunCalc.getMoonPosition(date3, lat, lng);

      if (j === 0) {
        if (moontimes.azimuth < 0) {
          signBool = false;
        }
      }
      if (signBool !== moontimes.azimuth > 0) {
        rc.transits.push({
          time: date3,
          overhead: Math.sign(moontimes.altitude) > 0,
        });
        break;
      }
    }
  }

  return rc;
}

/**
 * Calculate bite times for a specific date and location
 * @param date - The date to calculate bite times for
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Object containing major and minor bite times
 */
export function calculateBiteTimes(
  date: Date,
  lat: number,
  lon: number,
): { major: BiteTime[]; minor: BiteTime[] } {
  const moonTimes = SunCalc.getMoonTimes(date, lat, lon);
  const moonTransits = getMoonTransitTimes(date, lat, lon).transits;
  const lunarDay = getLunarPhase(date);
  const qualities = lunarDay.biteQualities;

  const formatBite = (start: Date, end: Date, quality: string): BiteTime => ({
    start: start.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    end: end.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
    quality: quality as any, // Type assertion since we know the quality comes from biteQualities
  });

  // Major bite times (moon transits) - 2 hour windows
  const majorBites = moonTransits.map((transit, index) => {
    const start = new Date(transit.time.getTime() - 1 * 60 * 60 * 1000); // 1 hour before
    const end = new Date(transit.time.getTime() + 1 * 60 * 60 * 1000); // 1 hour after
    return formatBite(start, end, qualities[index] || "poor");
  });

  // Minor bite times (moonrise/moonset) - 1 hour windows
  const minorBites: BiteTime[] = [];
  if (moonTimes.rise) {
    const start = new Date(moonTimes.rise.getTime() - 0.5 * 60 * 60 * 1000); // 30 min before
    const end = new Date(moonTimes.rise.getTime() + 0.5 * 60 * 60 * 1000); // 30 min after
    minorBites.push(formatBite(start, end, qualities[2] || "poor"));
  }
  if (moonTimes.set) {
    const start = new Date(moonTimes.set.getTime() - 0.5 * 60 * 60 * 1000); // 30 min before
    const end = new Date(moonTimes.set.getTime() + 0.5 * 60 * 60 * 1000); // 30 min after
    minorBites.push(formatBite(start, end, qualities[3] || "poor"));
  }

  return {
    major: majorBites,
    minor: minorBites,
  };
}

/**
 * Get sun rise and set times for a specific date and location
 * @param date - The date to calculate sun times for
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Object with sunrise and sunset times
 */
export function getSunTimes(
  date: Date,
  lat: number,
  lon: number,
): { sunrise: Date | null; sunset: Date | null } {
  const sunTimes = SunCalc.getTimes(date, lat, lon);
  return {
    sunrise: sunTimes.sunrise || null,
    sunset: sunTimes.sunset || null,
  };
}

/**
 * Get moon rise and set times for a specific date and location
 * Handles cases where moonrise/moonset might occur on adjacent days
 * @param date - The date to calculate moon times for
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Object with moonrise and moonset times
 */
export function getMoonTimes(
  date: Date,
  lat: number,
  lon: number,
): { moonrise: Date | null; moonset: Date | null } {
  const today = new Date(date);
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Get moon times for yesterday, today, and tomorrow
  const riseTimes = [
    SunCalc.getMoonTimes(yesterday, lat, lon).rise,
    SunCalc.getMoonTimes(today, lat, lon).rise,
    SunCalc.getMoonTimes(tomorrow, lat, lon).rise,
  ].filter(Boolean);

  const setTimes = [
    SunCalc.getMoonTimes(yesterday, lat, lon).set,
    SunCalc.getMoonTimes(today, lat, lon).set,
    SunCalc.getMoonTimes(tomorrow, lat, lon).set,
  ].filter(Boolean);

  // Find the rise and set times that occur on the target date
  const moonriseDate = riseTimes.find((r) => r && r > today && r < tomorrow);
  const moonsetDate = setTimes.find((s) => s && s > today && s < tomorrow);

  return {
    moonrise: moonriseDate || null,
    moonset: moonsetDate || null,
  };
}

/**
 * Format a time object to HH:MM string
 * @param dateObj - Date object to format
 * @returns Formatted time string or 'N/A' if invalid
 */
export function formatTime(dateObj: Date | null): string {
  if (!dateObj || isNaN(dateObj.getTime())) return "N/A";
  return dateObj.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * Get comprehensive sun and moon times for a specific date and location
 * @param date - The date to calculate times for
 * @param location - User location with lat/lon
 * @returns Object with all sun and moon times formatted as strings
 */
export function getSunMoonTimes(
  date: Date,
  location: UserLocation,
): {
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
} {
  const sunTimes = getSunTimes(date, location.lat, location.lon);
  const moonTimes = getMoonTimes(date, location.lat, location.lon);

  return {
    sunrise: formatTime(sunTimes.sunrise),
    sunset: formatTime(sunTimes.sunset),
    moonrise: formatTime(moonTimes.moonrise),
    moonset: formatTime(moonTimes.moonset),
  };
}

/**
 * Convert minutes to HH:MM time format
 * @param minutes - Minutes since midnight
 * @returns Formatted time string
 */
export function minutesToTime(minutes: number): string {
  minutes = (minutes + 1440) % 1440;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
}

/**
 * Get current moon phase information for display
 * @returns Current moon phase data with formatted information
 */
export function getCurrentMoonInfo(): {
  phase: LunarPhase;
  moonAge: number;
  illumination: number;
  formattedAge: string;
  formattedIllumination: string;
} {
  const now = new Date();
  const phaseData = getMoonPhaseData(now);
  const phase = getLunarPhase(now);

  return {
    phase,
    moonAge: phaseData.moonAge,
    illumination: phaseData.illumination,
    formattedAge: phaseData.moonAge.toFixed(1),
    formattedIllumination: `${Math.round(phaseData.illumination * 100)}%`,
  };
}
