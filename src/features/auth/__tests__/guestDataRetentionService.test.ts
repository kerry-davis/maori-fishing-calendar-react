import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { guestDataRetentionService } from '@shared/services/guestDataRetentionService';
import type { Trip, WeatherLog, FishCaught } from '@shared/types';

// Mock data for testing
const mockTrip: Trip = {
  id: 1,
  date: '2023-06-15',
  water: 'Lake Taupo',
  location: 'Main Bay',
  hours: 4,
  companions: 'John and Mike',
  notes: 'Great day fishing, caught several trout',
  guestSessionId: 'test-session-1'
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
  guestSessionId: 'test-session-1'
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
  guestSessionId: 'test-session-1'
};

describe('guestDataRetentionService', () => {
  beforeEach(async () => {
    // Clear any existing data before each test
    await guestDataRetentionService.clearAllGuestData();
  });

  afterEach(() => {
    // Clean up localStorage after each test
    localStorage.clear();
  });

  it('should save and retrieve guest data', async () => {
    const testData = {
      trips: [mockTrip],
      weatherLogs: [mockWeatherLog],
      fishCaught: [mockFishCaught],
      lastModified: Date.now()
    };

  const sessionId = 'test-session-1';
  await guestDataRetentionService.saveGuestData(sessionId, testData);

  const retrievedData = await guestDataRetentionService.getGuestData(sessionId);
  expect(retrievedData).not.toBeNull();
  expect(retrievedData?.trips).toHaveLength(1);
  expect(retrievedData?.weatherLogs).toHaveLength(1);
  expect(retrievedData?.fishCaught).toHaveLength(1);
  expect(retrievedData?.trips[0].id).toBe(mockTrip.id);
  });

  it('should handle multiple guest sessions', async () => {
    const session1Data = {
      trips: [mockTrip],
      weatherLogs: [],
      fishCaught: [],
      lastModified: Date.now()
    };

    const session2Data = {
      trips: [],
      weatherLogs: [mockWeatherLog],
      fishCaught: [mockFishCaught],
      lastModified: Date.now()
    };

  await guestDataRetentionService.saveGuestData('session-1', session1Data);
  await guestDataRetentionService.saveGuestData('session-2', session2Data);

  const allSessions = await guestDataRetentionService.getAllGuestSessions();
  expect(Object.keys(allSessions.sessions)).toHaveLength(2);
  expect(allSessions.sessionOrder).toContain('session-1');
  expect(allSessions.sessionOrder).toContain('session-2');
  });

  it('should remove a specific guest session', async () => {
    const testData = {
      trips: [mockTrip],
      weatherLogs: [mockWeatherLog],
      fishCaught: [mockFishCaught],
      lastModified: Date.now()
    };

  await guestDataRetentionService.saveGuestData('session-to-remove', testData);
  await guestDataRetentionService.saveGuestData('session-to-keep', testData);

  let allSessions = await guestDataRetentionService.getAllGuestSessions();
  expect(Object.keys(allSessions.sessions)).toHaveLength(2);

  await guestDataRetentionService.removeGuestSession('session-to-remove');
  allSessions = await guestDataRetentionService.getAllGuestSessions();
  expect(Object.keys(allSessions.sessions)).toHaveLength(1);
  expect(allSessions.sessions['session-to-remove']).toBeUndefined();
  expect(allSessions.sessions['session-to-keep']).toBeDefined();
  });

  it('should clear all guest data', async () => {
    const testData = {
      trips: [mockTrip],
      weatherLogs: [mockWeatherLog],
      fishCaught: [mockFishCaught],
      lastModified: Date.now()
    };

  await guestDataRetentionService.saveGuestData('session-1', testData);
  await guestDataRetentionService.saveGuestData('session-2', testData);

  let allSessions = await guestDataRetentionService.getAllGuestSessions();
  expect(Object.keys(allSessions.sessions)).toHaveLength(2);

  await guestDataRetentionService.clearAllGuestData();
  allSessions = await guestDataRetentionService.getAllGuestSessions();
  expect(Object.keys(allSessions.sessions)).toHaveLength(0);
  });

  it('should detect guest user when data exists', async () => {
    const testData = {
      trips: [mockTrip],
      weatherLogs: [mockWeatherLog],
      fishCaught: [mockFishCaught],
      lastModified: Date.now()
    };

  await guestDataRetentionService.saveGuestData('test-session', testData);
  const isGuest = await guestDataRetentionService.isGuestUser();
  expect(isGuest).toBe(true);
  });

  it('should not detect guest user when no data exists', async () => {
  const isGuest = await guestDataRetentionService.isGuestUser();
  expect(isGuest).toBe(false);
  });

  it('should not return expired data', async () => {
    const testData = {
      trips: [mockTrip],
      weatherLogs: [mockWeatherLog],
      fishCaught: [mockFishCaught],
      lastModified: Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days ago (older than 30 day limit)
    };

    // Directly manipulate localStorage to simulate old data, since saveGuestData will update the timestamp
    const state = {
      activeSessionId: null,
      sessions: {
        'old-session': testData
      },
      sessionOrder: ['old-session']
    };
    
    localStorage.setItem('guestDataRetention', JSON.stringify(state));
    
  const retrievedData = await guestDataRetentionService.getGuestData('old-session');
  expect(retrievedData).toBeNull();
  });

  it('should limit number of stored sessions', async () => {
    // Create more sessions than the max limit
    for (let i = 0; i < 15; i++) {
      const testData = {
        trips: i % 2 === 0 ? [mockTrip] : [],
        weatherLogs: i % 2 === 1 ? [mockWeatherLog] : [],
        fishCaught: [mockFishCaught],
        lastModified: Date.now()
      };
      
  await guestDataRetentionService.saveGuestData(`session-${i}`, testData);
    }

  const allSessions = await guestDataRetentionService.getAllGuestSessions();
  expect(allSessions.sessionOrder.length).toBeLessThanOrEqual(10); // MAX_GUEST_SESSIONS
  });
});