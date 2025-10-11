1. Create the required Firestore composite indexes for the migration queries (at minimum: `trips` and `weatherLogs` ordered by `userId` + `createdAt`) using the links surfaced in the console.
2. Update the migration polling effect in `useEncryptionMigrationStatus.ts` so its dependency array is stable—include `encryptionReady` exactly once to satisfy React’s rules and avoid the size-change warning.
3. Verify the migration completes after indexes exist (watch for the completion event and pill dismissal) and ensure the warning is gone.
