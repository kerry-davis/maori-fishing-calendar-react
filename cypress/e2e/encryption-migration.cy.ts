describe('Encryption Migration UI Regression', () => {
  beforeEach(() => {
    // Clear localStorage and reset state
    cy.clearLocalStorage();
    cy.clearCookies();
    
    // Visit the app
    cy.visit('/');
    
    // Wait for app to load
    cy.get('[data-testid="app-loaded"]', { timeout: 10000 }).should('exist');
  });

  it('should complete migration after user login and hide encryption pill', () => {
    // Test with a seeded user
    const testUser = {
      email: 'migration.test@example.com',
      password: 'test123456' // Make sure this matches your test seed data
    };

    // Login
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="email-input"]').type(testUser.email);
    cy.get('[data-testid="password-input"]').type(testUser.password);
    cy.get('[data-testid="submit-login"]').click();

    // Wait for successful login
    cy.url().should('not.include', '/login');
    cy.get('[data-testid="user-email"]').should('contain', testUser.email);

    // Wait for encryption service to be ready
    cy.window().then((win) => {
      // Wait for encryptionService.isReady() to be true
      cy.wrap(null).then(() => {
        return new Promise((resolve) => {
          const checkReady = () => {
            if (win.encryptionService?.isReady?.()) {
              resolve(true);
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });
      });
    });

    // Check if migration pill appears
    cy.get('[data-testid="encryption-migration-pill"]', { timeout: 5000 }).should('be.visible');

    // Verify pill shows migration in progress
    cy.get('[data-testid="encryption-migration-pill"]').should('contain', 'Encrypting data…');
    
    // Wait for migration to complete (can take time depending on data size)
    // Set a reasonable timeout for demo purposes
    cy.get('[data-testid="encryption-migration-pill"]', { timeout: 60000 }).should('not.exist');

    // Verify completion by checking that encryption status shows all done
    cy.window().then((win) => {
      const migrationStatus = win.firebaseDataService?.getEncryptionMigrationStatus?.();
      expect(migrationStatus?.allDone).to.be.true;
    });

    // Log console messages for debugging
    cy.get('@consoleLog').then((logs: any) => {
      const migrationLogs = logs.filter((log: any) => 
        log.message?.includes('[enc-migration] Migration completed successfully')
      );
      expect(migrationLogs).to.have.length.greaterThan(0);
    });
  });

  it('should not show encryption pill in guest mode', () => {
    // Ensure not logged in
    cy.get('[data-testid="login-button"]').should('be.visible');
    
    // Encryption pill should not be visible in guest mode
    cy.get('[data-testid="encryption-migration-pill"]').should('not.exist');
  });

  it('should handle migration restart correctly', () => {
    const testUser = {
      email: 'migration.restart.test@example.com',
      password: 'test123456'
    };

    // Login
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="email-input"]').type(testUser.email);
    cy.get('[data-testid="password-input"]').type(testUser.password);
    cy.get('[data-testid="submit-login"]').click();

    // Wait for login
    cy.get('[data-testid="user-email"]').should('contain', testUser.email);

    // Wait for encryption to be ready
    cy.window().then((win) => {
      cy.wrap(null).then(() => {
        return new Promise((resolve) => {
          const checkReady = () => {
            if (win.encryptionService?.isReady?.()) {
              resolve(true);
            } else {
              setTimeout(checkReady, 100);
            }
          };
          checkReady();
        });
      });
    });

    // Reset migration state to simulate restart
    cy.window().then((win) => {
      win.firebaseDataService?.resetEncryptionMigrationState?.();
    });

    // Start migration manually
    cy.window().then((win) => {
      win.firebaseDataService?.startBackgroundEncryptionMigration?.();
    });

    // Pill should show during migration
    cy.get('[data-testid="encryption-migration-pill"]', { timeout: 5000 }).should('be.visible');
    
    // Pill should disappear when complete
    cy.get('[data-testid="encryption-migration-pill"]', { timeout: 60000 }).should('not.exist');
  });

  it('should handle StrictMode re-renders without duplicate migrations', () => {
    const testUser = {
      email: 'strictmode.test@example.com',
      password: 'test123456'
    };

    // Enable StrictMode for this test
    cy.window().then((win) => {
      win.localStorage.setItem('REACT_STRICT_MODE', 'true');
    });

    // Reload page to apply StrictMode
    cy.reload();

    // Login
    cy.get('[data-testid="login-button"]').click();
    cy.get('[data-testid="email-input"]').type(testUser.email);
    cy.get('[data-testid="password-input"]').type(testUser.password);
    cy.get('[data-testid="submit-login"]').click();

    // Wait for login
    cy.get('[data-testid="user-email"]').should('contain', testUser.email);

    // Monitor console for multiple migration starts
    let migrationStartCount = 0;
    cy.window().then((win) => {
      const originalLog = win.console.log;
      win.console.log = (...args: any[]) => {
        if (args[0]?.includes?.('[enc-migration] Migration started successfully')) {
          migrationStartCount++;
        }
        originalLog.apply(win.console, args);
      };
    });

    // Check that migration only starts once
    cy.window().then((win) => {
      cy.wrap(null).then(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            expect(migrationStartCount).to.equal(1);
            resolve(true);
          }, 5000);
        });
      });
    });
  });
});
