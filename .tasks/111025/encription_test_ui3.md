1. Add an `encryptionReady` boolean to the auth context when `setDeterministicKey` resolves and clear it on logout.
2. Update `useEncryptionMigrationStatus` to use that boolean (or a completion event) instead of calling `encryptionService.isReady()` in the dependency array, so the auto-start reruns once the key is ready.
3. De-duplicate auto-start logic: either rely solely on the auth-triggered start or keep the hook fallback, but ensure both honor the same `encryptionReady` flag to avoid double runs.
4. Extend the regression/UI test to log in, await the new readiness signal, and assert the pill disappears once `firebaseDataService.getEncryptionMigrationStatus().allDone` flips true.
