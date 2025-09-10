import { describe, it, expect, beforeEach } from 'vitest';
import * as SunCalc from 'suncalc';
import {
  getMoonPhaseData,
  getLunarPhase,
  getMoonTransitTimes,
  calculateBiteTimes,
  getSunTimes,
  getMoonTimes,
  formatTime,
  getSunMoonTimes,
  minutesToTime,
  getCurrentMoonInfo
} from '../lunarService';
import { LUNAR_PHASES } from '../../types';

describe('lunarService', () => {
  const testDate = new Date('2024-01-15T12:00:00Z'); // Fixed date for consistent testing
  const testLocation = { lat: -36.8485, lon: 174.7633, name: 'Auckland, New Zealand' };

  describe('getMoonPhaseData', () => {
    it('should return valid moon phase data', () => {
      const result = getMoonPhaseData(testDate);
      
      expect(result).toHaveProperty('phaseIndex');
      expect(result).toHaveProperty('moonAge');
      expect(result).toHaveProperty('illumination');
      
      expect(typeof result.phaseIndex).toBe('number');
      expect(typeof result.moonAge).toBe('number');
      expect(typeof result.illumination).toBe('number');
      
      expect(result.phaseIndex).toBeGreaterThanOrEqual(0);
      expect(result.phaseIndex).toBeLessThan(LUNAR_PHASES.length);
      expect(result.moonAge).toBeGreaterThanOrEqual(0);
      expect(result.moonAge).toBeLessThanOrEqual(29.53);
      expect(result.illumination).toBeGreaterThanOrEqual(0);
      expect(result.illumination).toBeLessThanOrEqual(1);
    });

    it('should handle edge cases for phase index', () => {
      // Test with a date that might produce edge case values
      const edgeDate = new Date('2024-12-31T23:59:59Z');
      const result = getMoonPhaseData(edgeDate);
      
      expect(result.phaseIndex).toBeLessThan(LUNAR_PHASES.length);
      expect(result.phaseIndex).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getLunarPhase', () => {
    it('should return a valid lunar phase object', () => {
      const result = getLunarPhase(testDate);
      
      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('description');
      expect(result).toHaveProperty('biteQualities');
      
      expect(typeof result.name).toBe('string');
      expect(['Excellent', 'Good', 'Average', 'Poor']).toContain(result.quality);
      expect(typeof result.description).toBe('string');
      expect(Array.isArray(result.biteQualities)).toBe(true);
      expect(result.biteQualities).toHaveLength(4);
    });

    it('should return consistent results for the same date', () => {
      const result1 = getLunarPhase(testDate);
      const result2 = getLunarPhase(testDate);
      
      expect(result1).toEqual(result2);
    });
  });

  describe('getMoonTransitTimes', () => {
    it('should return moon transit data', () => {
      const result = getMoonTransitTimes(testDate, testLocation.lat, testLocation.lon);
      
      expect(result).toHaveProperty('transits');
      expect(Array.isArray(result.transits)).toBe(true);
      
      result.transits.forEach(transit => {
        expect(transit).toHaveProperty('time');
        expect(transit).toHaveProperty('overhead');
        expect(transit.time).toBeInstanceOf(Date);
        expect(typeof transit.overhead).toBe('boolean');
      });
    });

    it('should return valid transit times within the day', () => {
      const result = getMoonTransitTimes(testDate, testLocation.lat, testLocation.lon);
      const dayStart = new Date(testDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(testDate);
      dayEnd.setHours(23, 59, 59, 999);
      
      result.transits.forEach(transit => {
        expect(transit.time.getTime()).toBeGreaterThanOrEqual(dayStart.getTime());
        expect(transit.time.getTime()).toBeLessThanOrEqual(dayEnd.getTime());
      });
    });
  });

  describe('calculateBiteTimes', () => {
    it('should return bite times with major and minor arrays', () => {
      const result = calculateBiteTimes(testDate, testLocation.lat, testLocation.lon);
      
      expect(result).toHaveProperty('major');
      expect(result).toHaveProperty('minor');
      expect(Array.isArray(result.major)).toBe(true);
      expect(Array.isArray(result.minor)).toBe(true);
    });

    it('should return properly formatted bite times', () => {
      const result = calculateBiteTimes(testDate, testLocation.lat, testLocation.lon);
      
      [...result.major, ...result.minor].forEach(bite => {
        expect(bite).toHaveProperty('start');
        expect(bite).toHaveProperty('end');
        expect(bite).toHaveProperty('quality');
        
        // Check time format (HH:MM)
        expect(bite.start).toMatch(/^\d{2}:\d{2}$/);
        expect(bite.end).toMatch(/^\d{2}:\d{2}$/);
        
        // Check quality is valid
        expect(['excellent', 'good', 'average', 'fair', 'poor']).toContain(bite.quality);
      });
    });

    it('should handle locations without moon rise/set gracefully', () => {
      // Test with extreme latitude where moon might not rise/set
      const extremeLocation = { lat: 85, lon: 0 };
      const result = calculateBiteTimes(testDate, extremeLocation, extremeLocation);
      
      expect(result).toHaveProperty('major');
      expect(result).toHaveProperty('minor');
      expect(Array.isArray(result.major)).toBe(true);
      expect(Array.isArray(result.minor)).toBe(true);
    });
  });

  describe('getSunTimes', () => {
    it('should return sun times', () => {
      const result = getSunTimes(testDate, testLocation.lat, testLocation.lon);
      
      expect(result).toHaveProperty('sunrise');
      expect(result).toHaveProperty('sunset');
      
      if (result.sunrise) {
        expect(result.sunrise).toBeInstanceOf(Date);
      }
      if (result.sunset) {
        expect(result.sunset).toBeInstanceOf(Date);
      }
    });

    it('should return sunrise before sunset when both exist', () => {
      const result = getSunTimes(testDate, testLocation.lat, testLocation.lon);
      
      if (result.sunrise && result.sunset) {
        expect(result.sunrise.getTime()).toBeLessThan(result.sunset.getTime());
      }
    });
  });

  describe('getMoonTimes', () => {
    it('should return moon times', () => {
      const result = getMoonTimes(testDate, testLocation.lat, testLocation.lon);
      
      expect(result).toHaveProperty('moonrise');
      expect(result).toHaveProperty('moonset');
      
      if (result.moonrise) {
        expect(result.moonrise).toBeInstanceOf(Date);
      }
      if (result.moonset) {
        expect(result.moonset).toBeInstanceOf(Date);
      }
    });
  });

  describe('formatTime', () => {
    it('should format valid dates correctly', () => {
      const testTime = new Date('2024-01-15T14:30:00Z');
      const result = formatTime(testTime);
      
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });

    it('should return N/A for null dates', () => {
      expect(formatTime(null)).toBe('N/A');
    });

    it('should return N/A for invalid dates', () => {
      const invalidDate = new Date('invalid');
      expect(formatTime(invalidDate)).toBe('N/A');
    });
  });

  describe('getSunMoonTimes', () => {
    it('should return formatted sun and moon times', () => {
      const result = getSunMoonTimes(testDate, testLocation);
      
      expect(result).toHaveProperty('sunrise');
      expect(result).toHaveProperty('sunset');
      expect(result).toHaveProperty('moonrise');
      expect(result).toHaveProperty('moonset');
      
      expect(typeof result.sunrise).toBe('string');
      expect(typeof result.sunset).toBe('string');
      expect(typeof result.moonrise).toBe('string');
      expect(typeof result.moonset).toBe('string');
    });
  });

  describe('minutesToTime', () => {
    it('should convert minutes to time format correctly', () => {
      expect(minutesToTime(0)).toBe('00:00');
      expect(minutesToTime(60)).toBe('01:00');
      expect(minutesToTime(90)).toBe('01:30');
      expect(minutesToTime(1440)).toBe('00:00'); // Full day wraps around
      expect(minutesToTime(1500)).toBe('01:00'); // Over 24 hours wraps around
    });

    it('should handle negative minutes', () => {
      expect(minutesToTime(-60)).toBe('23:00'); // -1 hour = 23:00
      expect(minutesToTime(-30)).toBe('23:30'); // -30 min = 23:30
    });
  });

  describe('getCurrentMoonInfo', () => {
    it('should return current moon information', () => {
      const result = getCurrentMoonInfo();
      
      expect(result).toHaveProperty('phase');
      expect(result).toHaveProperty('moonAge');
      expect(result).toHaveProperty('illumination');
      expect(result).toHaveProperty('formattedAge');
      expect(result).toHaveProperty('formattedIllumination');
      
      expect(result.phase).toHaveProperty('name');
      expect(result.phase).toHaveProperty('quality');
      expect(typeof result.moonAge).toBe('number');
      expect(typeof result.illumination).toBe('number');
      expect(typeof result.formattedAge).toBe('string');
      expect(typeof result.formattedIllumination).toBe('string');
      
      // Check formatted values
      expect(result.formattedAge).toMatch(/^\d+\.\d$/);
      expect(result.formattedIllumination).toMatch(/^\d+%$/);
    });
  });

  describe('Integration with SunCalc', () => {
    it('should use SunCalc correctly for moon illumination', () => {
      const moonData = getMoonPhaseData(testDate);
      const sunCalcData = SunCalc.getMoonIllumination(testDate);
      
      expect(moonData.illumination).toBe(sunCalcData.fraction);
      expect(moonData.moonAge).toBeCloseTo(sunCalcData.phase * 29.53, 2);
    });

    it('should use SunCalc correctly for sun times', () => {
      const sunTimes = getSunTimes(testDate, testLocation.lat, testLocation.lon);
      const sunCalcTimes = SunCalc.getTimes(testDate, testLocation.lat, testLocation.lon);
      
      expect(sunTimes.sunrise).toEqual(sunCalcTimes.sunrise || null);
      expect(sunTimes.sunset).toEqual(sunCalcTimes.sunset || null);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid coordinates gracefully', () => {
      const invalidLat = 91; // Invalid latitude
      const invalidLon = 181; // Invalid longitude
      
      expect(() => {
        calculateBiteTimes(testDate, invalidLat, invalidLon);
      }).not.toThrow();
      
      expect(() => {
        getSunTimes(testDate, invalidLat, invalidLon);
      }).not.toThrow();
    });

    it('should handle extreme dates', () => {
      const extremeDate = new Date('1900-01-01');
      
      expect(() => {
        getMoonPhaseData(extremeDate);
      }).not.toThrow();
      
      expect(() => {
        getLunarPhase(extremeDate);
      }).not.toThrow();
    });
  });
});