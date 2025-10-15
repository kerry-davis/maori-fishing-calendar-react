guest-user-admin.files4.md

Implemented tasks from .tasks/feature/guest-user-admin4.md:

1) Reinstate explicit guest-operation tokens in `validateUserContext`:
   - File: `src/utils/userStateCleared.ts`
   - Change: validateUserContext now only allows guest bypass when `operationType` starts with `guest-`. This prevents generic write ops such as `createTrip` from being implicitly allowed when no auth is present.

2) Update guest write call sites to supply explicit guest handling / token:
   - File: `src/services/firebaseDataService.ts`
   - Change: `createTrip` now handles guest-mode separately and performs the local database write directly (awaits `databaseService.createTrip(...)`) to avoid relying on implicit validation bypass. The guest path uses an explicit guest token pattern (`guest-createTrip`) conceptually and avoids returning raw undefined values.
   - `upsertTripFromImport` and other guest-mode paths remain on local DB behavior and continue to avoid attempting Firebase operations while `isGuest`.

3) Wrap `getFishPhotoPreview` to resolve storage-relative photo paths into usable URLs or fall back to placeholders:
   - File: `src/utils/photoPreviewUtils.ts`
   - Change: If a non-encrypted `photoPath` is present and is not already a blob/data/http URL, the code now tries `getDownloadURL(storageRef(storage, photoPath))`. On failure it returns a placeholder SVG data URL rather than returning a raw storage path.

4) Fix test cleanup to await async guest retention clearing:
   - Files updated:
     - `src/test/guestModeTripCreation.test.ts` (made beforeEach async and awaits `clearAllGuestData`)
     - `src/test/guestDataRetentionService.test.ts` (tests updated to `async` mode and `await` async service methods)
     - `src/test/guestDataRetentionIntegration.test.ts` (awaited clear and updated waitFor to async)
     - `src/test/guestDataRetentionEdgeCases.test.ts` (removed extraneous guestSessionId test props and awaited clearAllGuestData in beforeEach)
   - Purpose: Ensure IndexedDB/localStorage cleanup finishes before tests run to make tests deterministic.

5) Re-run unit tests to validate behavior (partial):
   - Ran the test suite. Guest-mode & photo preview-related tests were updated; several unrelated test failures remain (migration tests, userDataReady event tests, calendar indicator tests, and a few integration tests) which are outside the current task scope and likely require targeted fixes or mock adjustments.

Notes / Next steps:
- The requested `Isolate global storage mocks in dataIntegrity.test.ts` remains open; I didn't modify `dataIntegrity.test.ts` in this change set and left it `not-started` in the todo list.
- Several tests still fail (many are unrelated to the guest-mode changes). If you want, I can continue and triage those failing tests next (mock imports for `../services/firebase`, investigate event dispatch/listener setup, and fix failing expectations).

If you'd like me to continue and: (A) fix the remaining failing tests; (B) implement the `Isolate global storage mocks in dataIntegrity.test.ts`; or (C) convert guest write bypass to an explicit helper utility (e.g. `performGuestWrite(opName, op)`), say which and I'll proceed.
