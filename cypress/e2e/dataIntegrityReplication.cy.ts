describe('Data Integrity Contamination Reproduction Tests', () => {
  const USER1_EMAIL = 'user1@test.com';
  const USER1_PASSWORD = 'test123456';
  const USER2_EMAIL = 'user2@test.com';
  const USER2_PASSWORD = 'test123456';

  beforeEach(() => {
    // Clear all storage before each test
    cy.clearLocalStorage();
    cy.clearSessionStorage();
    cy.clearIndexedDB();
    
    // Clear service worker caches
    cy.window().then((win) => {
      if (win.caches) {
        return win.caches.keys().then(keys => {
          return Promise.all(keys.map(key => win.caches.delete(key)));
        });
      }
    });
  });

  it('should reproduce contamination scenario between user1 and user2', () => {
    // Step 1: User1 login and create data
    cy.visit('/');
    
    // Wait for app to load
    cy.get('body').should('be.visible');
    
    // Navigate to login
    cy.get('[data-testid="login-button"], [role="button"]').contains('Sign In').click();
    
    // Fill in user1 credentials
    cy.get('input[type="email"]').type(USER1_EMAIL);
    cy.get('input[type="password"]').type(USER1_PASSWORD);
    cy.get('button[type="submit"]').contains('Sign In').click();
    
    // Wait for successful login
    cy.get('[data-testid="user-menu"], .user-info').should('be.visible');
    cy.get('.success-notification').should('contain', 'Successfully signed in');
    
    // Create user1 data
    cy.window().then((win) => {
      // Add test data to localStorage
      win.localStorage.setItem('theme', 'dark');
      win.localStorage.setItem('userLocation', JSON.stringify({ lat: 40.7128, lng: -74.0060 }));
      win.localStorage.setItem('tacklebox', JSON.stringify([
        { id: 1, name: 'User1 Rod', type: 'spinning' }
      ]));
      win.localStorage.setItem('gearTypes', JSON.stringify(['User1-Gear-1', 'User1-Gear-2']));
      
      // Add modal state that might persist
      win.localStorage.setItem('pendingModal', 'settings');
      win.localStorage.setItem('settingsModalOpen', 'true');
      
      // Add to sessionStorage
      win.sessionStorage.setItem('authState', USER1_EMAIL);
      win.sessionStorage.setItem('tempData', 'user1-temp');
      
      console.log('User1 data created:', {
        localStorage: Object.keys(win.localStorage),
        sessionStorage: Object.keys(win.sessionStorage)
      });
    });
    
    // Verify user1 data exists
    cy.window().then((win) => {
      expect(win.localStorage.getItem('theme')).to.equal('dark');
      expect(win.localStorage.getItem('userLocation')).to.not.be.null;
      expect(JSON.parse(win.localStorage.getItem('tacklebox') || '[]')).to.have.length(1);
      expect(JSON.parse(win.localStorage.getItem('tacklebox') || '[]')[0]).to.have.property('name', 'User1 Rod');
    });
    
    // Navigate to calendar and create a trip
    cy.get('[data-testid="calendar"]').should('be.visible');
    cy.get('.calendar-day').first().click();
    
    // Create a test trip
    cy.get('[data-testid="create-trip-button"]').click();
    cy.get('input[placeholder*="Location"]').type('User1 Test Location');
    cy.get('input[placeholder*="Hours"]').type('4');
    cy.get('button[type="submit"]').contains('Save').click();
    
    // Wait for trip creation
    cy.get('.success-notification').should('contain', 'created');
    
    // Step 2: User1 logout (possibly incomplete cleanup)
    cy.get('[data-testid="user-menu"], .user-info').click();
    cy.get('[data-testid="logout-button"]').click();
    
    // Wait for logout to complete
    cy.get('[data-testid="login-button"], [role="button"]').contains('Sign In').should('be.visible');
    cy.get('.success-notification').should('contain', 'Signed out');
    
    // CRITICAL: Catalog what remains after logout
    cy.window().then((win) => {
      const persistedData = {
        localStorageKeys: Object.keys(win.localStorage),
        localStorageData: {},
        sessionStorageKeys: Object.keys(win.sessionStorage),
        sessionStorageData: {},
        urlHash: win.location.hash,
        urlPath: win.location.pathname
      };
      
      // Capture actual data
      Object.keys(win.localStorage).forEach(key => {
        persistedData.localStorageData[key] = win.localStorage.getItem(key);
      });
      
      Object.keys(win.sessionStorage).forEach(key => {
        persistedData.sessionStorageData[key] = win.sessionStorage.getItem(key);
      });
      
      console.log('=== USER1 POST-LOGOUT ARTIFACTS ===');
      console.log('localStorage keys:', persistedData.localStorageKeys);
      console.log('sessionStorage keys:', persistedData.sessionStorageKeys);
      console.log('URL hash:', persistedData.urlHash);
      
      // Save persisted data for analysis
      cy.wrap(persistedData).as('user1PostLogoutArtifacts');
    });
    
    // Verify potential contamination - this should reveal the issue
    cy.get('@user1PostLogoutArtifacts').then((artifacts: any) => {
      // These should ideally be empty for proper cleanup
      if (artifacts.localStorageKeys.length > 0) {
        console.log('⚠️ CONTAMINATION DETECTED - localStorage artifacts remain:', artifacts.localStorageKeys);
      }
      
      if (artifacts.sessionStorageKeys.length > 0) {
        console.log('⚠️ CONTAMINATION DETECTED - sessionStorage artifacts remain:', artifacts.sessionStorageKeys);
      }
    });
    
    // Step 3: User2 login
    cy.get('[data-testid="login-button"], [role="button"]').contains('Sign In').click();
    
    // Fill in user2 credentials
    cy.get('input[type="email"]').clear().type(USER2_EMAIL);
    cy.get('input[type="password"]').clear().type(USER2_PASSWORD);
    cy.get('button[type="submit"]').contains('Sign In').click();
    
    // Wait for successful login
    cy.get('[data-testid="user-menu"], .user-info').should('be.visible');
    cy.get('.success-notification').should('contain', 'Successfully signed in');
    
    // Check for cross-account contamination
    cy.window().then((win) => {
      const contaminationCheck = {
        hasUser1Theme: win.localStorage.getItem('theme') === 'dark',
        hasUser1Location: win.localStorage.getItem('userLocation') !== null,
        hasUser1Tacklebox: JSON.parse(win.localStorage.getItem('tacklebox') || '[]').length > 0,
        user1TackleboxContent: JSON.parse(win.localStorage.getItem('tacklebox') || '[]'),
        hasUser1ModalState: win.localStorage.getItem('pendingModal') !== null,
        localStorageKeys: Object.keys(win.localStorage),
        sessionStorageKeys: Object.keys(win.sessionStorage)
      };
      
      console.log('=== CROSS-ACCOUNT CONTAMINATION CHECK ===');
      console.log('User2 sees User1 data:', contaminationCheck);
      
      // Check if user2 is exposed to user1 data
      if (contaminationCheck.hasUser1Location) {
        console.log('🚨 CRITICAL: User2 exposed to User1 location data');
        cy.fail('Cross-account data contamination detected!');
      }
      
      if (contaminationCheck.hasUser1Tacklebox && contaminationCheck.user1TackleboxContent.length > 0) {
        console.log('🚨 CRITICAL: User2 exposed to User1 tacklebox data');
        cy.fail('Cross-account tacklebox contamination detected!');
      }
      
      if (contaminationCheck.hasUser1Theme) {
        console.log('🚨 CRITICAL: User2 exposed to User1 theme preference');
        cy.fail('Cross-account theme contamination detected!');
      }
    });
    
    // Verify user2 sees only their own data
    cy.window().then((win) => {
      // User2 should not see any user1 artifacts
      expect(win.localStorage.getItem('theme')).to.not.equal('dark');
      expect(win.localStorage.getItem('userLocation')).to.be.null;
      expect(JSON.parse(win.localStorage.getItem('tacklebox') || '[]')).to.have.length(0);
      expect(win.localStorage.getItem('pendingModal')).to.be.null;
    });
  });

  it('should catalog all persistence mechanisms and their cleanup behavior', () => {
    // This test focuses on cataloging every persistence mechanism
    cy.visit('/');
    
    // Create comprehensive test data
    cy.window().then((win) => {
      const testData = {
        // localStorage items
        'theme': 'dark',
        'userLocation': JSON.stringify({ lat: 40.7128, lng: -74.0060 }),
        'tacklebox': JSON.stringify([{ id: 1, name: 'Test Rod' }]),
        'gearTypes': JSON.stringify(['Spinner', 'Fly']),
        'pendingModal': 'settings',
        'settingsModalOpen': 'true',
        'cacheVersion': '1.0.0',
        
        // sessionStorage items
        'authState': 'test@example.com',
        'tempData': 'temporary-value',
        'wizardStep': '2',
        'analyticsSession': 'session-' + Date.now()
      };
      
      // Fill all storage mechanisms
      Object.entries(testData).forEach(([key, value]) => {
        win.localStorage.setItem(key, value);
      });
      
      // Add sessionStorage data
      win.sessionStorage.setItem('tempAuth', 'temp-token');
      win.sessionStorage.setItem('navigation', '{"from": "/login", "to": "/dashboard"}');
      
      console.log('Test data created:', Object.keys(testData));
    });
    
    // Simulate incomplete logout (current behavior before fix)
    cy.window().then((win) => {
      // Simulate the current logout procedure that might be incomplete
      console.log('=== CATALOGING CURRENT CLEANUP BEHAVIOR ===');
      
      const beforeCleanup = {
        localStorageKeys: Object.keys(win.localStorage),
        sessionStorageKeys: Object.keys(win.sessionStorage),
        localStorageData: {},
        sessionStorageData: {}
      };
      
      Object.keys(win.localStorage).forEach(key => {
        beforeCleanup.localStorageData[key] = win.localStorage.getItem(key);
      });
      
      Object.keys(win.sessionStorage).forEach(key => {
        beforeCleanup.sessionStorageData[key] = win.sessionStorage.getItem(key);
      });
      
      // Save for analysis
      cy.wrap(beforeCleanup).as('beforeCleanupCatalog');
    });
    
    // Try current cleanup method
    cy.window().then((win) => {
      // Simulate current incomplete cleanup (before our implementation)
      // This might only clear some keys but not all
      win.localStorage.removeItem('authState');
      win.localStorage.removeItem('tempAuth');
      // But miss other keys - simulating bug
    });
    
    // What remains after incomplete cleanup
    cy.get('@beforeCleanupCatalog').then((catalog: any) => {
      cy.window().then((win) => {
        const afterIncompleteCleanup = {
          remainingLocalStorageKeys: Object.keys(win.localStorage),
          remainingSessionStorageKeys: Object.keys(win.sessionStorage),
          contamination: {}
        };
        
        // Identify what wasn't cleaned
        catalog.localStorageKeys.forEach(key => {
          if (win.localStorage.getItem(key) !== null) {
            afterIncompleteCleanup.contamination[key] = {
              originalValue: catalog.localStorageData[key],
              currentValue: win.localStorage.getItem(key),
              isSensitive: ['theme', 'userLocation', 'tacklebox', 'gearTypes'].includes(key)
            };
          }
        });
        
        console.log('=== INCOMPLETE CLEANUP ANALYSIS ===');
        console.log('Remaining localStorage:', afterIncompleteCleanup.remainingLocalStorageKeys);
        console.log('Remaining sessionStorage:', afterIncompleteCleanup.remainingSessionStorageKeys);
        console.log('Contamination detected:', Object.keys(afterIncompleteCleanup.contamination).length, 'items');
        console.log('Sensitive contamination:', 
          Object.values(afterIncompleteCleanup.contamination).filter((item: any) => item.isSensitive).length, 'items');
        
        // This demonstrates the contamination issue
        expect(Object.keys(afterIncompleteCleanup.contamination)).to.have.length.greaterThan(0);
      });
    });
  });

  it('should verify clearUserState fixes contamination issues', () => {
    // Test that our clearUserState implementation solves the issues
    cy.visit('/');
    
    // Create test data for contamination scenario
    cy.window().then((win) => {
      const testData = {
        'theme': 'dark',
        'userLocation': JSON.stringify({ lat: 40.7128, lng: -74.0060 }),
        'tacklebox': JSON.stringify([{ id: 1, name: 'User1 Rod', user: 'user1' }]),
        'gearTypes': JSON.stringify(['User1-Gear-1', 'User1-Gear-2']),
        'pendingModal': 'settings',
        'analyticsSession': 'user1-session'
      };
      
      Object.entries(testData).forEach(([key, value]) => {
        win.localStorage.setItem(key, value);
      });
      
      win.sessionStorage.setItem('authState', 'user1@gmail.com');
      win.sessionStorage.setItem('tempData', 'user1-temp');
      
      console.log('Contamination test data created');
    });
    
    // Verify test data exists
    cy.window().then((win) => {
      expect(win.localStorage.getItem('theme')).to.equal('dark');
      expect(win.localStorage.getItem('userLocation')).to.not.be.null;
      expect(JSON.parse(win.localStorage.getItem('tacklebox') || '[]')).to.have.length(1);
    });
    
    // Apply our comprehensive clearUserState solution
    cy.window().then(async (win) => {
      try {
        const clearUserState = await import('../src/utils/userStateCleared').then(m => m.clearUserState);
        await clearUserState();
        console.log('clearUserState executed successfully');
      } catch (error) {
        console.error('Error executing clearUserState:', error);
        cy.fail('clearUserState should not throw errors');
      }
    });
    
    // Verify comprehensive cleanup worked
    cy.window().then((win) => {
      // All user-specific keys should be cleared
      expect(win.localStorage.getItem('theme')).to.be.null;
      expect(win.localStorage.getItem('userLocation')).to.be.null;
      expect(win.localStorage.getItem('tacklebox')).to.be.null;
      expect(win.localStorage.getItem('gearTypes')).to.be.null;
      expect(win.localStorage.getItem('pendingModal')).to.be.null;
      
      // SessionStorage should be completely cleared
      expect(Object.keys(win.sessionStorage)).to.have.length(0);
      
      console.log('✅ Comprehensive cleanup successful - no contamination remaining');
    });
  });
});
