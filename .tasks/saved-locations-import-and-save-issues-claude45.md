# Saved Locations Import Count and Save Issues

## Date
2025-11-05

## Issues

### Issue 1: Import count displays 0 when 5 locations are successfully imported
- User imports 5 saved locations
- Locations are successfully created in Firestore/localStorage
- Import progress modal shows "0 Saved Locations" in the summary
- User can see the 5 locations are actually present in the UI

### Issue 2: New authenticated users unable to save locations after import
- After importing locations, authenticated users cannot save new locations
- Error message: "You can only store up to 10 saved locations"
- This occurs even when the user has fewer than 10 locations

## Root Cause Analysis

### Primary Issue: NaN propagation in result aggregation

The `browserZipImportService.processZipFile` method has a critical bug at **line 218**:

```typescript
result.savedLocationsImported = importResult.savedLocationsImported ?? 0;
```

**Problem**: The nullish coalescing operator (`??`) only catches `null` and `undefined`, but NOT `NaN`. If `importResult.savedLocationsImported` is `NaN`, it passes through unchanged.

**Flow**:
1. `importLegacyData` returns a result object with `savedLocationsImported`
2. If any of the Math.max operations in `importLegacyData` receive undefined operands before being wrapped in `safeCount`, they produce `NaN`
3. Line 218 uses `?? 0` which doesn't catch `NaN` (because `NaN` is not null/undefined)
4. The `NaN` value propagates to the UI
5. `DataMigrationModal` uses `resolveCount` helper which converts `NaN` to 0
6. UI displays "0 Saved Locations" even though locations were successfully created

### Secondary Issue: Potential duplicate location creation

When importing locations:
- **Wipe strategy**: Should clear all existing locations before importing, but there may be race conditions
- **Merge strategy**: Duplicate detection relies on 11-meter coordinate tolerance (0.0001 degrees)
- If coordinates differ slightly, duplicates can be created
- User might unknowingly hit the 10-location limit due to hidden duplicates

### Tertiary Issue: Cache staleness after import

After import completes:
1. Locations are successfully written to Firestore
2. `getSavedLocations()` should refresh the cache
3. But `refreshedLocations` might be null if the refresh fails (line 1138-1142)
4. The `savedLocationsChanged` event is dispatched (lines 1145-1157)
5. `useSavedLocations` hook should reload, but there might be timing issues

## Why Authenticated Users Cannot Save Locations

When a user tries to save a location after importing:

1. **Import appears to fail**: Due to the NaN bug, the UI shows "0 Saved Locations imported"
2. **User sees misleading count**: Settings modal might also show 0 or incorrect count
3. **Save attempt queries Firestore**: `createSavedLocation` calls `getSavedLocations()` which queries Firestore directly (line 3193 in firebaseDataService.ts)
4. **Actual count check**: The check `if (current.length >= this.savedLocationsLimit)` uses the real Firestore count
5. **Potential scenarios**:
   - **Scenario A**: User has exactly 10 locations (at limit) → save fails with "only store up to 10" error
   - **Scenario B**: User has 5 locations but duplicates were created → might have 10+ in Firestore
   - **Scenario C**: Cache is stale and showing old/empty data → confusion about actual count

## Tasks

### 1. Fix NaN propagation at line 218
**Priority: HIGH**

Replace the nullish coalescing operator with `resolveCount` or direct check:

```typescript
// Before (BROKEN):
result.savedLocationsImported = importResult.savedLocationsImported ?? 0;

// After (FIXED):
result.savedLocationsImported = typeof importResult.savedLocationsImported === 'number' && Number.isFinite(importResult.savedLocationsImported) 
  ? importResult.savedLocationsImported 
  : 0;
```

**Files**: 
- `src/shared/services/browserZipImportService.ts` line 218

### 2. Add defensive NaN checks in importLegacyData return
**Priority: HIGH**

Ensure the result object never contains NaN values before returning:

```typescript
// Before returning result in importLegacyData:
return {
  ...result,
  savedLocationsImported: this.safeCount(result.savedLocationsImported),
  tripsImported: this.safeCount(result.tripsImported),
  weatherLogsImported: this.safeCount(result.weatherLogsImported),
  fishCatchesImported: this.safeCount(result.fishCatchesImported),
  photosImported: this.safeCount(result.photosImported)
};
```

**Files**:
- `src/shared/services/browserZipImportService.ts` around line 1170 (end of importLegacyData method)

### 3. Improve duplicate location detection logging
**Priority: MEDIUM**

Add detailed logging when duplicate locations are detected during import:

```typescript
if (message.includes('already exists')) {
  result.warnings.push(`Saved location skipped (duplicate): "${savedLocation.name ?? 'Unnamed'}" at (${savedLocation.lat}, ${savedLocation.lon})`);
  DEV_LOG('[Import] Duplicate saved location skipped:', savedLocation);
}
```

**Files**:
- `src/shared/services/browserZipImportService.ts` lines 999-1002 (authenticated flow) and 1119-1122 (guest flow)

### 4. Add user-facing feedback for partial imports
**Priority: MEDIUM**

When some locations fail to import (duplicates, limit reached), show clear message to user:

```typescript
// After import loop completes:
const skippedCount = savedLocationsToImport.length - result.savedLocationsImported;
if (skippedCount > 0) {
  result.warnings.push(`${skippedCount} saved location(s) were skipped (duplicates or limit reached). Successfully imported ${result.savedLocationsImported} location(s).`);
}
```

**Files**:
- `src/shared/services/browserZipImportService.ts` after lines 1004 and 1125

### 5. Verify clearFirestoreUserData removes all saved locations
**Priority: HIGH**

Ensure wipe strategy completely clears saved locations collection before import:

**Current code** (lines 2133, 2143-2146):
```typescript
const collectionsToWipe = ['trips', 'weatherLogs', 'fishCaught', 'tackleItems', 'gearTypes', 'userSettings', 'userSavedLocations'];
// ...
const q = query(collection(firestore, coll), where('userId', '==', this.userId));
const snapshot = await getDocs(q);
const refs = snapshot.docs.map(d => d.ref);
```

**Verification needed**: Add logging to confirm all saved locations are deleted.

**Files**:
- `src/shared/services/firebaseDataService.ts` around line 2133

### 6. Add regression test for NaN propagation
**Priority: MEDIUM**

Extend existing test to verify the fix at line 218:

```typescript
it('prevents NaN from propagating through processZipFile result', async () => {
  // Test that even if importLegacyData returns NaN, processZipFile sanitizes it
  const svc = new BrowserZipImportService();
  
  // Mock importLegacyData to return NaN
  const originalMethod = (svc as any).importLegacyData;
  (svc as any).importLegacyData = async () => ({
    success: true,
    tripsImported: 0,
    weatherLogsImported: 0,
    fishCatchesImported: 0,
    savedLocationsImported: NaN,  // Simulated bug
    photosImported: 0,
    errors: [],
    warnings: []
  });
  
  const result = await svc.processZipFile(/* ... */);
  
  // Result should never contain NaN
  expect(Number.isNaN(result.savedLocationsImported)).toBe(false);
  expect(result.savedLocationsImported).toBe(0);
  
  // Restore original method
  (svc as any).importLegacyData = originalMethod;
});
```

**Files**:
- `src/shared/__tests__/smoke.import.perf.test.ts`

### 7. Add diagnostic logging to createSavedLocation
**Priority: LOW**

Add more detailed logging when save fails to help diagnose issues:

```typescript
if (current.length >= this.savedLocationsLimit) {
  PROD_ERROR('[SavedLocations] Limit reached:', {
    currentCount: current.length,
    limit: this.savedLocationsLimit,
    userId: this.userId,
    currentLocations: current.map(loc => ({ id: loc.id, name: loc.name, lat: loc.lat, lon: loc.lon }))
  });
  throw new Error(`You can only store up to ${this.savedLocationsLimit} saved locations.`);
}
```

**Files**:
- `src/shared/services/firebaseDataService.ts` around line 3194

## Implementation Order

1. **Task 1** (Fix NaN at line 218) - CRITICAL, fixes the display bug
2. **Task 2** (Defensive NaN checks in return) - CRITICAL, prevents NaN from being created
3. **Task 4** (User-facing feedback) - HIGH, improves UX for partial imports
4. **Task 5** (Verify wipe clears all) - HIGH, ensures clean import state
5. **Task 3** (Improve logging) - MEDIUM, helps with debugging
6. **Task 6** (Regression test) - MEDIUM, prevents future regressions
7. **Task 7** (Diagnostic logging) - LOW, nice to have

## Verification Steps

After implementing fixes:

1. **Test Case 1**: Import 5 locations as authenticated user (wipe strategy)
   - Verify UI shows "5 Saved Locations imported"
   - Verify Settings modal shows 5 locations
   - Verify can save additional locations (up to 10 total)

2. **Test Case 2**: Import 10 locations as authenticated user (wipe strategy)
   - Verify UI shows "10 Saved Locations imported"
   - Verify Settings modal shows 10 locations
   - Verify attempting to save 11th location shows clear error

3. **Test Case 3**: Import 5 duplicate locations (merge strategy)
   - Verify UI shows "0 Saved Locations imported" with warning about duplicates
   - Verify Settings modal still shows original 5 locations
   - Verify can still save additional locations

4. **Test Case 4**: Import 15 locations (exceeds limit)
   - Verify UI shows "10 Saved Locations imported" with warning about 5 skipped
   - Verify Settings modal shows 10 locations
   - Verify attempting to save more shows clear error

## Related Files

- `src/shared/services/browserZipImportService.ts` - Main import logic
- `src/shared/services/firebaseDataService.ts` - Firestore CRUD operations
- `src/shared/hooks/useSavedLocations.ts` - React hook for saved locations
- `src/features/modals/DataMigrationModal.tsx` - UI that displays import results
- `src/features/modals/SettingsModal.tsx` - UI for managing saved locations
- `src/shared/__tests__/smoke.import.perf.test.ts` - Tests for import service
- `docs/architecture/DATA_MODEL.md` - Data model documentation

## Success Criteria

- [ ] Import count displays accurately (no NaN → 0 conversion)
- [ ] Users can save locations after import (up to 10-location limit)
- [ ] Clear feedback when locations are skipped (duplicates/limit)
- [ ] Wipe strategy reliably clears all existing locations
- [ ] Regression tests prevent future NaN issues
