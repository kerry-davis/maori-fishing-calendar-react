1. Initialize encryption key during auth flow
   - Call `encryptionService.setDeterministicKey(user.uid, user.email)` when auth state provides a user
   - Clear the key on logout or when auth becomes unavailable
   - Surface errors for missing `VITE_KEY_PEPPER`

2. Ensure FirebaseDataService decrypts incoming records
   - Pass collection hints into every `convertFromFirestore` call
   - Await `encryptionService.decryptObject` so reads return plaintext

3. Encrypt additional write/update paths
   - Audit create/update/upsert flows for trips, weather logs, fish caught, tackle items, and queued operations
   - Guarantee `_encrypted` payloads persist before Firestore writes

4. Propagate encryption to import/migration flows
   - Update merge, backup/restore, and import utilities to use `encryptFields`/`decryptObject`
   - Adjust content-hash comparisons if encrypted serialization changes

5. Finalize background migration triggers and UI
   - Ensure migrations auto-start once keys exist and user online
   - Verify status pill reflects progress and reset logic handles completion/abort

6. Expand automated tests and add regression coverage
   - Add integration tests covering key setup, read/write cycles, and migration batches
   - Mock Web Crypto where needed

7. Run full validation
   - Execute lint, tests, and production build
   - Confirm encrypted data persists in Firestore and document env requirements if missing
