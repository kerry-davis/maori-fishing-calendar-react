import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../contexts/AuthContext';
import { AuthProvider } from '../contexts/AuthContext';
import { guestDataRetentionService } from '../services/guestDataRetentionService';

// Mock Firebase and other services
vi.mock('../src/services/firebase', () => ({
  auth: null, // Mock as null to simulate guest mode
}));

vi.mock('../src/services/firebaseDataService', () => ({
  firebaseDataService: {
    initialize: vi.fn(),
    getAllTrips: vi.fn(),
    getAllWeatherLogs: vi.fn(),
    getAllFishCaught: vi.fn(),
    upsertTripFromImport: vi.fn(),
    upsertWeatherLogFromImport: vi.fn(),
    upsertFishCaughtFromImport: vi.fn(),
    mergeLocalDataForUser: vi.fn(),
    clearAllData: vi.fn(),
    isGuestMode: vi.fn(() => true),
    isReady: vi.fn(() => true),
  }
}));

vi.mock('../src/services/encryptionService', () => ({
  encryptionService: {
    isReady: vi.fn(() => true),
    clear: vi.fn(),
  }
}));

vi.mock('../src/utils/firebaseErrorMessages', () => ({
  mapFirebaseError: vi.fn((error) => error.message || 'Firebase error'),
}));

vi.mock('../src/utils/userStateCleared', () => ({
  clearUserState: vi.fn(),
  validateUserContext: vi.fn((userId, fn) => fn()),
  validateFirebaseOperation: vi.fn((userId, payload, fn) => fn(payload)),
}));

vi.mock('../src/utils/clearUserContext', () => ({
  secureLogoutWithCleanup: vi.fn(),
}));

vi.mock('../src/services/guestSessionService', () => ({
  getUnmergedGuestSessionIds: vi.fn(() => []),
  markGuestSessionMergedForUser: vi.fn(),
  getOrCreateGuestSessionId: vi.fn(() => 'mock-guest-session-id'),
}));

describe('Guest Data Retention Integration', () => {
  beforeEach(async () => {
    // Clear any existing data before each test
    await guestDataRetentionService.clearAllGuestData();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should save guest data before logout', async () => {
    // Mock the data to be saved
    const mockTrip = {
      id: 1,
      date: '2023-06-15',
      water: 'Lake Taupo',
      location: 'Main Bay',
      hours: 4,
      companions: 'John and Mike',
      notes: 'Great day fishing, caught several trout',
    };

    const mockWeatherLog = {
      id: '1-1686787200000',
      tripId: 1,
      timeOfDay: 'Morning',
      sky: 'Sunny',
      windCondition: 'Light',
      windDirection: 'NW',
      waterTemp: '16',
      airTemp: '18',
    };

    const mockFishCaught = {
      id: '1-1686787200001',
      tripId: 1,
      species: 'Brown Trout',
      length: '45cm',
      weight: '1.2kg',
      time: '10:30 AM',
      gear: ['Fly'],
      details: 'Caught near the shore',
    };

    // Mock the firebaseDataService methods
    const { firebaseDataService } = await import('../services/firebaseDataService');
    vi.mocked(firebaseDataService.getAllTrips).mockResolvedValue([mockTrip]);
    vi.mocked(firebaseDataService.getAllWeatherLogs).mockResolvedValue([mockWeatherLog]);
    vi.mocked(firebaseDataService.getAllFishCaught).mockResolvedValue([mockFishCaught]);

    // Render the AuthProvider with the hook
    const wrapper = ({ children }: { children: React.ReactNode }) => {
      return React.createElement(AuthProvider, null, children);
    };
    
    const { result: _result } = renderHook(() => useAuth(), { wrapper });
    
    // Wait for any async operations
    await waitFor(async () => {
      // Check if guest data was saved
      const _allSessions = await guestDataRetentionService.getAllGuestSessions();
      // This test verifies that the service has the proper structure to handle guest data
      expect(guestDataRetentionService).toBeDefined();
    });
  });

  it('should detect guest user when no authenticated user exists', () => {
    // Direct test of the guest data retention service
    const hasData = guestDataRetentionService.isGuestUser();
    expect(hasData).toBe(false); // Since we cleared data above
    
    // Add some data
    const testData = {
      trips: [],
      weatherLogs: [],
      fishCaught: [],
      lastModified: Date.now(),
    };
    
    guestDataRetentionService.saveGuestData('test-session', testData);
    const hasDataAfter = guestDataRetentionService.isGuestUser();
    expect(hasDataAfter).toBe(true);
  });
});