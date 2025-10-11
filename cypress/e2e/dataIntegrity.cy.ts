describe('Data Integrity - Cross-Account Contamination Prevention', () => {
  beforeEach(() => {
    // Clear all local storage and session storage
    cy.clearLocalStorage();
    cy.clearSessionStorage();
    
    // Mock indexedDB if needed
    cy.window().then((win) => {
      win.indexedDB = Cypress.indexedDB;
    });
  });

  it('should clear all user data on logout', () => {
    // Visit the app
    cy.visit('/');
    
    // Wait for app to load
    cy.get('body').should('be.visible');
    
    // Simulate user data in localStorage
    cy.window().then((win) => {
      win.localStorage.setItem('theme', 'dark');
      win.localStorage.setItem('userLocation', JSON.stringify({ lat: 40.7128, lng: -74.0060 }));
      win.localStorage.setItem('tacklebox', JSON.stringify([{ id: 1, name: 'Test Rod' }]));
      win.localStorage.setItem('gearTypes', JSON.stringify(['Spinner', 'Fly']));
    });
    
    // Verify data exists
    cy.window().then((win) => {
      expect(win.localStorage.getItem('theme')).to.equal('dark');
      expect(win.localStorage.getItem('userLocation')).to.not.be.null;
    });
    
    // Simulate logout through clearing state
    cy.window().then((win) => {
      // Import and call the clearUserState function
      const clearUserState = win.eval(`
        import('../src/utils/userStateCleared').then(module => module.clearUserState)
      `);
      
      cy.wrap(clearUserState).invoke('then', (fn) => fn()).should('not.throw');
    });
    
    // Verify data is cleared
    cy.window().then((win) => {
      expect(win.localStorage.getItem('theme')).to.be.null;
      expect(win.localStorage.getItem('userLocation')).to.be.null;
      expect(win.localStorage.getItem('tacklebox')).to.be.null;
      expect(win.localStorage.getItem('gearTypes')).to.be.null;
    });
  });

  it('should prevent modal state preservation across auth changes', () => {
    // Set up modal state in URL hash
    cy.visit('/#settings');
    
    // Verify hash is set
    cy.url().should('include', '#settings');
    
    // Simulate clearUserState
    cy.window().then((win) => {
      const clearUserState = win.eval(`
        import('../src/utils/userStateCleared').then(module => module.clearUserState)
      `);
      
      cy.wrap(clearUserState).invoke('then', (fn) => fn()).should('not.throw');
    });
    
    // The function should clear modal-related hashes
    // (Note: the exact behavior may depend on implementation)
    cy.url().should('not.include', '#settings');
  });

  it('should handle errors gracefully during cleanup', () => {
    // Mock localStorage to throw error
    cy.window().then((win) => {
      const originalRemoveItem = win.localStorage.removeItem;
      win.localStorage.removeItem = (key) => {
        if (key === 'theme') {
          throw new Error('Storage error');
        }
        return originalRemoveItem.call(win.localStorage, key);
      };
    });
    
    // Should not throw even when errors occur
    cy.window().then((win) => {
      const clearUserState = win.eval(`
        import('../src/utils/userStateCleared').then(module => module.clearUserState)
      `);
      
      cy.wrap(clearUserState).invoke('then', (fn) => fn()).should('not.throw');
    });
  });
});
