# Architecture Overview

Client-only React application (no custom backend) leveraging Firebase (Auth, Firestore, Storage). Core data operations are centralized in `firebaseDataService` which:

- Initializes guest mode and switches to user context post-auth
- Manages offline queue and id mapping
- Applies field encryption on write and decryption on read
- Performs background migration (plaintext → encrypted) in batches

## Data Persistence Model

**Cloud-First Architecture** (since 2025-11-02):
- **Authenticated users**: Firestore = source of truth, IndexedDB = temporary cache
- **Guest users**: IndexedDB = source of truth until login
- **Logout**: All IndexedDB cleared after 30-second sync attempt
- **Caching**: All Firestore reads/writes automatically cache to IndexedDB using `put()` (upsert)
- **Deduplication**: Automatic on read, keeps newest by `updatedAt` timestamp
- **Location hand-off**: LocationContext persists the last selected location to `userSettings.lastKnownLocation` for authenticated users and restores it once encryption/user data readiness flags resolve on the next session.

AuthContext now records user activity timestamps in `localStorage` and invokes the secure logout pipeline after the configured inactivity timeout (5 minutes in QA, 60 minutes in production).
Each activity write includes the active user ID (`lastUserActivityUid`), so timestamps from prior accounts are ignored and cannot trigger the auto-logout loop immediately after a fresh login.

High-level flow:

```
AuthContext ──(login/logout)──▶ firebaseDataService.switchToUser()
                                 │
                                 ├─ encryptionService.setDeterministicKey()
                                 ├─ mergeLocalDataForUser()
                                 ├─ clearAllData() [on logout]
                                 └─ startBackgroundEncryptionMigration()

UI Components ◀── hooks / contexts ──▶ Services (weather, lunar, photoZip, export/import)
```

See also:

- docs/architecture/blueprint.md
- docs/architecture/DATA_MODEL.md (detailed persistence & caching)
- docs/security/SECURITY.md
