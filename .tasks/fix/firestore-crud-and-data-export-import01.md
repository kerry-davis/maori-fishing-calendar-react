1. /home/pulsta/vscode/repo/maori-fishing-calendar-react
2. .tasks/long_running_tooling.md
3. Create branch: fix/firestore-crud-and-data-export-import (from main)
4. Update src/shared/services/dataExportService.ts to include photos when logged in:
   - For fish with photoPath/photoUrl or encryptedMetadata, fetch bytes via firebaseDataService.getDecryptedPhoto or fetch photoUrl; add concurrency limit and add files under photos/; set CSV photo_filename.
5. Update src/features/modals/TripLogModal.tsx to show imported catches:
   - In loadFishCatches(), fetch per trip via db.getFishCaughtByTripId(trip.id) instead of filtering getAll; guard non-array gear.
6. Extend src/shared/services/firebaseDataService.ts clearFirestoreUserData:
   - Also delete users/{uid}/enc_photos and Firestore collections tackleItems, gearTypes, userSettings; keep progress phases.
7. Refactor guest→cloud merge in src/shared/services/firebaseDataService.ts:
   - Use upsertTripFromImport / upsertWeatherLogFromImport / upsertFishCaughtFromImport with small chunks; ensure photos move to Storage and ID mappings/encryption preserved.
8. Improve import progress in src/shared/services/browserZipImportService.ts:
   - Compute totals and emit per-item progress for reading/parsing/photos/importing (trips/weather/fish) with counters in messages.
9. After successful import, dispatch userDataReady/databaseDataReady to refresh UI (keep reload as fallback).
10. Run tests and build: npm run test and npm run build; fix failures.
11. Manual verification:
    - Import ZIP (logged in): progress moves; catches and photos visible per date.
    - Export ZIP/CSV (logged in): photos/ included; CSV photo_filename set.
    - Delete All (logged in): trips/weather/fish/tackle cleared; Storage images and enc_photos emptied.
    - Add catch as guest → login: records merged to cloud; photos in Storage.
12. Create .tasks/fix/firestore-crud-and-data-export-import.files01.md listing files changed (short form).
