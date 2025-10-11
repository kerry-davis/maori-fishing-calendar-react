describe('Multi-Account Data Integrity Tests', () => {
  const users = {
    user1: {
      email: 'fishing-user1@example.com',
      password: 'Test123456!',
      uid: 'test-user-1-uid',
      displayName: 'Fisher One'
    },
    user2: {
      email: 'fishing-user2@example.com', 
      password: 'Test123456!',
      uid: 'test-user-2-uid',
      displayName: 'Fisher Two'
    },
    user3: {
      email: 'fishing-user3@example.com',
      password: 'Test123456!', 
      uid: 'test-user-3-uid',
      displayName: 'Fisher Three'
    }
  };

  beforeEach(() => {
    // Clear all storage before each test
    cy.clearLocalStorage();
    cy.clearSessionStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
      win.localStorage.clear();
    });
    
    // Clear IndexedDB
    cy.window().then((win) => {
      if (win.indexedDB) {
        win.indexedDB.databases().then((databases: any[]) => {
          databases.forEach(db => {
            win.indexedDB.deleteDatabase(db.name);
          });
        });
      }
    });

    // Clear service worker caches
    cy.window().then((win) => {
      if (win.caches) {
        return win.caches.keys().then(cacheNames => {
          return Promise.all(cacheNames.map(cacheName => win.caches.delete(cacheName)));
        });
      }
    });
  });

  /**
   * Test: Basic multi-account isolation
   * Verifies that user1 data is completely isolated from user2
   */
  it('should prevent cross-account data contamination', () => {
    // Login as User 1 and create data
    cy.loginFirebase(users.user1.email, users.user1.password);
    
    // Create trip data for User 1
    cy.visit('/');
    cy.get('[data-testid="add-trip-button"]').click();
    cy.get('[data-testid="water-input"]').type('Lake Superior');
    cy.get('[data-testid="location-input"]').type('Duluth, MN');
    cy.get('[data-testid="save-trip-button"]').click();
    cy.wait(1000);

    // Verify User 1 data exists
    cy.get('[data-testid="trips-list"]').should('contain', 'Lake Superior');
    
    // Logout User 1
    cy.logoutFirebase();
    cy.wait(2000);
    
    // Verify all localStorage is cleared
    cy.window().then((win) => {
      const keys = Object.keys(win.localStorage);
      const userSpecificKeys = keys.filter(key => 
        key.includes('user') || key.includes('tacklebox') || key.includes('gearTypes')
      );
      expect(userSpecificKeys).to.have.length(0);
    });

    // Login as User 2
    cy.loginFirebase(users.user2.email, users.user2.password);
    cy.visit('/');
    
    // Verify User 2 sees no trip data (User 1's data should be gone)
    cy.get('[data-testid="trips-list"]').should('not.contain', 'Lake Superior');
    cy.get('[data-testid="no-trips-message"]').should('be.visible');
    
    // Create different data for User 2
    cy.get('[data-testid="add-trip-button"]').click();
    cy.get('[data-testid="water-input"]').type('Lake Michigan');
    cy.get('[data-testid="location-input"]').type('Chicago, IL');
    cy.get('[data-testid="save-trip-button"]').click();
    cy.wait(1000);

    // Verify User 2 sees their own data
    cy.get('[data-testid="trips-list"]').should('contain', 'Lake Michigan');
    cy.get('[data-testid="trips-list"]').should('not.contain', 'Lake Superior');
    
    // Logout User 2
    cy.logoutFirebase();
  });

  /**
   * Test: Rapid account switching
   * Verifies that rapid logins/logouts don't leave state artifacts
   */
  it('should handle rapid account switching without contamination', () => {
    // Quick succession login attempts
    const testSequence = async () => {
      for (let i = 0; i < 5; i++) {
        // Login User 1
        cy.loginFirebase(users.user1.email, users.user1.password);
        cy.wait(1000);
        
        // Create quick data
        cy.visit('/');
        cy.get('[data-testid="theme-toggle"]').click();
        cy.wait(500);
        
        // Logout
        cy.logoutFirebase();
        cy.wait(500);
        
        // Login User 2  
        cy.loginFirebase(users.user2.email, users.user2.password);
        cy.wait(1000);
        
        // Verify no User 1 data
        cy.window().then((win) => {
          const theme = win.localStorage.getItem('theme');
          expect(theme).to.be.null;
        });
        
        // Logout
        cy.logoutFirebase();
        cy.wait(500);
      }
    };

    testSequence();
    
    // Final verification: no artifacts remain
    cy.window().then((win) => {
      const allKeys = Object.keys(win.localStorage);
      const suspiciousKeys = allKeys.filter(key => 
        key.includes(users.user1.uid) || 
        key.includes(users.user2.uid) ||
        key.includes('modal') ||
        key.includes('pending')
      );
      expect(suspiciousKeys).to.have.length(0);
    });
  });

  /**
   * Test: Modal state persistence across logout
   * Verifies modal state doesn't persist between users
   */
  it('should not persist modal state across user changes', () => {
    // Login User 1
    cy.loginFirebase(users.user1.email, users.user1.password);
    cy.visit('/');
    
    // Open and interact with modals
    cy.get('[data-testid="settings-button"]').click();
    cy.get('[data-testid="settings-modal"]').should('be.visible');
    
    // Set some modal state
    cy.get('[data-testid="theme-input"]').select('dark');
    cy.get('[data-testid="save-settings-button"]').click();
    cy.wait(500);
    
    // Close modal and logout
    cy.get('[data-testid="modal-close-button"]').click();
    cy.logoutFirebase();
    cy.wait(2000);
    
    // Login User 2
    cy.loginFirebase(users.user2.email, users.user2.password);
    cy.visit('/');
    
    // Verify modal state is reset
    cy.get('[data-testid="theme-input"]').should('have.value', 'light');
    cy.get('[data-testid="settings-button"]').click();
    cy.get('[data-testid="theme-input"]').should('have.value', 'light');
    cy.get('[data-testid="settings-modal"]').should('be.visible');
    
    // Close modal
    cy.get('[data-testid="modal-close-button"]').click();
  });

  /**
   * Test: Concurrent session handling
   * Verifies multiple tabs/sessions don't interfere
   */
  it('should handle concurrent sessions correctly', () => {
    // Open User 1 in original window
    cy.loginFirebase(users.user1.email, users.user1.password);
    cy.visit('/');
    
    // Create trip data
    cy.get('[data-testid="add-trip-button"]').click();
    cy.get('[data-testid="water-input"]').type('Lake One');
    cy.get('[data-testid="save-trip-button"]').click();
    cy.wait(1000);
    
    // Open new tab with User 2 (simulate concurrent session)
    cy.window().then((win) => {
      win.open('/', '_blank');
    });
    
    // Switch focus to new tab and login User 2
    cy.get('@newTab').within(() => {
      cy.loginFirebase(users.user2.email, users.user2.password);
      cy.visit('/');
      
      // Verify User 2 data is isolated
      cy.get('[data-testid="trips-list"]').should('not.contain', 'Lake One');
      
      // Add User 2 data
      cy.get('[data-testid="add-trip-button"]').click();
      cy.get('[data-testid="water-input"]').type('Lake Two');
      cy.get('[data-testid="save-trip-button"]').click();
      cy.wait(1000);
    });
    
    // Go back to original tab and verify User 1 data intact
    cy.get('@originalTab').within(() => {
      cy.get('[data-testid="trips-list"]').should('contain', 'Lake One');
      cy.get('[data-testid="trips-list"]').should('not.contain', 'Lake Two');
    });
    
    // Cleanup
    cy.logoutFirebase();
  });

  /**
   * Test: Storage leak detection
   * Comprehensive check for any storage leaks after logout
   */
  it('should not have storage leaks after logout', () => {
    // Login and create comprehensive user state
    cy.loginFirebase(users.user1.email, users.user1.password);
    cy.visit('/');
    
    // Create trips
    cy.get('[data-testid="add-trip-button"]').click();
    cy.get('[data-testid="water-input"]').type('Storage Leak Test Lake');
    cy.get('[data-testid="location-input"]').type('Test Location');
    cy.get('[data-testid="save-trip-button"]').click();
    cy.wait(1000);
    
    // Create weather log
    cy.get('[data-testid="add-weather-button"]').click();
    cy.get('[data-testid="temperature-input"]').type('72');
    cy.get('[data-testid="save-weather-button"]').click();
    cy.wait(1000);
    
    // Open multiple modals
    cy.get('[data-testid="settings-button"]').click();
    cy.get('[data-testid="gallery-button"]').click();
    
    // Change theme
    cy.get('[data-testid="theme-toggle"]').click();
    
    // Navigate to different routes
    cy.visit('/gallery');
    cy.visit('/analytics');
    
    // Perform logout
    cy.logoutFirebase();
    cy.wait(3000);
    
    // Comprehensive storage inspection
    cy.window().then((win) => {
      // Check localStorage
      const localStorageKeys = Object.keys(win.localStorage);
      console.log('localStorage keys after logout:', localStorageKeys);
      
      // Check for suspicious keys
      const suspiciousKeys = localStorageKeys.filter(key => 
        key.includes('user') ||
        key.includes('tacklebox') ||
        key.includes('gear') ||
        key.includes('modal') ||
        key.includes('pending') ||
        key.includes('temp') ||
        key.includes('trip') ||
        key.includes('weather')
      );
      
      expect(suspiciousKeys, 'Found suspicious localStorage keys').to.have.length(0);
      
      // Check sessionStorage
      const sessionStorageKeys = Object.keys(win.sessionStorage);
      console.log('sessionStorage keys after logout:', sessionStorageKeys);
      
      const suspiciousSessionKeys = sessionStorageKeys.filter(key =>
        key.includes('user') ||
        key.includes('modal') ||
        key.includes('pending')
      );
      
      expect(suspiciousSessionKeys, 'Found suspicious sessionStorage keys').to.have.length(0);
      
      // Check URL hash
     cy.url().should('not.include', '#modal');
      cy.url().should('not.include', '#settings');
      cy.url().should('not.include', '#trip');
      
      // Check document title
      cy.title().should('not.include', '(');
    });
    
    // Verify fresh state
    cy.visit('/');
    cy.get('[data-testid="no-trips-message"]').should('be.visible');
    cy.get('[data-testid="theme-input"]').should('have.value', 'light');
  });

  /**
   * Test: Security validation
   * Verifies security measures prevent unauthorized access
   */
  it('should enforce security boundaries', () => {
    // Login User 1 and create sensitive data
    cy.loginFirebase(users.user1.email, users.user1.password);
    cy.visit('/');
    
    cy.get('[data-testid="add-trip-button"]').click();
    cy.get('[data-testid="water-input"]').type('Secret Fishing Spot');
    cy.get('[data-testid="location-input"]').type('Secret Location');
    cy.get('[data-testid="save-trip-button"]').click();
    cy.wait(1000);
    
    // Logout
    cy.logoutFirebase();
    
    // Try to access User 1 data via direct URL manipulation
    cy.visit('/trips/1');
    cy.get('[data-testid="unauthorized-message"]').should('be.visible');
    
    // Try accessing API endpoints directly (should fail)
    cy.request({
      method: 'GET',
      url: '/api/trips',
      failOnStatusCode: false
    }).then((response) => {
      expect(response.status).to.be.greaterThan(399);
    });
    
    // Login User 2
    cy.loginFirebase(users.user2.email, users.user2.password);
    cy.visit('/');
    
    // Verify User 2 cannot see User 1's secret data
    cy.get('[data-testid="trips-list"]').should('not.contain', 'Secret Fishing Spot');
    cy.get('[data-testid="trips-list"]').should('not.contain', 'Secret Location');
    
    // Try accessing User 1's data directly
    cy.visit('/trips/1');
    cy.get('[data-testid="data-not-found-message"]').should('be.visible');
  });

  /**
   * Test: Performance under stress
   * Rapid multi-account switching with large datasets
   */
  it('should maintain performance under stress', () => {
    // Create large user datasets
    const createLargeDataset = (user, tripCount = 50) => {
      cy.loginFirebase(user.email, user.password);
      cy.visit('/');
      
      for (let i = 0; i < tripCount; i++) {
        cy.get('[data-testid="add-trip-button"]').click();
        cy.get('[data-testid="water-input"]').type(`${user.displayName} Lake ${i + 1}`);
        cy.get('[data-testid="location-input"]').type(`Location ${i + 1}`);
        cy.get('[data-testid="save-trip-button"]').click();
        cy.wait(100);
      }
      
      cy.logoutFirebase();
    };
    
    // Stress test
    createLargeDataset(users.user1, 20);
    createLargeDataset(users.user2, 20);
    createLargeDataset(users.user3, 20);
    
    // Rapid switching test
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      cy.loginFirebase(users.user1.email, users.user1.password);
      cy.visit('/');
      cy.get('[data-testid="trips-list"]').should('contain', 'Fisher One Lake');
      cy.logoutFirebase();
      
      cy.loginFirebase(users.user2.email, users.user2.password);
      cy.visit('/');
      cy.get('[data-testid="trips-list"]').should('contain', 'Fisher Two Lake');
      cy.logoutFirebase();
      
      cy.loginFirebase(users.user3.email, users.user3.password);
      cy.visit('/');
      cy.get('[data-testid="trips-list"]').should('contain', 'Fisher Three Lake');
      cy.logoutFirebase();
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (60 seconds)
    expect(duration).to.be.lessThan(60000);
    
    // Verify no contamination occurred
    cy.window().then((win) => {
      const allKeys = Object.keys(win.localStorage);
      const crossUserData = allKeys.filter(key => 
        allKeys.some(otherKey => 
          key.includes('Fisher One') && otherKey.includes('Fisher Two')
        )
      );
      expect(crossUserData).to.have.length(0);
    });
  });
});
