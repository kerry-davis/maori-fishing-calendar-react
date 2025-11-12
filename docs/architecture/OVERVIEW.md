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
- **Inactivity guard**: `AuthContext` tracks `lastUserActivityAt` + owning UID in `localStorage`, tags manual sign-ins in `sessionStorage`, and flips UI state to logged-out immediately when the watchdog triggers while the existing `secureLogoutWithCleanup()` completes in the background.

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
