# Architecture Overview

Client-only React application (no custom backend) leveraging Firebase (Auth, Firestore, Storage). Core data operations are centralized in `firebaseDataService` which:

- Initializes guest mode and switches to user context post-auth
- Manages offline queue and id mapping
- Applies field encryption on write and decryption on read
- Performs background migration (plaintext → encrypted) in batches

High-level flow:

```
AuthContext ──(login/logout)──▶ firebaseDataService.switchToUser()
                                 │
                                 ├─ encryptionService.setDeterministicKey()
                                 ├─ mergeLocalDataForUser()
                                 └─ startBackgroundEncryptionMigration()

UI Components ◀── hooks / contexts ──▶ Services (weather, lunar, photoZip, export/import)
```

See also:

- docs/architecture/blueprint.md
- docs/security/SECURITY.md
