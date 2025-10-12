1. Ensure `AuthContext` kicks off `firebaseDataService.startBackgroundEncryptionMigration()` immediately after `setDeterministicKey` resolves (and encryption service `isReady()` is true).
2. Guard `startBackgroundEncryptionMigration` behind an idempotent flag so it doesn’t launch multiple overlapping runs during StrictMode re-renders.
3. Update `useEncryptionMigrationStatus` to wait for `encryptionService.isReady()` and a truthy user before polling/auto-starting, eliminating guest-mode invocations.
4. Add logging/telemetry on migration completion and failure to keep the status pill in sync, and reset the pill when `allDone` is true.
5. Write a regression test (or Cypress UI script) that logs in a seeded user, waits for migration completion, and confirms the pill disappears without manual console commands.
