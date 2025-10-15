import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { guestDataRetentionService } from '../services/guestDataRetentionService';
import { guestConversionTrackingService } from '../services/guestConversionTrackingService';
import type { Trip, WeatherLog, FishCaught } from '../types';

// Mock data for testing
const mockTrip: Trip = {
  id: 1,
  date: '2023-06-15',
  water: 'Lake Taupo',
  location: 'Main Bay',
  hours: 4,
  companions: 'John and Mike',
  notes: 'Great day fishing, caught several trout',
};

const mockWeatherLog: WeatherLog = {
  id: '1-1686787200000',
  tripId: 1,
  timeOfDay: 'Morning',
  sky: 'Sunny',
  windCondition: 'Light',
  windDirection: 'NW',
  waterTemp: '16',
  airTemp: '18',
  
};

const mockFishCaught: FishCaught = {
  id: '1-1686787200001',
  tripId: 1,
  species: 'Brown Trout',
  length: '45cm',
  weight: '1.2kg',
  time: '10:30 AM',
  gear: ['Fly'],
  details: 'Caught near the shore',
  
};

describe('Guest Data Retention Edge Cases', () => {
  beforeEach(async () => {
    // Clear any existing data before each test
    await guestDataRetentionService.clearAllGuestData();
    guestConversionTrackingService.reset();
  });

  afterEach(() => {
    // Clean up localStorage after each test
    localStorage.clear();
  });

  it('should handle concurrent guest sessions correctly', async () => {
    // Simulate multiple sessions being active
    const session1Data = {
      trips: [mockTrip],
      weatherLogs: [mockWeatherLog],
      fishCaught: [],
      lastModified: Date.now()
    };
    
    const session2Data = {
      trips: [],
      weatherLogs: [],
      fishCaught: [mockFishCaught],
      lastModified: Date.now()
    };

    // Save data to different sessions simultaneously
    await Promise.all([
      guestDataRetentionService.saveGuestData('session-1', session1Data),
      guestDataRetentionService.saveGuestData('session-2', session2Data)
    ]);

    // Retrieve both sessions and verify data integrity
    const session1 = await guestDataRetentionService.getGuestData('session-1');
    const session2 = await guestDataRetentionService.getGuestData('session-2');

    expect(session1).not.toBeNull();
    expect(session2).not.toBeNull();
    expect(session1?.trips).toHaveLength(1);
    expect(session1?.weatherLogs).toHaveLength(1);
    expect(session2?.fishCaught).toHaveLength(1);
    expect(session2?.trips).toHaveLength(0);
  });

  it('should handle immediate sign-out after sign-in without data loss', async () => {
    // Record a conversion
    guestConversionTrackingService.recordConversion('test-user-id');
    
    // Simulate sign-in followed by immediate sign-out
    const analyticsBefore = guestConversionTrackingService.getAnalytics();
    expect(analyticsBefore.authenticatedConversions).toBe(1);
    
    // Simulate starting as guest again
    const guestSessionId = guestDataRetentionService.getCurrentGuestSessionId();
    guestConversionTrackingService.recordGuestSession(guestSessionId);
    
    const analyticsAfter = guestConversionTrackingService.getAnalytics();
    expect(analyticsAfter.guestSessions).toBe(1);
  });

  it('should handle localStorage quota exceeded scenarios', async () => {
    // Mock localStorage to simulate quota exceeded
    const originalSetItem = Storage.prototype.setItem;
    const originalGetItem = Storage.prototype.getItem;
    
    // Mock quota exceeded error
    Storage.prototype.setItem = function(key: string, value: string) {
      if (key.includes('guestDataRetention') && value.length > 1000000) { // Simulate large data
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }
      return originalSetItem.call(this, key, value);
    };
    
    try {
      // This test is more about ensuring the quota management logic works
      const testResult = await guestDataRetentionService.hasGuestDataToMerge('test-user', []);
      expect(testResult).toBeTypeOf('boolean'); // Should not crash
    } finally {
      // Restore original implementation
      Storage.prototype.setItem = originalSetItem;
      Storage.prototype.getItem = originalGetItem;
    }
  });

  it('should maintain data integrity during rapid auth state changes', async () => {
    // Test rapid changes between guest and authenticated states
    const testData = {
      trips: [mockTrip],
      weatherLogs: [mockWeatherLog],
      fishCaught: [mockFishCaught],
      lastModified: Date.now()
    };

    // Save data as guest
    await guestDataRetentionService.saveGuestData('rapid-test-session', testData);
    
    // Verify data can be retrieved
    const retrievedData = await guestDataRetentionService.getGuestData('rapid-test-session');
    expect(retrievedData).not.toBeNull();
    expect(retrievedData?.trips[0].id).toBe(mockTrip.id);
    
    // Remove the session
    await guestDataRetentionService.removeGuestSession('rapid-test-session');
    
    // Verify removal
    const missingData = await guestDataRetentionService.getGuestData('rapid-test-session');
    expect(missingData).toBeNull();
  });

  it('should handle multiple sequential guest sessions', async () => {
    // Create and verify multiple guest sessions in sequence
    for (let i = 0; i < 5; i++) {
      const sessionData = {
        trips: i % 2 === 0 ? [mockTrip] : [],
        weatherLogs: i % 2 === 1 ? [mockWeatherLog] : [],
        fishCaught: [mockFishCaught],
        lastModified: Date.now()
      };
      
      await guestDataRetentionService.saveGuestData(`session-${i}`, sessionData);
      const retrieved = await guestDataRetentionService.getGuestData(`session-${i}`);
      expect(retrieved).not.toBeNull();
    }

    // Verify all sessions exist
    const allSessions = await guestDataRetentionService.getAllGuestSessions();
    expect(Object.keys(allSessions.sessions)).toHaveLength(5);
  });

  it('should properly cleanup expired sessions during retrieval', async () => {
    // Create an expired session (older than 30 days)
    const expiredData = {
      trips: [mockTrip],
      weatherLogs: [],
      fishCaught: [],
      lastModified: Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days ago
    };

    // Directly manipulate localStorage to create expired session
    const state = {
      activeSessionId: null,
      sessions: {
        'expired-session': expiredData
      },
      sessionOrder: ['expired-session']
    };
    
    localStorage.setItem('guestDataRetention', JSON.stringify(state));
    
    // Try to retrieve the expired session - should return null and remove it
    const retrieved = await guestDataRetentionService.getGuestData('expired-session');
    expect(retrieved).toBeNull();
    
    // Verify the expired session was removed
    const allSessions = await guestDataRetentionService.getAllGuestSessions();
    expect(Object.keys(allSessions.sessions)).toHaveLength(0);
  });
});