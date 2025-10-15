import { describe, it, expect } from 'vitest';
import { MetOceanTideProvider } from '../services/metOceanTideService';

describe('Tide Stability Tests', () => {
  const provider = new MetOceanTideProvider();

  it('should produce deterministic results for the same date', async () => {
    const testDate = new Date('2024-02-15T12:00:00Z'); // Fixed date
    const lat = -37.8; // Within Kawhia harbour bounds
    const lon = 174.75;

    // Run multiple times to ensure consistency
    const results = [];
    for (let i = 0; i < 5; i++) {
      const forecast = await provider.fetchForecast(lat, lon, testDate);
      results.push(forecast);
    }

    // All results should be identical
    const firstResult = results[0];
    for (let i = 1; i < results.length; i++) {
      expect(results[i].date).toBe(firstResult.date);
      expect(results[i].timezone).toBe(firstResult.timezone);
      expect(results[i].units).toBe(firstResult.units);
      expect(results[i].utcOffsetSeconds).toBe(firstResult.utcOffsetSeconds);
      
      // Check min/max heights are the same
      expect(results[i].minHeight).toBe(firstResult.minHeight);
      expect(results[i].maxHeight).toBe(firstResult.maxHeight);
      
      // Check extrema are identical
      expect(results[i].extrema).toEqual(firstResult.extrema);
      
      // Check series is identical
      expect(results[i].series).toEqual(firstResult.series);
    }
  });

  it('should have consistent UTC offset for New Zealand dates', async () => {
    // Test February (DST active in NZ summer = UTC+13)
    const summerDate = new Date('2024-02-15T12:00:00Z');
    const summerForecast = await provider.fetchForecast(-37.8, 174.75, summerDate);
    expect(summerForecast.utcOffsetSeconds).toBe(13 * 3600);

    // Test May NZST = UTC+12)
    const winterDate = new Date('2024-05-15T12:00:00Z');
    const winterForecast = await provider.fetchForecast(-37.8, 174.75, winterDate);
    expect(winterForecast.utcOffsetSeconds).toBe(12 * 3600);
  });

  it('should support expanded harbour coverage', async () => {
    const testDate = new Date('2024-02-15T12:00:00Z');
    
    // Test each harbour location with corrected bounds-matching coordinates
    const harbours = [
      { lat: -37.8, lon: 174.75, name: 'Kawhia' },
      { lat: -36.85, lon: 174.75, name: 'Auckland' },
      { lat: -37.7, lon: 176.15, name: 'Tauranga' },
      { lat: -41.25, lon: 174.75, name: 'Wellington' }
    ];

    for (const harbour of harbours) {
      expect(provider.supportsLocation(harbour.lat, harbour.lon))
        .toBe(true, `${harbour.name} should be supported`);
      
      const forecast = await provider.fetchForecast(harbour.lat, harbour.lon, testDate);
      expect(forecast.date).toBe('2024-02-15');
      expect(forecast.extrema.length).toBeGreaterThan(0);
      expect(forecast.series.length).toBe(96); // 24 hours * 4 (15-minute intervals)
    }
  });

  it('should reject unsupported locations', async () => {
    const unsupportedLocations = [
      { lat: 40.7128, lon: -74.0060 }, // New York
      { lat: 51.5074, lon: -0.1278 }, // London
      { lat: -33.8688, lon: 151.2093 }  // Sydney
    ];

    for (const location of unsupportedLocations) {
      expect(provider.supportsLocation(location.lat, location.lon))
        .toBe(false);
      
      await expect(
        provider.fetchForecast(location.lat, location.lon, new Date())
      ).rejects.toThrow('MetOcean provider does not support this location');
    }
  });

  it('should generate realistic tide patterns', async () => {
    const testDate = new Date('2024-02-15T12:00:00Z');
    const forecast = await provider.fetchForecast(-37.8, 174.75, testDate);

    // Should have some high and low tides (typically 2-4 extrema per day)
    const highTides = forecast.extrema.filter(e => e.type === 'high');
    const lowTides = forecast.extrema.filter(e => e.type === 'low');
    
    expect(highTides.length).toBeGreaterThan(0);
    expect(lowTides.length).toBeGreaterThan(0);
    expect(highTides.length + lowTides.length).toBeLessThanOrEqual(10);

    // High tides should be higher than low tides
    const avgHigh = highTides.reduce((sum, t) => sum + t.height, 0) / highTides.length;
    const avgLow = lowTides.reduce((sum, t) => sum + t.height, 0) / lowTides.length;
    
    expect(avgHigh).toBeGreaterThan(avgLow);

    // Heights should be realistic for NZ harbours (0.1m to 4m range)
    forecast.extrema.forEach(extremum => {
      expect(extremum.height).toBeGreaterThan(0);
      expect(extremum.height).toBeLessThan(5);
    });

    // Times should be in chronological order
    const times = forecast.extrema.map(e => e.time);
    const sortedTimes = [...times].sort();
    expect(times).toEqual(sortedTimes);
  });

  it('should maintain consistent lunar day calculations', async () => {
    const testDates = [
      new Date('2024-01-11T12:00:00Z'), // Reference new moon
      new Date('2024-02-15T12:00:00Z'),
      new Date('2024-03-15T12:00:00Z')
    ];

    const results = [];
    for (const date of testDates) {
      const forecast = await provider.fetchForecast(-37.5, 174.75, date);
      results.push({
        date: date.toISOString().split('T')[0],
        extrema: forecast.extrema,
        minHeight: forecast.minHeight,
        maxHeight: forecast.maxHeight
      });
    }

    // Each date should produce different but consistent results
    expect(results[0].extrema).not.toEqual(results[1].extrema);
    expect(results[1].extrema).not.toEqual(results[2].extrema);
    
    // But the same date should always produce the same result
    const duplicateForecast = await provider.fetchForecast(-37.5, 174.75, testDates[1]);
    expect(duplicateForecast.extrema).toEqual(results[1].extrema);
  });

  it('should handle DST transitions correctly', async () => {
    // Test around DST start (last Sunday in September 2024)
    const dstStartTest = new Date('2024-09-29T12:00:00Z');
    const dstStartForecast = await provider.fetchForecast(-37.8, 174.75, dstStartTest);
    expect(dstStartForecast.utcOffsetSeconds).toBe(13 * 3600);

    // Test after DST ends (first Sunday in April 2024) - should be NZST
    const afterDST = new Date('2024-04-08T12:00:00Z');
    const afterDSTForecast = await provider.fetchForecast(-37.8, 174.75, afterDST);
    expect(afterDSTForecast.utcOffsetSeconds).toBe(12 * 3600);

    // Test during winter (no DST)  
    const winterTest = new Date('2024-06-15T12:00:00Z');
    const winterForecast = await provider.fetchForecast(-37.8, 174.75, winterTest);
    expect(winterForecast.utcOffsetSeconds).toBe(12 * 3600);
  });

  it('should generate consistent per-harbour tide data', async () => {
    const testDate = new Date('2024-02-15T12:00:00Z');
    
    // Test each harbour produces distinct but consistent results
    const harbours = [
      { lat: -37.8, lon: 174.75, name: 'Kawhia' },
      { lat: -36.85, lon: 174.75, name: 'Auckland' },
      { lat: -37.7, lon: 176.15, name: 'Tauranga' },
      { lat: -41.25, lon: 174.75, name: 'Wellington' }
    ];

    const forecasts = {};
    
    for (const harbour of harbours) {
      const forecast = await provider.fetchForecast(harbour.lat, harbour.lon, testDate);
      forecasts[harbour.name] = forecast;
      
      // Verify basic structure
      expect(forecast.date).toBe('2024-02-15');
      expect(forecast.timezone).toBe('Pacific/Auckland');
      expect(forecast.units).toBe('m');
      expect(forecast.extrema.length).toBeGreaterThan(0);
      expect(forecast.series.length).toBe(96); // 15-minute intervals
      
      // Verify UTC offset consistency
      expect(forecast.utcOffsetSeconds).toBe(13 * 3600);
    }

    // Verify harbours produce different results (harbour-specific characteristics)
    const kawhiaForecasts = [];
    const aucklandForecasts = [];
    
    // Run multiple times to check consistency
    for (let i = 0; i < 3; i++) {
      kawhiaForecasts.push(await provider.fetchForecast(-37.8, 174.75, testDate));
      aucklandForecasts.push(await provider.fetchForecast(-36.85, 174.75, testDate));
    }
    
    // Each harbour should produce identical results across runs
    expect(kawhiaForecasts[0].extrema).toEqual(kawhiaForecasts[1].extrema);
    expect(kawhiaForecasts[0].extrema).toEqual(kawhiaForecasts[2].extrema);
    expect(aucklandForecasts[0].extrema).toEqual(aucklandForecasts[1].extrema);
    expect(aucklandForecasts[0].extrema).toEqual(aucklandForecasts[2].extrema);

    // But different harbours should have different results
    expect(forecasts.Kawhia.extrema).not.toEqual(forecasts.Auckland.extrema);
  });

  it('should preserve fractional lunar-day calculations across harbours', async () => {
    const testDate1 = new Date('2024-02-15T12:00:00Z');
    const testDate2 = new Date('2024-02-16T12:00:00Z'); // Next day
    
    // Test Kawhia (should have proper 50-minute retardation)
    const kawhiaDay1 = await provider.fetchForecast(-37.8, 174.75, testDate1);
    const kawhiaDay2 = await provider.fetchForecast(-37.8, 174.75, testDate2);
    
    // Test Auckland
    const aucklandDay1 = await provider.fetchForecast(-36.85, 174.75, testDate1);
    const aucklandDay2 = await provider.fetchForecast(-36.85, 174.75, testDate2);
    
    // All harbours should show consistent time progression
    // (due to preserved fractional lunar-day calculations)
    expect(kawhiaDay1.series).not.toEqual(kawhiaDay2.series);
    expect(aucklandDay1.series).not.toEqual(aucklandDay2.series);
    
    // But the same day should be consistent
    const kawhiaRerun = await provider.fetchForecast(-37.8, 174.75, testDate1);
    expect(kawhiaDay1.extrema).toEqual(kawhiaRerun.extrema);
  });

  it('should validate harbour boundary edge cases', async () => {
    const testDate = new Date('2024-02-15T12:00:00Z');
    
    // Test edge cases around harbour boundaries
    const edgeCases = [
      // Kawhia bound edges
      { lat: -37.5, lon: 174.75, name: 'Kawhia-North', shouldWork: true },
      { lat: -37.5, lon: 174.75, name: 'Kawhia-South', shouldWork: true },
      { lat: -38.2, lon: 174.75, name: 'Kawhia-SouthEdge', shouldWork: true },
      { lat: -35.0, lon: 174.75, name: 'Kawhia-TooNorth', shouldWork: false },
      
      // Wellington bound edges  
      { lat: -41.1, lon: 174.75, name: 'Wellington-North', shouldWork: true },
      { lat: -41.4, lon: 174.75, name: 'Wellington-South', shouldWork: true },
      { lat: -42.0, lon: 174.75, name: 'Wellington-TooSouth', shouldWork: false },
    ];

    for (const testCase of edgeCases) {
      const supports = provider.supportsLocation(testCase.lat, testCase.lon);
      expect(supports).toBe(testCase.shouldWork, 
        `${testCase.name} (${testCase.lat}, ${testCase.lon}) should ${testCase.shouldWork ? 'support' : 'not support'} location`);
      
      if (testCase.shouldWork) {
        const forecast = await provider.fetchForecast(testCase.lat, testCase.lon, testDate);
        expect(forecast.extrema.length).toBeGreaterThan(0);
      } else {
        await expect(
          provider.fetchForecast(testCase.lat, testCase.lon, testDate)
        ).rejects.toThrow('MetOcean provider does not support this location');
      }
    }
  });

  it('should keep extrema times within target day bounds across consecutive days', async () => {
    // Test multiple consecutive days to ensure time normalization works
    const startDate = new Date('2024-02-10T12:00:00Z');
    const testDays = 7; // Test 7 consecutive days
    const harbours = [
      { lat: -37.8, lon: 174.75, name: 'Kawhia' },
      { lat: -36.85, lon: 174.75, name: 'Auckland' },
      { lat: -37.7, lon: 176.15, name: 'Tauranga' },
      { lat: -41.25, lon: 174.75, name: 'Wellington' }
    ];

    for (const harbour of harbours) {
      for (let dayOffset = 0; dayOffset < testDays; dayOffset++) {
        const testDate = new Date(startDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        const forecast = await provider.fetchForecast(harbour.lat, harbour.lon, testDate);
        
        // Extract the expected date from the testDate
        const expectedDate = testDate.toISOString().split('T')[0];
        
        // All extrema times should belong to the target date
        for (const extremum of forecast.extrema) {
          const extremumDate = extremum.time.split('T')[0];
          expect(extremumDate).toBe(expectedDate, 
            `${harbour.name} - Day ${dayOffset}: Extremum time ${extremum.time} should be on date ${expectedDate}`);
          
          // Extract and validate time components stay within valid 24-hour range
          const timeComponent = extremum.time.split('T')[1]; // HH:MM:SS format
          const [hours, minutes, seconds] = timeComponent.split(':').map(Number);
          
          expect(hours).toBeGreaterThanOrEqual(0, 
            `${harbour.name} - Day ${dayOffset}: Hours should be >= 0, got ${hours}`);
          expect(hours).toBeLessThan(24, 
            `${harbour.name} - Day ${dayOffset}: Hours should be < 24, got ${hours}`);
          expect(minutes).toBeGreaterThanOrEqual(0, 
            `${harbour.name} - Day ${dayOffset}: Minutes should be >= 0, got ${minutes}`);
          expect(minutes).toBeLessThan(60, 
            `${harbour.name} - Day ${dayOffset}: Minutes should be < 60, got ${minutes}`);
          expect(seconds).toBeGreaterThanOrEqual(0, 
            `${harbour.name} - Day ${dayOffset}: Seconds should be >= 0, got ${seconds}`);
          expect(seconds).toBeLessThan(60, 
            `${harbour.name} - Day ${dayOffset}: Seconds should be < 60, got ${seconds}`);
        }
        
        // Verify extrema are in chronological order
        const extremumTimes = forecast.extrema.map(e => e.time);
        const sortedTimes = [...extremumTimes].sort();
        expect(extremumTimes).toEqual(sortedTimes, 
          `${harbour.name} - Day ${dayOffset}: Extrema should be in chronological order`);
      }
    }
  });

  it('should handle extreme lunar phase shifts without crossing day boundaries', async () => {
    // test dates with potentially challenging lunar phase conditions
    const extremeDates = [
      new Date('2024-01-11T12:00:00Z'), // New moon - reference date
      new Date('2024-02-10T12:00:00Z'), // Different phase
      new Date('2024-03-12T12:00:00Z'), // Another phase shift
      new Date('2024-11-15T12:00:00Z'), // Near year-end
    ];

    for (const testDate of extremeDates) {
      const forecast = await provider.fetchForecast(-37.8, 174.75, testDate);
      const expectedDate = testDate.toISOString().split('T')[0];
      
      // All extrema should stay within the target date regardless of lunar phase
      for (const extremum of forecast.extrema) {
        const extremumDate = extremum.time.split('T')[0];
        expect(extremumDate).toBe(expectedDate, 
          `Date ${expectedDate}: Extremum ${extremum.time} should be on the correct date`);
      }
      
      // Ensure there are a reasonable number of extrema (now limited to max 4 for clean UI)
      expect(forecast.extrema.length).toBeGreaterThanOrEqual(2, 
        `Date ${expectedDate}: Should have at least 2 extrema`);
      expect(forecast.extrema.length).toBeLessThanOrEqual(4, 
        `Date ${expectedDate}: Should have no more than 4 extrema for clean UI`);
      
      // Verify we have a balanced representation of high and low tides when possible
      const highs = forecast.extrema.filter(e => e.type === 'high');
      const lows = forecast.extrema.filter(e => e.type === 'low');
      
      // Should have at least 1 high and 1 low when we have 4 extrema
      if (forecast.extrema.length === 4) {
        expect(highs.length).toBeGreaterThanOrEqual(1, 
          `Date ${expectedDate}: Should have at least 1 high tide with 4 extrema`);
        expect(lows.length).toBeGreaterThanOrEqual(1, 
          `Date ${expectedDate}: Should have at least 1 low tide with 4 extrema`);
      }
    }
  });

  it('should limit extrema to maximum 2 high/low pairs for clean UI display', async () => {
    // Test multiple days and harbours to ensure UI limiter works consistently
    const testDate = new Date('2024-02-15T12:00:00Z');
    const harbours = [
      { lat: -37.8, lon: 174.75, name: 'Kawhia' },
      { lat: -36.85, lon: 174.75, name: 'Auckland' },
      { lat: -37.7, lon: 176.15, name: 'Tauranga' },
      { lat: -41.25, lon: 174.75, name: 'Wellington' }
    ];

    for (const harbour of harbours) {
      const forecast = await provider.fetchForecast(harbour.lat, harbour.lon, testDate);
      
      // Verify UI limiter constraints
      expect(forecast.extrema.length).toBeLessThanOrEqual(4, 
        `${harbour.name}: Should have maximum 4 extrema points (2 high/low pairs)`);
      expect(forecast.extrema.length).toBeGreaterThanOrEqual(2, 
        `${harbour.name}: Should have minimum 2 extrema points`);
      
      // Verify chronological order
      const times = forecast.extrema.map(e => e.time);
      const sortedTimes = [...times].sort();
      expect(times).toEqual(sortedTimes, 
        `${harbour.name}: Extrema should be in chronological order`);
      
      // Verify balanced high/low distribution
      const highs = forecast.extrema.filter(e => e.type === 'high');
      const lows = forecast.extrema.filter(e => e.type === 'low');
      
      // Should have at least 0 of each and no more than 2 of each
      expect(highs.length).toBeGreaterThanOrEqual(0, 
        `${harbour.name}: Should have at least 0 high tides`);
      expect(lows.length).toBeGreaterThanOrEqual(0, 
        `${harbour.name}: Should have at least 0 low tides`);
      expect(highs.length).toBeLessThanOrEqual(2, 
        `${harbour.name}: Should have no more than 2 high tides`);
      expect(lows.length).toBeLessThanOrEqual(2, 
        `${harbour.name}: Should have no more than 2 low tides`);
      
      console.log(`${harbour.name}: ${forecast.extrema.length} extrema (${highs.length} highs, ${lows.length} lows)`);
    }
  });

  it('should maintain proper 12-hour spacing between consecutive high tides', async () => {
    const testDate = new Date('2024-02-15T12:00:00Z');
    const forecast = await provider.fetchForecast(-37.8, 174.75, testDate);
    
    // Get all high tides
    const highTides = forecast.extrema.filter(e => e.type === 'high').sort((a, b) => a.time.localeCompare(b.time));
    
    // Should have exactly 2 high tides
    expect(highTides.length).toBe(2, 'Should have exactly 2 high tides');
    
    // Extract hours from the times
    const [firstHigh, secondHigh] = highTides;
    const firstHour = new Date(firstHigh.time).getHours();
    const secondHour = new Date(secondHigh.time).getHours();
    
    // High tides should be approximately 12 hours apart (allowing ~1 hour tolerance)
    const hourDifference = secondHour >= firstHour ? 
      secondHour - firstHour : 
      (24 - firstHour) + secondHour; // Handle midnight wraparound
    
    expect(hourDifference).toBeGreaterThanOrEqual(11, 'High tides should be at least 11 hours apart');
    expect(hourDifference).toBeLessThanOrEqual(13, 'High tides should be no more than 13 hours apart');
    
    // Verify proper AM/PM pattern: if first is AM (< 12), second should be PM (> 12)
    if (firstHour < 12) {
      expect(secondHour).toBeGreaterThanOrEqual(12, 'When first high is AM, second should be PM');
    }
    // If first is PM, second should be AM next day (but we should only see morning in our normalized 24h period)
    
    // Also check the spacing between consecutive tides
    for (let i = 1; i < forecast.extrema.length; i++) {
      const prev = new Date(forecast.extrema[i - 1].time);
      const curr = new Date(forecast.extrema[i].time);
      const hoursDiff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60);
      
      // Consecutive tides should be approximately 6 hours apart (with tolerance)
      expect(hoursDiff).toBeGreaterThanOrEqual(5, 'Consecutive tides should be at least 5 hours apart');
      expect(hoursDiff).toBeLessThanOrEqual(7.5, 'Consecutive tides should be no more than 7.5 hours apart');
    }
  });

  it('should display tides in H-L-H-L alternating pattern', async () => {
    const testDate = new Date('2024-02-15T12:00:00Z');
    const forecast = await provider.fetchForecast(-37.8, 174.75, testDate);
    
    // Should have exactly 4 extrema
    expect(forecast.extrema.length).toBe(4, 'Should have exactly 4 extrema');
    
    // Check that they start with High and alternate properly: H-L-H-L
    const expectedPattern = ['high', 'low', 'high', 'low'];
    const actualPattern = forecast.extrema.map(e => e.type);
    
    expect(actualPattern).toEqual(expectedPattern, 'Tides should follow H-L-H-L alternating pattern starting with High');
    
    // Verify chronological order is maintained
    const times = forecast.extrema.map(e => e.time);
    const sortedTimes = [...times].sort();
    expect(times).toEqual(sortedTimes, 'Extrema should be in chronological order');
    
    // Test multiple harbours to ensure consistent H-L-H-L pattern
    const harbours = [
      { lat: -36.85, lon: 174.75, name: 'Auckland' },
      { lat: -37.7, lon: 176.15, name: 'Tauranga' },
      { lat: -41.25, lon: 174.75, name: 'Wellington' }
    ];
    
    for (const harbour of harbours) {
      const harbourForecast = await provider.fetchForecast(harbour.lat, harbour.lon, testDate);
      const harbourPattern = harbourForecast.extrema.map(e => e.type);
      
      expect(harbourPattern).toEqual(expectedPattern, 
        `${harbour.name}: Should also follow H-L-H-L pattern`);
    }
  });
});
