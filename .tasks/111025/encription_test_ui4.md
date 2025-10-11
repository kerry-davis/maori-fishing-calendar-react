1. Create the required Firestore composite index for `trips` (fields: `userId`, `createdAt` ascending) so migration queries stop failing; document the console link for reproducibility.
2. Fail fast in `startBackgroundEncryptionMigration` when a Firebase index error surfaces—set the affected collection state to `{done: true}` or surface a UI notice so the pill isn’t stuck indefinitely.
3. Update the migration status hook to display an error state when `encryptionMigrationCompleted` isn’t fired but `startBackgroundEncryptionMigration` logs a fatal error.
4. Add an integration test (or manual checklist) to confirm that once the index exists, the migration runs to completion and the pill dismisses automatically.
