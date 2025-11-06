# Data Model and ERDs

This document captures the core data shapes and relationships across the database layer (Firestore + Firebase Storage and local offline stores), service layer models, and primary UI data.

## 1) Firestore + Firebase Storage ERD

```mermaid
erDiagram
  USER ||--o{ TRIPS : "owns"
  USER ||--|| USER_SETTINGS : "has"
  USER ||--o{ TACKLE_ITEMS : "owns"
  USER ||--o{ GEAR_TYPES_COLL : "owns"
  USER ||--o{ USER_SAVED_LOCATIONS : "owns"
  TRIPS ||--o{ WEATHER_LOGS : "has"
  TRIPS ||--o{ FISH_CAUGHT : "has"
  FISH_CAUGHT o|--|| STORAGE_ENC_PHOTO : "photo (photoPath)"

  USER {
    string uid PK
    string email
  }

  USER_SAVED_LOCATIONS {
    string id PK      "doc id"
    string userId FK
    string name       "encrypted"
    string water      "encrypted (optional)"
    string location   "encrypted (optional)"
    number lat        "optional coordinates"
    number lon        "optional coordinates"
    string notes      "encrypted (optional)"
    timestamp createdAt
    timestamp updatedAt
  }

  USER_SETTINGS {
    string userId PK  "doc id == userId"
    string[] gearTypes
    string encSaltB64
    timestamp createdAt
    timestamp updatedAt
  }

  TRIPS {
    number id        "local stable id"
    string userId FK
    string date      "YYYY-MM-DD"
    string water
    string location
    number hours
    string companions
    string notes
    string contentHash
    timestamp createdAt
    timestamp updatedAt
  }

  WEATHER_LOGS {
    string id        "<tripId>-<ulid> (opaque)"
    string userId FK
    number tripId FK "references TRIPS.id"
    string timeOfDay
    string sky
    string windCondition
    string windDirection
    string waterTemp
    string airTemp
    string contentHash
    timestamp createdAt
    timestamp updatedAt
  }

  FISH_CAUGHT {
    string id        "<tripId>-<ulid> (opaque)"
    string userId FK
    number tripId FK "references TRIPS.id"
    string species
    string length
    string weight
    string time
    string[] gear
    string[] gearIds  "optional: tackleItems doc ids"
    string details
    string photoHash
    string photoPath  "users/<uid>/enc_photos/... or users/<uid>/images/..."
    string photoMime
    string photoUrl   "optional cached (avoid persisting for encrypted photos)"
    string encryptedMetadata "for encrypted photos"
    string contentHash
    timestamp createdAt
    timestamp updatedAt
  }

  TACKLE_ITEMS {
    string gearId PK  "doc id"
    string userId FK
    string name       "encrypted"
    string brand      "encrypted"
    string type
    string colour     "encrypted"
    timestamp createdAt
    timestamp updatedAt
  }

  GEAR_TYPES_COLL {
    string id PK      "doc id"
    string userId FK
    string name
    timestamp createdAt
    timestamp updatedAt
  }

  STORAGE_ENC_PHOTO {
    string path PK    "users/<uid>/enc_photos/..."
    string hash       "sha256 of bytes"
    string mime
    bool encrypted    "custom metadata"
  }
```

Notes:
- Gear types are primarily stored in `userSettings.gearTypes`. The `gearTypes` collection exists but is deprecated for most flows to avoid drift.
- Sensitive fields are deterministically encrypted client-side per `SECURITY.md` (selected string fields in trips/weatherLogs/fishCaught/tackleItems/userSavedLocations).
- **Tackle Items Encryption**: `name`, `brand`, and `colour` fields are encrypted before writing to Firestore. The `type` field remains plaintext to enable filtering/grouping. Decryption occurs automatically when loading tackle items, with a timing consideration: tackle items are reloaded once the encryption service is initialized after login to ensure proper decryption.
- Weather/Fish IDs are opaque and use a ULID-based suffix; UI should not parse IDs.
- Saved locations are limited to 10 per user (hard cap enforced at service level).
- Duplicate location prevention uses 11-meter coordinate tolerance (0.0001 degrees).
- Saved locations encrypt name, water, location, and notes fields client-side.
- Saved location exports include both JSON (`localStorage.savedLocations`) and CSV (`saved-locations.csv`) artefacts. Imports rely on `firebaseDataService.replaceSavedLocations()` which wipes and repopulates the `userSavedLocations` collection, preserving IDs/timestamps from backups while enforcing the 10-item limit and skipping duplicates by ID. Guest imports fall back to localStorage with the same limit enforcement.
- Export/Import UI summaries surface the filename and duration of each operation. Durations are formatted as `hh:mm:ss` using a shared formatter so the Settings modal and migration flows stay consistent.
 
### Update semantics and guardrails (to prevent data loss and display drift)
- FISH_CAUGHT photo fields are preserved on updates unless an explicit removal signal is provided. Clients MUST NOT clear photo-related fields by omission.
  - To remove a photo, send one of: `photo: ''` or `photoPath: ''` or `photoUrl: ''` or `removePhoto: true`.
  - To keep an existing photo unchanged, do not include any photo fields in the update payload.
  - To replace a photo, set `photo` to a data URL; the service will move it to Storage and populate `photoPath` (+ `encryptedMetadata` when encrypted). For encrypted photos, `photoUrl` may remain empty by design.
  - When editing locally cached records (IndexedDB/guest mode), merge the existing photo metadata (`photoPath`, `photoUrl`, `photoHash`, `photoMime`, `encryptedMetadata`) into the update payload so the client-side store does not drop references while Firestore keeps them.
- Gear rename propagation runs asynchronously. UI should enqueue rename tasks (via the gear maintenance service) and surface progress feedback rather than blocking the modal while catch records are updated. The maintenance service now emits canonical rename events (`gear-rename-applied`, `gear-type-rename-applied`) immediately after writing both Firestore and IndexedDB; consumers (e.g., Trip Log) must subscribe and update in-memory state to keep denormalized gear labels in sync without requiring a full refresh. When normalizing catch gear locally, prefer existing composite entries (`type|brand|name|colour`) over tackle-box fallbacks so freshly renamed records are not overwritten by stale name-only values.
- Encrypted photos: prefer `photoPath` + `encryptedMetadata`; `photoUrl` is optional and often blank for encrypted objects (download URLs are fetched on demand).
- UI photo handling: gallery listings and modal viewers seed placeholder entries for storage-backed photos so every `fishCaught` record with a `photoPath` appears immediately, then hydrate with decrypted/pre-signed URLs when available. Trip Log, Fish Catch, and Gallery modals all invoke the shared `PhotoViewerModal`, ensuring identical sizing, metadata layout, and sign-in prompts when full-screening images; the viewer automatically closes when its parent modal unmounts, avoiding orphaned overlays.
 

## 2) Local (Guest/Offline) Data ERD

```mermaid
erDiagram
  IDB_TRIPS ||--o{ IDB_WEATHER_LOGS : "has"
  IDB_TRIPS ||--o{ IDB_FISH_CAUGHT : "has"
  ID_MAPPING o{--|| IDB_TRIPS : "maps local->firebase"
  ID_MAPPING o{--|| IDB_WEATHER_LOGS : "maps local->firebase"
  ID_MAPPING o{--|| IDB_FISH_CAUGHT : "maps local->firebase"
  SYNC_QUEUE o{--|| IDB_TRIPS : "queued ops"
  SYNC_QUEUE o{--|| IDB_WEATHER_LOGS : "queued ops"
  SYNC_QUEUE o{--|| IDB_FISH_CAUGHT : "queued ops"

  IDB_TRIPS {
    number id PK
    string date
    string water
    string location
    number hours
    string companions
    string notes
    string guestSessionId
  }

  LS_SAVED_LOCATIONS {
    string key        "savedLocations"
    json[] locations  "array of SavedLocation objects"
  }

  IDB_WEATHER_LOGS {
    string id PK
    number tripId FK
    string timeOfDay
    string sky
    string windCondition
    string windDirection
    string waterTemp
    string airTemp
    string guestSessionId
  }

  IDB_FISH_CAUGHT {
    string id PK
    number tripId FK
    string species
    string length
    string weight
    string time
    string[] gear
    string details
    string photo       "inline data URL in guest/offline"
    string guestSessionId
  }

  ID_MAPPING {
    string key PK   "idMapping_<uid>_<collection>_<localId>"
    string firebaseDocId
  }

  SYNC_QUEUE {
    number id PK
    string operation  "create|update|delete"
    string collection "trips|weatherLogs|fishCaught"
    json data
    string timestamp
  }
```

Notes:
- Guest users store saved locations in localStorage under `savedLocations` key (not synced to Firestore).
- Each guest session maintains its own saved locations list (10-item limit applies).

## 3) Service Layer Model (Relationships)

```mermaid
classDiagram
  class FirebaseDataService {
    +initialize(userId?)
    +createTrip(trip)
    +createWeatherLog(weather)
    +createFishCaught(fish)
    +getSavedLocations()
    +createSavedLocation(input)
    +updateSavedLocation(id, updates)
    +deleteSavedLocation(id)
    +getDecryptedPhoto(photoPath, encryptedMetadata)
    +processSyncQueue()
  }
  class DatabaseService {
    +getAllTrips()
    +getAllWeatherLogs()
    +getAllFishCaught()
    +create*/update*/delete*
  }
  class EncryptionService {
    +encryptFields(collection,payload)
    +decryptFields(collection,payload)
  }
  class PhotoEncryptionService {
    +encryptPhoto(bytes,mime,uid)
    +decryptPhoto(blob,metadata)
  }
  class Firestore
  class Storage
  class AuthContext { +user }

  AuthContext --> FirebaseDataService : set userId / mode
  FirebaseDataService --> Firestore : reads/writes (trips, weatherLogs, fishCaught, tackleItems, userSettings, gearTypes, userSavedLocations)
  FirebaseDataService --> Storage : photos (users/<uid>/enc_photos/*)
  FirebaseDataService --> EncryptionService : field encryption
  FirebaseDataService --> PhotoEncryptionService : photo encryption
  FirebaseDataService --> DatabaseService : offline fallback + queue
```

Notes:
- Saved locations use Firestore for authenticated users, localStorage for guests.
- 10-location limit enforced at service level with duplicate coordinate detection.
- CRUD operations emit `savedLocationsChanged` events for reactive UI updates.
- **Tackle Items Decryption Flow**: When authenticated users load tackle items, `useFirebaseTackleBox` and `firebaseDataService.getAllTackleItems()` automatically decrypt encrypted fields. The hook monitors `AuthContext.encryptionReady` to reload items once encryption service initialization completes, ensuring proper decryption timing after login.

### Data Persistence & Caching Strategy

**Cloud-First Architecture** (implemented 2025-11-02):

The application follows a cloud-first data model with temporary local caching:

#### Authenticated Users
- **Source of Truth**: Firestore
- **Local Cache**: IndexedDB (temporary, cleared on logout)
- **Cache Strategy**: Write-through caching
  - All Firestore writes immediately cache to IndexedDB using `put()` (upsert)
  - All Firestore reads cache results to IndexedDB for offline access
  - Cache enables offline viewing and queued writes

#### Guest Users
- **Source of Truth**: IndexedDB
- **Persistence**: Data remains until login
- **On Login**: Guest data merges to Firestore, then IndexedDB is cleared

#### Logout Behavior
1. **Sync Attempt**: 30-second attempt to sync queued operations
   - Success: All data uploaded to Firestore
   - Timeout: Warning displayed, user allowed to continue
2. **Local Cleanup**: ALL IndexedDB data cleared (`preserveGuestData: false`)
3. **Result**: Zero local data for authenticated users post-logout

#### Offline Support
- **Authenticated Offline**: 
  - Read from IndexedDB cache
  - Writes queue in sync queue
  - Auto-sync when reconnected
- **Write Pattern**:
  ```typescript
  // Online: Write to both
  await addDoc(firestore, data);
  await databaseService.updateTrip(data); // Cache with put()
  
  // Offline: Queue for sync
  await databaseService.updateTrip(data);
  this.queueOperation('create', 'trips', data);
  ```

#### Duplicate Prevention
**Issue**: Multiple Firestore documents can have the same local ID field, causing UI duplicates.

**Solution**: Automatic deduplication on read
- All read operations (`getAllTrips`, `getTripsByDate`, `getAllWeatherLogs`, `getWeatherLogsByTripId`, `getAllFishCaught`, `getFishCaughtByTripId`) deduplicate results by local ID
- Keeps newest version based on `updatedAt` timestamp
- Transparent logging: `Deduplication: Replacing ID {id} (older: {time}, newer: {time})`
- No manual cleanup required

**Implementation**:
```typescript
private deduplicateById<T extends { id: number | string; updatedAt?: string }>(records: T[]): T[] {
  // Groups by ID, keeps newest by updatedAt timestamp
  // Returns deduplicated array
}
```

**Cache Method Safety**:
- Uses `updateTrip()`, `updateWeatherLog()`, `updateFishCaught()` for caching
- These methods use IndexedDB `put()` operation (upsert)
- Prevents duplicate creation when ID already exists
- Safe for both create and update scenarios
- Trip Log consumer flows (trip list, weather, fish) now invoke the same cloud-first read paths, so IndexedDB stays hydrated before filtering in-memory.
- If the encryption service is not ready (no deterministic key yet), Firestore reads skip IndexedDB caching altogether; once the key comes online the service triggers a rehydrate pass to refresh cached data with decrypted payloads.

### Encryption Salt & Key Lifecycle
- `ensureUserSalt(uid)` will now bail if Firestore cannot provide a salt instead of inventing a new one; this prevents inadvertent key rotation when offline.
- `encryptionService.setDeterministicKey()` requires an existing salt (synced from Firestore or previously cached). If none is available it logs a warning and leaves the service in “not ready” mode.
- Components must wait for `encryptionReady=true` before assuming decrypted data exists. When that flag flips, `firebaseDataService.rehydrateCachedData()` fetches trips/weather/fish to populate IndexedDB with plaintext.

## 4) UI Data ERD

```mermaid
erDiagram
  AUTH_USER ||--|| USER_SETTINGS : "has"
  AUTH_USER ||--o{ TRIPS : "views/edits"
  AUTH_USER ||--o{ SAVED_LOCATIONS : "manages"
  TRIPS ||--o{ WEATHER_LOGS : "logs"
  TRIPS ||--o{ FISH_CAUGHT : "records"
  FISH_CAUGHT o{--o{ TACKLE_ITEMS : "uses"
  USER_SETTINGS ||--o{ GEAR_TYPES : "names for gear"
  MODAL_STATE o|--|| TRIPS : "tripLog/tripDetails"
  MODAL_STATE o|--|| FISH_CAUGHT : "fishCatch"
  MODAL_STATE o|--|| WEATHER_LOGS : "weatherLog"
  MODAL_STATE o|--|| TACKLE_ITEMS : "gearSelection/tackleBox"
  MODAL_STATE o|--|| SAVED_LOCATIONS : "settings"

  AUTH_USER { string uid PK }
  SAVED_LOCATIONS {
    string id PK
    string name
    number lat
    number lon
    string water
    string location
    string notes
  }
  MODAL_STATE {
    boolean isOpen
    enum type "lunar|tripLog|tripDetails|tackleBox|analytics|settings|search|gallery|weather|gearSelection|fishCatch"
    any data
  }
  GEAR_TYPES { string[] names }
```

Notes:
- Saved locations are managed exclusively through Settings modal (consolidated from previously duplicated UI in CurrentMoonInfo, LunarModal, and Settings).
- Settings modal surfaces a single saved location card at a time: the dropdown (or search) selection becomes the active record for management actions (edit/delete). When nothing is selected, the manage panel shows guidance instead of listing every saved location.
- CurrentMoonInfo and LunarModal provide read-only location displays with "Change Location" / "Set Location" buttons that open Settings.
- LocationContext provides app-wide access to saved locations state and CRUD operations.
- Saved locations can be selected to auto-fill water and location fields in trip forms.
- Location search includes GPS location detection, Google Places autocomplete, and manual coordinate entry.

## 5) Date and Time Handling for Tide Data

### Timezone-Safe Date Construction

Tide data requests require careful date handling to ensure local calendar dates are correctly represented in UTC for API queries and cache keys.

**Problem**: JavaScript's default `new Date()` behavior can cause off-by-one date errors in timezones ahead of UTC (e.g., New Zealand UTC+13):
- Creating `new Date()` then `setUTCHours(0,0,0,0)` results in the UTC date being one day behind the local calendar date
- Example: October 27, 10:00 AM NZDT → October 26, 9:00 PM UTC → `setUTCHours(0,0,0,0)` → **October 26, 00:00 UTC (yesterday!)**

**Solution**: Use `createLocalCalendarDateUTC()` utility from `tideService.ts`:

```typescript
/**
 * Creates a Date representing a local calendar date at midnight UTC.
 * Ensures formatDate() and UTC-based operations extract the correct date
 * regardless of the user's timezone.
 */
export function createLocalCalendarDateUTC(date?: Date): Date {
  const source = date || new Date();
  return new Date(Date.UTC(
    source.getFullYear(),    // Local year
    source.getMonth(),       // Local month
    source.getDate(),        // Local day
    0, 0, 0, 0              // Midnight UTC
  ));
}
```

**Usage**:
- `CurrentMoonInfo`: Uses `createLocalCalendarDateUTC()` for tide date initialization and daily updates
- `LunarModal`: Uses `createLocalCalendarDateUTC()` for initial state and when receiving `selectedDate` prop
- Date navigation: Uses `addDays()` helper which preserves UTC date arithmetic

**Benefits**:
- Tide forecasts always match the user's local calendar date
- Both main page and lunar modal show consistent tide data for the same day
- Automatic daily refresh at midnight local time
- No timezone-related date drift or stale data

### Date Formatting for API Requests

The tide service's internal `formatDate()` function extracts UTC components:
```typescript
function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

When combined with `createLocalCalendarDateUTC()`, this ensures the formatted date string matches the local calendar date, preventing cache misses and incorrect API queries.

— End —
