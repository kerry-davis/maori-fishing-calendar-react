# Data Architecture Fix - Trip Display & Logout Data Isolation

## Issue Summary

Two critical data architecture issues were identified and resolved:

1. **Trip data not displaying**: After login, trips were fetched from Firestore but not cached to IndexedDB. TripLogModal forced local reads (`forceLocal=true`), finding empty IndexedDB, while Gallery/Analytics worked because they fetched directly from Firestore.

2. **User data persisting after logout**: On logout, `backupLocalDataBeforeLogout()` downloaded all Firestore data to IndexedDB, and `secureLogoutWithCleanup()` preserved guest data. This meant previous user's data remained visible and could be accessed by the next user.

## Architecture Decision

**Cloud-First with Offline Cache Strategy:**
- **Authenticated users**: Firestore is the source of truth, IndexedDB is a temporary cache
- **Guest users**: IndexedDB is the source of truth until login
- **On logout**: Clear ALL IndexedDB data (zero local data for authenticated users)
- **On login**: Merge guest data to cloud, then clear local data
- **Offline support**: Cache all Firestore reads/writes to IndexedDB for offline viewing and queued sync

## Changes Made

### 1. TripLogModal Fix
**File**: `src/features/modals/TripLogModal.tsx`

```typescript
// BEFORE: Forced local read, finding empty IndexedDB
const tripsData = await db.getTripsByDate(dateStr, true);

// AFTER: Fetch from Firestore with automatic IndexedDB caching
const tripsData = await db.getTripsByDate(dateStr);
```
- Fish catches and weather logs now reuse the same cloud-first `getTripsByDate` path before filtering, keeping Trip Log sections consistent even after a fresh login.

### 2. Logout Data Cleanup
**File**: `src/app/providers/AuthContext.tsx`

**Removed**:
- `backupLocalDataBeforeLogout()` call
- "Downloading your data for offline access" flow

**Result**: On logout, no data is downloaded to IndexedDB.

### 3. Complete IndexedDB Cleanup on Logout
**File**: `src/shared/utils/clearUserContext.ts`

```typescript
// BEFORE: Preserved guest data
await clearUserContext({ preserveGuestData: true });

// AFTER: Clear ALL local data
await clearUserContext({ preserveGuestData: false });
```

### 4. Sync-Before-Logout (30s timeout)
**File**: `src/shared/utils/clearUserContext.ts`

Added 30-second sync attempt before logout:
- Attempts to sync all queued operations
- Times out after 30 seconds
- Warns user if sync fails/times out
- Continues with logout regardless (cloud data is preserved)

### 5. Firestore Read Caching
**File**: `src/shared/services/firebaseDataService.ts`

Added automatic IndexedDB caching after Firestore reads:

**Methods updated:**
- `getTripsByDate()` - Cache trips for date
- `getAllTrips()` - Cache all trips
- `getWeatherLogsByTripId()` and `getAllWeatherLogs()` - Cache weather logs (per-trip + global)
- `getFishCaughtByTripId()` and `getAllFishCaught()` - Cache fish catches (per-trip + global)

**Pattern:**
```typescript
// After fetching from Firestore
const trips = await Promise.all(tripPromises) as Trip[];

// Cache to IndexedDB for offline support
try {
  for (const trip of trips) {
    await databaseService.updateTrip(trip);
  }
  DEV_LOG('Cached', trips.length, 'trips to IndexedDB');
} catch (cacheError) {
  DEV_WARN('Failed to cache trips to IndexedDB:', cacheError);
}

return trips;
```
All of these reads deduplicate by local ID before caching, ensuring duplicate Firestore documents cannot surface in the UI.
- Caching now runs only when the encryption key is ready. If encryption is still initialising (e.g., salt not synced yet), the reads skip IndexedDB writes; once the key becomes available we trigger a rehydrate pass to refresh the cache with decrypted data.

### 6. Firestore Write Caching
**File**: `src/shared/services/firebaseDataService.ts`

Added IndexedDB caching after successful Firestore writes:

**Methods updated:**
- `createTrip()` - Cache after Firestore create
- `createWeatherLog()` - Cache after Firestore create
- `createFishCaught()` - Cache after Firestore create

**Pattern:**
```typescript
// After successful Firestore write
await this.storeLocalMapping('trips', tripId.toString(), docRef.id);

// Cache to IndexedDB for offline support
try {
  const tripToCache = { ...sanitizedTripData, id: tripId };
  await databaseService.createTrip(tripToCache);
  DEV_LOG('Trip cached to IndexedDB for offline support');
} catch (cacheError) {
  DEV_WARN('Failed to cache trip to IndexedDB:', cacheError);
}
```
- Write caching follows the same encryption guard: if the key is not ready, the service waits until encryption is initialised before hydrating the cache via `rehydrateCachedData()`.

## Data Flow Summary

### Authenticated User Online
1. **Write**: Trip created → Firestore write → IndexedDB cache
2. **Read**: Fetch from Firestore → IndexedDB cache → Return data
3. **Offline**: Use IndexedDB cache for viewing, queue writes for sync

### Authenticated User Offline
1. **Write**: Trip created → IndexedDB + sync queue → Upload when online
2. **Read**: Fetch from IndexedDB cache
3. **Reconnect**: Auto-sync queued operations to Firestore

### Guest User
1. **Write**: Trip created → IndexedDB only
2. **Read**: Fetch from IndexedDB
3. **Login**: Merge IndexedDB → Firestore, clear IndexedDB

### Logout Flow
0. **Session Check**: If Firebase already dropped the auth session (e.g., inactivity timeout), skip secure logout and run the local cleanup path immediately so the UI doesn’t wait on a redundant sync.
1. **Sync**: Attempt 30s sync of queued operations (warn if timeout)
2. **Cleanup**: Clear ALL IndexedDB data (`preserveGuestData: false`)
3. **Sign Out**: Firebase auth sign out
4. **Guest Mode**: Initialize fresh guest session with empty IndexedDB

## Benefits

1. ✅ **Trip data displays correctly** - Cached from Firestore reads
2. ✅ **Complete data isolation** - No user data persists after logout
3. ✅ **Offline support** - Full read/write capability when authenticated offline
4. ✅ **Guest data merge** - Existing flow preserved for guest→authenticated
5. ✅ **Data integrity** - 30s sync before logout minimizes data loss
6. ✅ **Consistent behavior** - All modals use same data fetching pattern
7. ✅ **Sessionless reopen speed** - When Firebase already ended the session, the auth provider now skips the secure logout pipeline and clears state immediately, avoiding unnecessary delays on app resume.

## Testing Checklist

- [ ] Login → Create trip → Verify appears immediately in Trip Log
- [ ] Create trip online → Go offline → Trip still visible
- [ ] Go offline → Create trip → Reconnect → Trip syncs to cloud
- [ ] Logout → Verify IndexedDB empty (all data cleared)
- [ ] Login as different user → Verify no previous user data visible
- [ ] Guest mode → Create data → Login → Verify data merges to cloud
- [ ] Queued operations → Logout → Verify 30s sync attempt + warning
- [ ] Reopen after prolonged inactivity → Confirm immediate logout without extra delay when Firebase session already expired
- [ ] Reopen after inactivity (session already expired) → Confirm logout completes immediately without waiting on sync

## Related Files

- `src/features/modals/TripLogModal.tsx`
- `src/app/providers/AuthContext.tsx`
- `src/shared/utils/clearUserContext.ts`
- `src/shared/services/firebaseDataService.ts`
- `docs/architecture/DATA_MODEL.md` (reference)

---

**Date**: 2025-11-02  
**Branch**: `fix/trip-log-empty-display`  
**Status**: Ready for testing
