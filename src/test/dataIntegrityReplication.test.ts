import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { databaseService } from '../services/databaseService';
import { firebaseDataService } from '../services/firebaseDataService';
import { encryptionService } from '../services/encryptionService';
import { clearUserState } from '../utils/userStateCleared';

// Mock storage mechanisms
const mockLocalStorage = {
  data: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockLocalStorage.data[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockLocalStorage.data[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockLocalStorage.data[key];
  }),
  clear: vi.fn(() => {
    mockLocalStorage.data = {};
  }),
  get length() {
    return Object.keys(mockLocalStorage.data).length;
  },
  key: vi.fn((index: number) => Object.keys(mockLocalStorage.data)[index] || null)
};

const mockSessionStorage = {
  data: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockSessionStorage.data[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    mockSessionStorage.data[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockSessionStorage.data[key];
  }),
  clear: vi.fn(() => {
    mockSessionStorage.data = {};
  })
};

// Mock location object
const mockLocation = {
  hash: '',
  pathname: '/test',
  replaceState: vi.fn()
};

// Setup global mocks
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
Object.defineProperty(window, 'sessionStorage', { value: mockSessionStorage });
Object.defineProperty(window, 'location', { value: mockLocation, writable: true });

describe('Data Integrity Contamination Replication Tests', () => {
  const USER1_DATA = {
    email: 'user1@test.com',
    uid: 'user1-uid-123',
    theme: 'dark',
    location: { lat: 40.7128, lng: -74.0060 },
    tacklebox: [{ id: 1, name: 'User1 Rod', type: 'spinning' }],
    gearTypes: ['User1-Gear-1', 'User1-Gear-2'],
    tripData: {
      date: '2024-01-01',
      water: 'Lake',
      location: 'User1 Location',
      hours: 4,
      companions: '',
      notes: 'User1 trip notes'
    }
  };

  const USER2_DATA = {
    email: 'user2@test.com',
    uid: 'user2-uid-456',
    theme: 'light',
    location: { lat: 37.7749, lng: -122.4194 },
    tacklebox: [{ id: 1, name: 'User2 Rod', type: 'casting' }],
    gearTypes: ['User2-Gear-1', 'User2-Gear-2']
  };

  beforeEach(() => {
    // Reset all mocks and storage
    vi.clearAllMocks();
    mockLocalStorage.clear();
    mockSessionStorage.clear();
    mockLocation.hash = '';
    mockLocation.pathname = '/test';
    
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Task 1: Reproduce Contamination Scenario', () => {
    it('should reproduce user1 to user2 contamination scenario', async () => {
      console.log('=== STARTING CONTAMINATION REPRODUCTION ===');
      
      // Step 1: Simulate User1 session with full data population
      
      console.log('Creating User1 session...');
      
      // Populate localStorage with User1 data
      mockLocalStorage.setItem('theme', USER1_DATA.theme);
      mockLocalStorage.setItem('userLocation', JSON.stringify(USER1_DATA.location));
      mockLocalStorage.setItem('tacklebox', JSON.stringify(USER1_DATA.tacklebox));
      mockLocalStorage.setItem('gearTypes', JSON.stringify(USER1_DATA.gearTypes));
      mockLocalStorage.setItem('pendingModal', 'settings');
      mockLocalStorage.setItem('settingsModalOpen', 'true');
      mockLocalStorage.setItem('lastActiveUser', USER1_DATA.email);
      
      // Populate sessionStorage with User1 data
      mockSessionStorage.setItem('authState', USER1_DATA.email);
      mockSessionStorage.setItem('tempData', 'user1-temp');
      mockSessionStorage.setItem('wizardStep', '3');
      
      // Add modal state in URL
      mockLocation.hash = '#settings';
      
      // Mock IndexedDB data (simulate trip creation)
      const mockDatabaseClearAll = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(databaseService, 'clearAllData').mockImplementation(mockDatabaseClearAll);
      
      // Mock Firebase data service  
      const mockFirebaseSwitchToUser = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(firebaseDataService, 'switchToUser').mockImplementation(mockFirebaseSwitchToUser);
      const mockFirebaseCreateTrip = vi.fn().mockResolvedValue(123);
      vi.spyOn(firebaseDataService, 'createTrip').mockImplementation(mockFirebaseCreateTrip);
      
      // Initialize Firebase services for User1
      await firebaseDataService.initialize(USER1_DATA.uid);
      
      // Create User1 trip data
      await firebaseDataService.createTrip(USER1_DATA.tripData);
      
      console.log('User1 session created with data:', {
        localStorageKeys: Object.keys(mockLocalStorage.data),
        sessionStorageKeys: Object.keys(mockSessionStorage.data),
        urlHash: mockLocation.hash
      });
      
      // Verify User1 data exists
      expect(mockLocalStorage.getItem('theme')).toBe(USER1_DATA.theme);
      expect(JSON.parse(mockLocalStorage.getItem('userLocation') || '{}')).toEqual(USER1_DATA.location);
      expect(JSON.parse(mockLocalStorage.getItem('tacklebox') || '[]')).toEqual(USER1_DATA.tacklebox);
      expect(mockSessionStorage.getItem('authState')).toBe(USER1_DATA.email);
      expect(mockLocation.hash).toBe('#settings');
      
      console.log('✅ User1 session verified');
      
      // Step 2: Simulate incomplete logout (current behavior before fix)
      console.log('Simulating incomplete logout...');
      
      // This simulates the current incomplete logout behavior
      // Only clears some keys, leaving others (the bug)
      mockLocalStorage.removeItem('authState');
      mockLocalStorage.removeItem('tempAuth');
      mockSessionStorage.removeItem('authState');
      
      // Key: The incomplete cleanup misses user-specific data
      const user1PostLogoutArtifacts = {
        localStorageKeys: Object.keys(mockLocalStorage.data),
        localStorageData: { ...mockLocalStorage.data },
        sessionStorageKeys: Object.keys(mockSessionStorage.data),
        sessionStorageData: { ...mockSessionStorage.data },
        urlHash: mockLocation.hash
      };
      
      console.log('=== USER1 POST-LOGOUT ARTIFACTS ===');
      console.log('Remaining localStorage keys:', user1PostLogoutArtifacts.localStorageKeys);
      console.log('Remaining sessionStorage keys:', user1PostLogoutArtifacts.sessionStorageKeys);
      console.log('URL hash:', user1PostLogoutArtifacts.urlHash);
      
      // CRITICAL: Catalog what remains after logout
      const contaminationAnalysis = {
        contaminatedKeys: [] as string[],
        sensitiveDataLeakage: {} as Record<string, any>,
        modalStateLeakage: false,
        userPreferenceLeakage: false,
        userDataLeakage: false
      };
      
      // Analyze each remaining key for potential contamination
      user1PostLogoutArtifacts.localStorageKeys.forEach(key => {
        const value = user1PostLogoutArtifacts.localStorageData[key];
        
        // Check for sensitive data leakage
        if (['userLocation', 'tacklebox', 'gearTypes'].includes(key)) {
          contaminationAnalysis.contaminatedKeys.push(key);
          contaminationAnalysis.sensitiveDataLeakage[key] = {
            value,
            risk: 'HIGH',
            type: 'USER_PII_OR_PERSONAL_DATA'
          };
          contaminationAnalysis.userDataLeakage = true;
        }
        
        if (['theme'].includes(key)) {
          contaminationAnalysis.contaminatedKeys.push(key);
          contaminationAnalysis.sensitiveDataLeakage[key] = {
            value,
            risk: 'MEDIUM',
            type: 'USER_PREFERENCE'
          };
          contaminationAnalysis.userPreferenceLeakage = true;
        }
        
        if (['pendingModal', 'settingsModalOpen'].includes(key)) {
          contaminationAnalysis.contaminatedKeys.push(key);
          contaminationAnalysis.sensitiveDataLeakage[key] = {
            value,
            risk: 'LOW',
            type: 'UI_STATE'
          };
          contaminationAnalysis.modalStateLeakage = true;
        }
      });
      
      console.log('=== CONTAMINATION ANALYSIS ===');
      console.log('Total contaminated keys:', contaminationAnalysis.contaminatedKeys.length);
      console.log('Sensitive data leakage:', contaminationAnalysis.userDataLeakage);
      console.log('User preference leakage:', contaminationAnalysis.userPreferenceLeakage);
      console.log('Modal state leakage:', contaminationAnalysis.modalStateLeakage);
      console.log('Detailed analysis:', contaminationAnalysis.sensitiveDataLeakage);
      
      // Verify contamination exists (this demonstrates the bug)
      expect(contaminationAnalysis.contaminatedKeys.length).toBeGreaterThan(0);
      expect(contaminationAnalysis.userDataLeakage).toBe(true);
      expect(contaminationAnalysis.userPreferenceLeakage).toBe(true);
      
      console.log('🚨 CONTAMINATION CONFIRMED:', contaminationAnalysis.contaminatedKeys, 'keys leaked');
      
      // Step 3: Simulate User2 login and check cross-account exposure
      console.log('Creating User2 session...');
      
      // Initialize Firebase services for User2
      await firebaseDataService.initialize(USER2_DATA.uid);
      
      console.log('=== CROSS-ACCOUNT EXPOSURE TEST ===');
      
      // Check if User2 is exposed to User1 data
      const crossAccountCheck = {
        exposesUser1Location: mockLocalStorage.getItem('userLocation') !== null,
        exposesUser1Tacklebox: JSON.parse(mockLocalStorage.getItem('tacklebox') || '[]').length > 0,
        exposesUser1Theme: mockLocalStorage.getItem('theme') === USER1_DATA.theme,
        exposesUser1ModalState: mockLocalStorage.getItem('pendingModal') !== null,
        contaminationKeys: contaminationAnalysis.contaminatedKeys,
        riskLevel: 'HIGH'
      };
      
      console.log('Cross-account exposure results:', crossAccountCheck);
      
      // Verify User2 is NOT exposed to User1 data (this test shows the bug)
      if (crossAccountCheck.exposesUser1Location) {
        console.log('🚨 CRITICAL: User2 exposed to User1 location data');
        console.log('User1 location data:', JSON.parse(mockLocalStorage.getItem('userLocation') || '{}'));
        expect.fail('CRITICAL: Cross-account location data contamination detected!');
      }
      
      if (crossAccountCheck.exposesUser1Tacklebox) {
        console.log('🚨 CRITICAL: User2 exposed to User1 tacklebox data');
        console.log('User1 tacklebox:', JSON.parse(mockLocalStorage.getItem('tacklebox') || '[]'));
        expect.fail('CRITICAL: Cross-account tacklebox data contamination detected!');
      }
      
      if (crossAccountCheck.exposesUser1Theme) {
        console.log('🚨 CRITICAL: User2 exposed to User1 theme preference');
        console.log('User1 theme:', mockLocalStorage.getItem('theme'));
        expect.fail('CRITICAL: Cross-account theme preference contamination detected!');
      }
      
      console.log('✅ Cross-account test completed - contamination reproduced successfully');
    });
  });

  describe('Verify clearUserState Solution', () => {
    it('should verify clearUserState fixes all contamination issues', async () => {
      console.log('=== VERIFYING clearUserState SOLUTION ===');
      
      // Recreate the contaminated scenario
      const contaminatedData = {
        theme: USER1_DATA.theme,
        userLocation: JSON.stringify(USER1_DATA.location),
        tacklebox: JSON.stringify(USER1_DATA.tacklebox),
        gearTypes: JSON.stringify(USER1_DATA.gearTypes),
        pendingModal: 'settings',
        lastActiveUser: USER1_DATA.email
      };
      
      // Populate with contaminated data
      Object.entries(contaminatedData).forEach(([key, value]) => {
        mockLocalStorage.setItem(key, value);
      });
      
      mockSessionStorage.setItem('authState', USER1_DATA.email);
      mockSessionStorage.setItem('tempData', 'user1-temp');
      mockLocation.hash = '#settings-modal';
      
      console.log('Contaminated state created:', {
        localStorageEntries: Object.keys(mockLocalStorage.data).length,
        sessionStorageEntries: Object.keys(mockSessionStorage.data).length,
        urlHash: mockLocation.hash
      });
      
      // Verify contaminated state exists
      expect(mockLocalStorage.getItem('theme')).toBe(USER1_DATA.theme);
      expect(mockLocalStorage.getItem('userLocation')).to.not.be.null;
      expect(JSON.parse(mockLocalStorage.getItem('tacklebox') || '[]')).toEqual(USER1_DATA.tacklebox);
      expect(mockSessionStorage.getItem('authState')).toBe(USER1_DATA.email);
      expect(mockLocation.hash).toBe('#settings-modal');
      
      console.log('✅ Contaminated state verified');
      
      // Apply our comprehensive clearUserState solution
      console.log('Applying clearUserState solution...');
      
      const mockDatabaseClear = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(databaseService, 'clearAllData').mockImplementation(mockDatabaseClear);
      
      const mockEncryptionClear = vi.fn();
      vi.spyOn(encryptionService, 'clear').mockImplementation(mockEncryptionClear);
      
      const mockFirebaseClearQueue = vi.fn();
      vi.spyOn(firebaseDataService, 'clearSyncQueue').mockImplementation(mockFirebaseClearQueue);
      
      await clearUserState();
      
      console.log('clearUserState executed');
      
      // Verify comprehensive cleanup
      const postCleanupState = {
        localStorageKeys: Object.keys(mockLocalStorage.data),
        sessionStorageKeys: Object.keys(mockSessionStorage.data),
        localStorageData: mockLocalStorage.data,
        sessionStorageData: mockSessionStorage.data,
        urlHash: mockLocation.hash
      };
      
      console.log('=== POST-CLEANUP STATE VERIFICATION ===');
      console.log('Remaining localStorage keys:', postCleanupState.localStorageKeys);
      console.log('Remaining sessionStorage keys:', postCleanupState.sessionStorageKeys);
      console.log('URL hash:', postCleanupState.urlHash);
      
      // Verify complete cleanup
      expect(postCleanupState.localStorageKeys.length).toBe(0);
      expect(postCleanupState.sessionStorageKeys.length).toBe(0);
      
      // All sensitive data should be cleared
      expect(mockLocalStorage.getItem('theme')).toBe(null);
      expect(mockLocalStorage.getItem('userLocation')).toBe(null);
      expect(mockLocalStorage.getItem('tacklebox')).toBe(null);
      expect(mockLocalStorage.getItem('gearTypes')).toBe(null);
      expect(mockLocalStorage.getItem('pendingModal')).toBe(null);
      expect(mockLocalStorage.getItem('lastActiveUser')).toBe(null);
      
      // SessionStorage should be completely cleared
      expect(mockSessionStorage.getItem('authState')).toBe(null);
      expect(mockSessionStorage.getItem('tempData')).toBe(null);
      
      // Verify cleanup operations were called
      expect(mockDatabaseClear).toHaveBeenCalled();
      expect(mockEncryptionClear).toHaveBeenCalled();
      expect(mockFirebaseClearQueue).toHaveBeenCalled();
      
      console.log('✅ ClearUserState solution verified - no contamination remaining');
      
      // Test that new user (User2) sees clean state
      console.log('Testing User2 clean session...');
      
      // User2 creates their data
      mockLocalStorage.setItem('theme', USER2_DATA.theme);
      mockLocalStorage.setItem('userLocation', JSON.stringify(USER2_DATA.location));
      mockSessionStorage.setItem('authState', USER2_DATA.email);
      
      // Verify User2 sees only their data
      expect(mockLocalStorage.getItem('theme')).toBe(USER2_DATA.theme);
      expect(JSON.parse(mockLocalStorage.getItem('userLocation') || '{}')).toEqual(USER2_DATA.location);
      expect(mockSessionStorage.getItem('authState')).toBe(USER2_DATA.email);
      
      // And NOT User1 data
      expect(mockLocalStorage.getItem('theme')).to.not.be(USER1_DATA.theme);
      expect(mockLocalStorage.getItem('tacklebox')).toBe(null); // User1's data should be gone
      expect(mockLocalStorage.getItem('gearTypes')).toBe(null); // User1's data should be gone
      
      console.log('✅ User2 clean session verified');
      console.log('✅ Cross-account contamination prevention verified');
    });
  });
});
