import { describe, it, expect } from 'vitest';
import {
  getMoonPhaseData,
  getLunarPhase,
  calculateBiteTimes,
  getSunMoonTimes,
  getCurrentMoonInfo
} from '../lunarService';
import { LUNAR_PHASES, BITE_QUALITY_COLORS } from '../../types';

describe('lunarService Integration Tests', () => {
  const aucklandLocation = { lat: -36.8485, lon: 174.7633, name: 'Auckland, New Zealand' };
  const testDate = new Date('2024-06-15T12:00:00Z'); // Winter solstice period

  describe('Integration with Māori Lunar Calendar', () => {
    it('should provide complete lunar information for calendar display', () => {
      const phaseData = getMoonPhaseData(testDate);
      const lunarPhase = getLunarPhase(testDate);
      
      // Verify phase data is within expected ranges
      expect(phaseData.phaseIndex).toBeGreaterThanOrEqual(0);
      expect(phaseData.phaseIndex).toBeLessThan(LUNAR_PHASES.length);
      expect(phaseData.moonAge).toBeGreaterThanOrEqual(0);
      expect(phaseData.moonAge).toBeLessThanOrEqual(29.53);
      
      // Verify lunar phase matches the phase data
      expect(lunarPhase).toBe(LUNAR_PHASES[phaseData.phaseIndex]);
      
      // Verify all required properties exist
      expect(lunarPhase.name).toBeTruthy();
      expect(['Excellent', 'Good', 'Average', 'Poor']).toContain(lunarPhase.quality);
      expect(lunarPhase.description).toBeTruthy();
      expect(lunarPhase.biteQualities).toHaveLength(4);
      
      // Verify bite qualities are valid
      lunarPhase.biteQualities.forEach(quality => {
        expect(['excellent', 'good', 'average', 'fair', 'poor']).toContain(quality);
        expect(BITE_QUALITY_COLORS[quality]).toBeTruthy();
      });
    });

    it('should calculate bite times that align with lunar phase qualities', () => {
      const biteTimes = calculateBiteTimes(testDate, aucklandLocation.lat, aucklandLocation.lon);
      const lunarPhase = getLunarPhase(testDate);
      
      // Verify structure
      expect(biteTimes.major).toBeDefined();
      expect(biteTimes.minor).toBeDefined();
      expect(Array.isArray(biteTimes.major)).toBe(true);
      expect(Array.isArray(biteTimes.minor)).toBe(true);
      
      // Verify all bite times have valid qualities from the lunar phase
      const allBiteTimes = [...biteTimes.major, ...biteTimes.minor];
      allBiteTimes.forEach(bite => {
        expect(lunarPhase.biteQualities).toContain(bite.quality);
        expect(BITE_QUALITY_COLORS[bite.quality]).toBeTruthy();
      });
      
      // Verify time format
      allBiteTimes.forEach(bite => {
        expect(bite.start).toMatch(/^\d{2}:\d{2}$/);
        expect(bite.end).toMatch(/^\d{2}:\d{2}$/);
        
        // Verify start time is before end time (accounting for day wrap)
        const [startHour, startMin] = bite.start.split(':').map(Number);
        const [endHour, endMin] = bite.end.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        // Allow for day wrap-around
        if (endMinutes < startMinutes) {
          expect(endMinutes + 1440).toBeGreaterThan(startMinutes);
        } else {
          expect(endMinutes).toBeGreaterThan(startMinutes);
        }
      });
    });
  });

  describe('Integration with Location Services', () => {
    it('should provide complete sun/moon times for location display', () => {
      const times = getSunMoonTimes(testDate, aucklandLocation);
      
      expect(times.sunrise).toBeTruthy();
      expect(times.sunset).toBeTruthy();
      expect(times.moonrise).toBeTruthy();
      expect(times.moonset).toBeTruthy();
      
      // Verify format
      expect(times.sunrise).toMatch(/^\d{2}:\d{2}$|^N\/A$/);
      expect(times.sunset).toMatch(/^\d{2}:\d{2}$|^N\/A$/);
      expect(times.moonrise).toMatch(/^\d{2}:\d{2}$|^N\/A$/);
      expect(times.moonset).toMatch(/^\d{2}:\d{2}$|^N\/A$/);
    });

    it('should handle different global locations correctly', () => {
      const locations = [
        { lat: -36.8485, lon: 174.7633, name: 'Auckland, NZ' },
        { lat: 51.5074, lon: -0.1278, name: 'London, UK' },
        { lat: 40.7128, lon: -74.0060, name: 'New York, USA' },
        { lat: -33.8688, lon: 151.2093, name: 'Sydney, Australia' }
      ];
      
      locations.forEach(location => {
        const times = getSunMoonTimes(testDate, location);
        const biteTimes = calculateBiteTimes(testDate, location.lat, location.lon);
        
        // Should not throw errors
        expect(times).toBeDefined();
        expect(biteTimes).toBeDefined();
        
        // Should have valid structure
        expect(typeof times.sunrise).toBe('string');
        expect(typeof times.sunset).toBe('string');
        expect(Array.isArray(biteTimes.major)).toBe(true);
        expect(Array.isArray(biteTimes.minor)).toBe(true);
      });
    });
  });

  describe('Integration with Current Moon Display', () => {
    it('should provide complete current moon information', () => {
      const currentMoon = getCurrentMoonInfo();
      
      // Verify structure
      expect(currentMoon.phase).toBeDefined();
      expect(typeof currentMoon.moonAge).toBe('number');
      expect(typeof currentMoon.illumination).toBe('number');
      expect(typeof currentMoon.formattedAge).toBe('string');
      expect(typeof currentMoon.formattedIllumination).toBe('string');
      
      // Verify phase is from our lunar phases
      expect(LUNAR_PHASES).toContain(currentMoon.phase);
      
      // Verify ranges
      expect(currentMoon.moonAge).toBeGreaterThanOrEqual(0);
      expect(currentMoon.moonAge).toBeLessThanOrEqual(29.53);
      expect(currentMoon.illumination).toBeGreaterThanOrEqual(0);
      expect(currentMoon.illumination).toBeLessThanOrEqual(1);
      
      // Verify formatting
      expect(currentMoon.formattedAge).toMatch(/^\d+\.\d$/);
      expect(currentMoon.formattedIllumination).toMatch(/^\d+%$/);
      
      // Verify formatted values match raw values
      expect(parseFloat(currentMoon.formattedAge)).toBeCloseTo(currentMoon.moonAge, 1);
      expect(parseInt(currentMoon.formattedIllumination)).toBe(Math.round(currentMoon.illumination * 100));
    });
  });

  describe('Data Consistency Across Functions', () => {
    it('should return consistent moon phase data across different functions', () => {
      const phaseData = getMoonPhaseData(testDate);
      const lunarPhase = getLunarPhase(testDate);
      const biteTimes = calculateBiteTimes(testDate, aucklandLocation.lat, aucklandLocation.lon);
      
      // The lunar phase should match the phase index
      expect(lunarPhase).toBe(LUNAR_PHASES[phaseData.phaseIndex]);
      
      // Bite qualities in bite times should come from the lunar phase
      const allBiteQualities = [...biteTimes.major, ...biteTimes.minor].map(b => b.quality);
      allBiteQualities.forEach(quality => {
        expect(lunarPhase.biteQualities).toContain(quality);
      });
    });

    it('should handle edge cases consistently', () => {
      const edgeCases = [
        new Date('2024-01-01T00:00:00Z'), // New Year
        new Date('2024-12-31T23:59:59Z'), // End of year
        new Date('2024-06-21T12:00:00Z'), // Summer solstice
        new Date('2024-12-21T12:00:00Z'), // Winter solstice
      ];
      
      edgeCases.forEach(date => {
        const phaseData = getMoonPhaseData(date);
        const lunarPhase = getLunarPhase(date);
        const biteTimes = calculateBiteTimes(date, aucklandLocation.lat, aucklandLocation.lon);
        const times = getSunMoonTimes(date, aucklandLocation);
        
        // All functions should return valid data
        expect(phaseData.phaseIndex).toBeGreaterThanOrEqual(0);
        expect(phaseData.phaseIndex).toBeLessThan(LUNAR_PHASES.length);
        expect(lunarPhase).toBeDefined();
        expect(biteTimes.major).toBeDefined();
        expect(biteTimes.minor).toBeDefined();
        expect(times).toBeDefined();
        
        // Data should be consistent
        expect(lunarPhase).toBe(LUNAR_PHASES[phaseData.phaseIndex]);
      });
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle multiple rapid calculations without issues', () => {
      const dates = Array.from({ length: 100 }, (_, i) => {
        const date = new Date('2024-01-01');
        date.setDate(date.getDate() + i);
        return date;
      });
      
      dates.forEach(date => {
        expect(() => {
          getMoonPhaseData(date);
          getLunarPhase(date);
          calculateBiteTimes(date, aucklandLocation.lat, aucklandLocation.lon);
          getSunMoonTimes(date, aucklandLocation);
        }).not.toThrow();
      });
    });

    it('should maintain accuracy across different time zones', () => {
      const utcDate = new Date('2024-06-15T12:00:00Z');
      const localDate = new Date('2024-06-15T12:00:00+12:00'); // NZST
      
      // Moon phase should be similar for dates close in time
      const utcPhase = getMoonPhaseData(utcDate);
      const localPhase = getMoonPhaseData(localDate);
      
      // Should be within 1 day of each other
      expect(Math.abs(utcPhase.phaseIndex - localPhase.phaseIndex)).toBeLessThanOrEqual(1);
    });
  });
});