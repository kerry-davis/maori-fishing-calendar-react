1. Use the console link from the migration error to create the missing Firestore composite index (userId + createdAt) for the failing collection(s) and wait until it finishes building.
2. After the index is ready, trigger the migration again (log out/in or call `startBackgroundEncryptionMigration`) and confirm `encryptionMigrationCompleted` fires.
3. Verify the pill disappears and `getEncryptionMigrationStatus().allDone` returns true; if not, repeat for any other collections that report missing indexes.
