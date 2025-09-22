# Technical Blueprint: Māori Fishing Calendar PWA

## 1. System Architecture

### 1.1. Overview

This application is a client-side Progressive Web App (PWA) with cloud synchronization capabilities. The core application logic, data processing, and rendering occur directly within the user's web browser. User data is stored both locally on the user's device and optionally synchronized to Firebase for cross-device access.

The system can be broken down into five main parts:
1.  **UI Layer**: The user interface, responsible for displaying the calendar, modals, forms, analytics, and sync status.
2.  **Application Logic Layer**: The core JavaScript code that manages state, handles user input, performs calculations (e.g., bite times), and orchestrates data flow.
3.  **Storage Layer**: A hybrid persistence layer using Firebase as the primary cloud store with IndexedDB/localStorage as local cache and offline fallback.
4.  **Synchronization Layer**: Manages offline/online transitions, data queuing, and conflict resolution.
5.  **External Services**: Third-party APIs (weather, geolocation) and Firebase services (authentication, database, storage).

### 1.2. Architecture Diagram

```mermaid
graph TD
     User --> PWA[Progressive Web App]

     PWA --> AppLogic[Application Logic JS]
     AppLogic --> UILayer[UI Layer HTML/CSS]
     AppLogic --> SyncLayer[Synchronization Layer]
     SyncLayer --> StorageLayer[Hybrid Storage]

     StorageLayer --> Firebase[(Firebase Cloud)
     Firestore: Trips, Catches, Weather, Tackle Box
     Storage: Photos]
     StorageLayer --> LocalCache[(Local Cache)
     IndexedDB: Offline Fallback
     localStorage: Settings]

     SyncLayer --> QueueSystem[Offline Queue System]
     QueueSystem --> AutoSync[Auto-sync when online]

     AppLogic --> WeatherAPI[Open-Meteo API]
     AppLogic --> GeoAPI[Nominatim API]
     AppLogic --> FirebaseAuth[Firebase Auth]

     subgraph Application
         PWA
         AppLogic
         UILayer
         SyncLayer
     end

     subgraph "Storage (Cloud-first)"
         Firebase
         LocalCache
     end

     subgraph "External Services"
         WeatherAPI
         GeoAPI
         FirebaseAuth
         QueueSystem
     end
```

### 1.3. Core Principles

*   **Cloud-First with Offline Fallback**: Firebase serves as the primary data store with automatic synchronization. All core functionality works offline with local caching and queued operations.
*   **Data Privacy and Security**: User data is encrypted in transit and at rest. Firebase security rules ensure users can only access their own data. Authentication is required for cloud features.
*   **Offline First**: The application functions fully offline using local storage. Changes sync automatically when connectivity returns. Service Worker enables PWA functionality.
*   **Cross-Device Synchronization**: Authenticated users can access their data across multiple devices and browsers.
*   **Progressive Enhancement**: Core features work without authentication, cloud features enhance the experience for logged-in users.

### 1.4. External Dependencies

#### Firebase Services
*   **Authentication**: Firebase Auth - User authentication with Google OAuth and email/password
*   **Database**: Cloud Firestore - Primary cloud database for structured data (trips, catches, weather, tackle box)
*   **Storage**: Firebase Storage - Cloud storage for user-uploaded photos
*   **Security Rules**: User-scoped data access control

#### Third-Party APIs
*   **Weather Forecast**: `api.open-meteo.com` - Used to fetch daily weather forecasts for a specific latitude and longitude.
*   **Geolocation**: `nominatim.openstreetmap.org` - Used for both forward geocoding (searching for a location name) and reverse geocoding (finding a location name from GPS coordinates).

#### Libraries (via CDN)
*   **Astronomical Calculations**: `SunCalc.js` - Core library for calculating sun and moon positions, which are essential for determining bite times.
*   **Charting**: `Chart.js` - Used to render all charts in the Analytics Dashboard.
*   **File Handling**: `JSZip.js` & `PapaParse.js` - Used for the data import/export feature to create and read ZIP archives and CSV files.
*   **Styling & Icons**: `TailwindCSS` & `FontAwesome` - Used for the UI's appearance.

## 2. Data Models

The application uses a **cloud-first hybrid storage approach**:

- **Primary**: Firebase (Firestore for structured data, Storage for files)
- **Offline Fallback**: IndexedDB for structured data, localStorage for settings
- **Synchronization**: Automatic sync with conflict resolution and offline queuing

The original local storage is maintained as a fallback for offline functionality and data migration.

### 2.1. Firebase Data Models

All user data is now stored in Firebase with user-scoped security rules. The data structure remains the same but is distributed across Firestore collections and Storage buckets.

#### Firestore Collections:
- **trips**: User fishing trips with location, date, and metadata
- **fishCaught**: Individual fish catches linked to trips
- **weatherLogs**: Weather observations linked to trips
- **tackleItems**: User's fishing gear inventory
- **gearTypes**: Available gear type categories
- **userSettings**: User preferences and configuration
- **photos**: Photo metadata (actual files in Storage)

#### Firebase Storage Structure:
```
users/{userId}/photos/{filename}
```

### 2.2. Local Fallback Data Models

The original IndexedDB and localStorage structures are maintained as offline fallbacks and for data migration.

```mermaid
erDiagram
    TRIP {
        int id PK "Auto-incrementing primary key"
        string date "YYYY-MM-DD format, indexed"
        string water "e.g., Lake Taupo"
        string location "e.g., Stump Bay"
        float hours
        string companions
        string notes
    }
    WEATHER_LOG {
        int id PK "Auto-incrementing primary key"
        int tripId FK "Foreign key to TRIP"
        string timeOfDay "e.g., AM, PM"
        string sky "e.g., Sunny, Overcast"
        string windCondition "e.g., Calm, Light Winds"
        string windDirection "e.g., SW"
        float waterTemp
        float airTemp
    }
    FISH_CATCH {
        int id PK "Auto-incrementing primary key"
        int tripId FK "Foreign key to TRIP"
        string species
        string[] gear "Array of gear names"
        string length
        string weight
        string time "HH:MM format"
        string details
        string photo "Base64 encoded image data"
    }

    TRIP ||--o{ WEATHER_LOG : "has"
    TRIP ||--o{ FISH_CATCH : "has"
```

*Note: The relationship between `FISH_CATCH` and `TackleItem` (from `localStorage`) is not a strict foreign key relationship. The `gear` array in `FISH_CATCH` stores the names of the gear items as strings.*

### 2.2. IndexedDB Entities

These entities are stored in `IndexedDB` as it is well-suited for storing large amounts of structured data and provides transactional, indexed access.

#### Table: `Trip`
**Storage**: IndexedDB, `trips` object store.

| Attribute    | Type         | Description                                     | Example                  |
|--------------|--------------|-------------------------------------------------|--------------------------|
| `id` (PK)    | Integer      | Auto-incrementing unique identifier for the trip. | `1678886400000`          |
| `date`       | String       | The date of the trip in `YYYY-MM-DD` format. This field is indexed for efficient querying. | `"2023-03-15"`           |
| `water`      | String       | The name of the water body.                     | `"Lake Taupo"`           |
| `location`   | String       | A more specific location.                       | `"Stump Bay"`            |
| `hours`      | Number       | The number of hours fished.                     | `4.5`                    |
| `companions` | String       | Names of fishing companions.                    | `"John Doe, Jane Smith"` |
| `notes`      | String       | General notes about the trip.                   | `"Good bite in the morning."` |

#### Table: `FishCatch`
**Storage**: IndexedDB, `fish_caught` object store.

| Attribute | Type         | Description                                                                                             | Example                                    |
|-----------|--------------|---------------------------------------------------------------------------------------------------------|--------------------------------------------|
| `id` (PK) | Integer      | Auto-incrementing unique identifier.                                                                    | `1`                                        |
| `tripId`  | Integer      | Foreign key linking to the `Trip.id`. This field is indexed.                                            | `1678886400000`                            |
| `species` | String       | The species of the fish caught.                                                                         | `"Rainbow Trout"`                          |
| `gear`    | Array<String>| An array of gear item names and any custom bait used.                                                     | `["Spinning Rod", "Green Spinner", "Worms"]` |
| `length`  | String       | The length of the fish (stored as string to allow units like "cm").                                     | `"55cm"`                                   |
| `weight`  | String       | The weight of the fish (stored as string to allow units like "kg").                                     | `"2.5kg"`                                  |
| `time`    | String       | The time of the catch in `HH:MM` format.                                                                | `"08:30"`                                  |
| `details` | String       | Any other notes specific to this catch.                                                                 | `"Caught near the drop-off."`              |
| `photo`   | String       | A Base64 encoded string of the catch photo. Can be null.                                                | `"data:image/jpeg;base64,..."`             |

#### Table: `WeatherLog`
**Storage**: IndexedDB, `weather_logs` object store.

| Attribute       | Type    | Description                                                                   | Example           |
|-----------------|---------|-------------------------------------------------------------------------------|-------------------|
| `id` (PK)       | Integer | Auto-incrementing unique identifier.                                          | `1`               |
| `tripId`        | Integer | Foreign key linking to the `Trip.id`. This field is indexed.                  | `1678886400000`   |
| `timeOfDay`     | String  | The general time of day for the observation.                                  | `"AM"`            |
| `sky`           | String  | The sky condition (e.g., "Sunny", "Overcast").                                | `"Partly Cloudy"` |
| `windCondition` | String  | The wind strength (e.g., "Calm", "Strong Winds").                             | `"Light Winds"`   |
| `windDirection` | String  | The cardinal direction of the wind.                                           | `"SW"`            |
| `waterTemp`     | Number  | The temperature of the water.                                                 | `15`              |
| `airTemp`       | Number  | The ambient air temperature.                                                  | `18`              |

### 2.3. Local Storage (Fallback & Migration)

These entities are maintained in localStorage/IndexedDB for offline functionality and data migration. **Note**: Tackle box data has been migrated to Firebase for cross-device sync.

#### Legacy localStorage Entities (Maintained for compatibility):
- **userLocation**: User's GPS coordinates and display name
- **theme**: User's light/dark theme preference
- **migrationComplete_{userId}**: Migration status tracking
- **syncQueue_{userId}**: Offline operation queue
- **idMapping_***: Firebase ID to local ID mappings

#### Migrated to Firebase:
- **tacklebox** → Firestore `tackleItems` collection
- **gearTypes** → Firestore `gearTypes` collection

#### Object: `UserLocation`
**Storage**: `localStorage`, key: `userLocation`. Stored as a single JSON object.

| Attribute | Type   | Description                          | Example              |
|-----------|--------|--------------------------------------|----------------------|
| `lat`     | Number | Latitude of the user's location.     | `-38.6857`           |
| `lon`     | Number | Longitude of the user's location.    | `176.0702`           |
| `name`    | String | The display name of the location.    | `"Taupo, New Zealand"` |

### 2.4. Synchronization & Offline Support

The application implements a **cloud-first architecture** with robust offline capabilities:

#### Synchronization Features:
- **Real-time Sync**: Changes sync automatically when online
- **Offline Queue**: Operations performed offline are queued and executed when connectivity returns
- **Conflict Resolution**: Last-write-wins strategy for conflicting changes
- **Cross-device Sync**: Authenticated users access data across all devices

#### Offline Indicators:
- **Connection Status**: Visual indicators for online/offline state
- **Sync Status**: Shows pending operations and last sync time
- **Queue Management**: Displays number of queued operations

#### Data Integrity:
- **Fallback Storage**: Local IndexedDB/localStorage maintains offline functionality
- **Migration Support**: One-click migration of existing local data to cloud
- **Export/Import**: Works with both Firebase and local data sources

### 2.5. Application Data

This data is hardcoded within the application logic and is not stored in browser storage.

#### Object: `MaramatakaPhase`
**Storage**: Hardcoded in application logic. An array of 30 `MaramatakaPhase` objects.

| Attribute       | Type          | Description                                                              | Example                                  |
|-----------------|---------------|--------------------------------------------------------------------------|------------------------------------------|
| `name`          | String        | The Māori name for the lunar day.                                        | `"Whiro"`                                |
| `quality`       | String        | The overall fishing quality for the day ("Excellent", "Good", "Average", "Poor"). | `"Poor"`                                 |
| `description`   | String        | A brief description of the day's significance.                           | `"The new moon. An unfavourable day for fishing."` |
| `biteQualities` | Array<String> | An array of four quality ratings corresponding to the day's major and minor bite times. | `["poor", "poor", "poor", "poor"]`   |

## 3. Core Components and Behaviors

This section details the application's features, breaking them down into individual components.

### 3.1. Calendar View

**Purpose**: To provide an at-a-glance, month-by-month view of the predicted fishing quality based on the Maramataka.

**UI Components**:
*   Month/Year Header (`#currentMonth`)
*   Previous/Next Month Buttons (`#prevMonth`, `#nextMonth`)
*   Calendar Grid (`#calendarDays`)
*   Individual Day Cells (`.calendar-day`)
*   Fishing Quality Indicator (`.quality-indicator`)
*   Trip Log Indicator (`.log-indicator`)
*   Fishing Quality Legend

**Behaviors**:
1.  **Display**: On load, the calendar displays the current month and year.
2.  **Navigation**: Users can navigate to the previous or next month using the arrow buttons or by swiping left/right on the calendar grid on touch devices.
3.  **Day Rendering**: Each day in the month is rendered in a grid cell.
    *   The day's number is displayed.
    *   The day's fishing quality (determined by `getMoonPhaseData`) is shown as a color-coded dot below the number. The mapping is: Excellent (green), Good (blue), Average (amber), Poor (red).
    *   Hovering over a day reveals the quality as text (e.g., "Good") and causes a slight zoom effect.
    *   If a trip has been logged for a specific day, a small fish icon appears in the bottom-right corner of the day cell.
    *   The current day is highlighted with a distinct border.
4.  **Interaction**: Clicking on any day cell opens the **Daily Detail Modal** for that specific day.

### 3.2. Daily Detail Modal

**Purpose**: To provide a comprehensive, detailed view of all relevant fishing information for a single selected day.

**UI Components**:
*   Modal container (`#lunarModal`)
*   Day/Previous Navigation Buttons (`#modalPrevDay`, `#modalNextDay`)
*   Close Button (`#closeModal`)
*   Lunar Phase Name and Description (`#modalTitle`, `#modalSummary`)
*   Date and Fishing Quality Badge (`#modalDate`, `#modalQuality`)
*   Moon Age and Illumination details
*   Location Search Input and Buttons (`#location-input`, `#search-location-btn`, `#use-location-btn`)
*   Bite Times Display (`#majorBites`, `#minorBites`)
*   Weather Forecast Display (`#weather-forecast-content`)
*   Sun and Moon Rise/Set Times (`#sun-moon-content`)
*   Trip Log Button (`#open-trip-log-btn`)

**Behaviors**:
1.  **Opening**: The modal opens when a day is clicked on the main calendar view.
2.  **Navigation**: Users can navigate to the previous or next day using the arrow buttons or by swiping left/right on touch devices. Each navigation action re-fetches and re-renders all data for the new day.
3.  **Data Display**:
    *   The modal displays the Maramataka phase name, description, and overall fishing quality for the selected day.
    *   If a user location is set, the modal calculates and displays:
        *   **Major and Minor Bite Times**: Calculated using the `calculateBiteTimes` algorithm. Each bite time window is shown with a quality-colored fish icon.
        *   **Weather Forecast**: Fetched from the Open-Meteo API for the user's location and the selected date.
        *   **Sun/Moon Times**: Sunrise, sunset, moonrise, and moonset times are calculated using `SunCalc.js`.
    *   If no location is set, these sections prompt the user to set a location.
4.  **Location Handling**: Users can set or change their location from within this modal. See **Location Handling** (section 3.8) for details.
5.  **Trip Logging**: A button at the bottom allows the user to access the trip logging functionality for the selected day. The button text changes to "View / Manage Trip Log" if a log already exists, or "Create Trip Log" if one does not.

### 3.3. Trip Logging

**Purpose**: To allow users to create, view, update, and delete detailed logs of their fishing trips and the specific catches and weather conditions associated with them. This feature is a nested set of modals.

#### 3.3.1. Trip Log Summary Modal

**UI Components**:
*   Modal container (`#tripLogModal`)
*   "Log a New Trip" button (`#add-trip-btn`)
*   List of existing trips for the day (`#trip-log-list`)

**Behaviors**:
1.  **Opening**: Accessed by clicking the trip log button in the **Daily Detail Modal**.
2.  **Display**:
    *   Lists all trips logged for the selected date from Firebase.
    *   For each trip, it displays the water body, location, hours fished, companions, and notes.
    *   Each trip card has buttons to "Edit Trip" and "Delete Trip".
    *   Each trip card contains dedicated sections for associated **Weather Logs** and **Fish Catches**, with buttons to add new ones.
3.  **Interaction**:
    *   Clicking "Log a New Trip" opens the **Trip Details Modal** in "add" mode.
    *   Clicking "Edit Trip" opens the **Trip Details Modal** in "edit" mode, pre-filled with that trip's data.
    *   Clicking "Delete Trip" prompts for confirmation and then deletes the trip and all its associated weather and fish data from Firebase.
    *   Clicking "Add Weather" or "Add Fish" opens their respective modals.
    *   **Offline Support**: Operations queue when offline and sync when connection returns.

#### 3.3.2. Trip Details Modal (Add/Edit Trip)

**UI Components**:
*   Modal container (`#tripDetailsModal`)
*   Input fields for water body, location, hours, companions, notes.
*   "Save Trip" / "Update Trip" button.

**Behaviors**:
1.  **Data Entry**: User fills in the details for their trip. The "Save" button is disabled until at least one field has content.
2.  **Saving**: On save, the data is written to the `trips` collection in Firebase. If it's a new trip, a new document is created. If it's an edit, the existing document is updated.
3.  **Closing**: The modal closes upon saving, and the **Trip Log Summary Modal** refreshes to show the new/updated information.
4.  **Offline Support**: If offline, the operation is queued and executed when connection returns.

#### 3.3.3. Weather Log Modal (Add/Edit Weather)

**UI Components**:
*   Modal container (`#weatherModal`)
*   Dropdowns for time of day, sky conditions, wind conditions.
*   Inputs for wind direction, water temp, air temp.
*   "Save Weather" button.

**Behaviors**:
1.  **Context**: This modal is always associated with a specific trip.
2.  **Saving**: On save, the weather data is written to the `weatherLogs` collection in Firebase, linked by `tripId`.
3.  **Closing**: The modal closes, and the weather list on the parent trip card is refreshed.
4.  **Offline Support**: Operations queue when offline and sync when connection returns.

#### 3.3.4. Fish Catch Modal (Add/Edit Fish)

**UI Components**:
*   Modal container (`#fishModal`)
*   Inputs for species, length, weight, time of catch, details.
*   A button to open the **Gear Selection Modal**.
*   A file input to upload a photo.
*   "Save Fish" button.

**Behaviors**:
1.  **Context**: Always associated with a specific trip.
2.  **Gear Selection**: Users can select gear from their pre-defined Tackle Box (stored in Firebase) or enter custom bait/lures.
3.  **Photo Upload**: Users can attach a photo to the catch. Photos are uploaded to Firebase Storage and metadata stored in Firestore.
4.  **Saving**: On save, the fish data is written to the `fishCaught` collection in Firebase, linked by `tripId`.
5.  **Closing**: The modal closes, and the fish list on the parent trip card is refreshed. The total fish count for the trip is also updated.
6.  **Offline Support**: Operations queue when offline and sync when connection returns.

### 3.4. Tackle Box Management

**Purpose**: To provide a digital inventory for users to manage their fishing gear.

**UI Components**:
*   Tackle Box Button (in main header)
*   Modal container (`#tackleboxModal`)
*   Dropdowns to select existing gear items or gear types for editing.
*   "Add New Gear" and "Add New Type" buttons.
*   A form area for adding/editing a gear item's details (name, brand, type, colour).
*   A form area for adding/editing a gear type's name.

**Behaviors**:
1.  **Opening**: The user clicks the "Tackle Box" icon in the header to open the modal.
2.  **Data Storage**: All data is stored in Firebase for cross-device synchronization. Gear items are in the `tackleItems` collection, and gear types are in the `gearTypes` collection.
3.  **CRUD for Gear Items**:
    *   **Create**: Users click "Add New Gear", fill out the form, and save. A new document is added to the `tackleItems` collection.
    *   **Read**: Users select a gear item from the dropdown to view its details in the form.
    *   **Update**: After selecting an item, users can modify its details and save the changes. The corresponding document in the `tackleItems` collection is updated.
    *   **Delete**: After selecting an item, a "Delete" button appears. Clicking it (with confirmation) removes the document from the `tackleItems` collection.
4.  **CRUD for Gear Types**:
    *   **Create**: Users click "Add New Type", provide a name, and save. A new document is added to the `gearTypes` collection.
    *   **Read**: Users select a type from the dropdown to view it in the form.
    *   **Update**: After selecting a type, users can rename it. This action updates the document in the `gearTypes` collection AND updates the `type` property of all associated gear items.
    *   **Delete**: After selecting a type, a "Delete" button appears. Clicking it (with confirmation) removes the document from the `gearTypes` collection AND removes all gear items of that type.
5.  **Cross-Device Sync**: All tackle box changes sync automatically across authenticated user's devices.
6.  **Offline Support**: Operations queue when offline and sync when connection returns.

### 3.5. Analytics Dashboard

**Purpose**: To visualize the user's logged data, helping them identify patterns and insights into their fishing habits.

**UI Components**:
*   Analytics Button (in main header)
*   Modal container (`#analyticsModal`)
*   Total fish caught counter.
*   Canvas elements for charts (`#moon-phase-chart`, `#species-chart`, etc.).
*   Personal Bests display area.
*   General Insights display area.
*   Interactive Gear Insights filters (dropdowns for species and gear type).

**Behaviors**:
1.  **Opening**: The user clicks the "Analytics" icon in the header. If no fish have been logged, an alert is shown and the modal does not open.
2.  **Data Aggregation**: On open, the application reads all data from the `trips`, `fishCaught`, and `weatherLogs` collections in Firebase.
3.  **Chart Rendering**: The aggregated data is used to render several charts using `Chart.js`:
    *   **Performance by Moon Phase**: A bar chart showing the number of fish caught during each Maramataka phase.
    *   **Catch Breakdown (Pies/Bars)**: Charts showing the distribution of catches by species, location, gear, and weather conditions.
    *   Charts are not rendered if there is no relevant data to display.
4.  **Insights Display**:
    *   **General Insights**: Text-based insights are generated, such as the most successful moon phase or weather condition.
    *   **Personal Bests**: Displays the heaviest fish, longest fish, and most fish caught in a single trip.
    *   **Top Gear Performance**: An interactive section where users can filter by a target species and gear type to see a ranked list of their most successful individual gear items.
5.  **Cross-Device Analytics**: Analytics reflect data from all user's devices since data is stored in Firebase.

### 3.6. Data Management (Import/Export)

**Purpose**: To allow users to back up their data and transfer it between devices.

**UI Components**:
*   Settings Button (in main header)
*   Modal container (`#settingsModal`)
*   "Export as JSON", "Export as CSV" buttons.
*   An "Import Data" button (styled as a button, but is a file input).

**Behaviors**:
1.  **Opening**: Accessed via the "Settings" icon in the header.
2.  **Export**:
    *   User clicks an export button.
    *   The application reads all data from Firebase collections (`trips`, `fishCaught`, `weatherLogs`, `tackleItems`) and local cache.
    *   For exports including photos, Firebase Storage URLs are included (photos themselves are not downloaded for export).
    *   The data is packaged into a `.zip` archive using `JSZip`.
        *   For JSON export, the zip contains `data.json` with Firebase data structure.
        *   For CSV export, the zip contains `trips.csv`, `fish.csv`, `weather.csv`, and `tackle.csv`. `PapaParse` is used for CSV creation.
    *   The zip file is then triggered for download in the user's browser.
3.  **Import**:
    *   User clicks the "Import Data" button and selects a `.zip` or `.json` file.
    *   A confirmation prompt is shown, warning the user that importing will overwrite all existing data.
    *   If confirmed, the application logic proceeds:
        *   The selected file is read. If it's a zip, it's unzipped.
        *   The contained data (`data.json` or CSV files) is parsed.
        *   The application completely clears all existing data from Firebase collections and local cache.
        *   The parsed data is then inserted into Firebase and local cache.
        *   The page reloads to reflect the newly imported state.
4.  **Migration**: One-click migration of existing local data to Firebase for new users.

### 3.7. Photo Management

**Purpose**: To provide secure photo upload, storage, and gallery browsing with Firebase integration.

**UI Components**:
*   Photos Button (in main header) - Opens unified photo management modal
*   Photo Upload Section - File selection, title/notes input, upload progress
*   Photo Gallery - Grid display of user's uploaded photos
*   Photo Detail Modal - Full-size photo viewing with metadata

**Behaviors**:
1.  **Opening**: The user clicks the "Photos" icon in the header to access upload and gallery.
2.  **Photo Upload**:
    *   Users select image files with validation (type, size limits)
    *   Enter title and optional notes
    *   Photos uploaded to Firebase Storage under `users/{userId}/photos/`
    *   Metadata stored in Firestore with user isolation
3.  **Gallery Display**:
    *   Fetches photos from Firestore for authenticated user
    *   Displays as responsive grid with title, notes, and upload date
    *   Lazy loading for performance
4.  **Security**: All photos are user-scoped with Firebase security rules
5.  **Offline**: Uploads queue when offline, sync when connection returns

### 3.8. Catch Search

**Purpose**: To allow users to quickly find specific catch logs based on a keyword.

**UI Components**:
*   Search Button (in main header)
*   Modal container (`#searchModal`)
*   Search input field (`#search-input`)
*   Search results container (`#search-results-container`)

**Behaviors**:
1.  **Opening**: The user clicks the "Search" icon in the header.
2.  **Searching**:
    *   The user types a query (e.g., "Snapper", "January", "Stump Bay") and clicks "Search" or presses Enter.
    *   The application performs a case-insensitive search across all `FishCatch` and their associated `Trip` records. Searchable fields include species, bait, details, water body, location, and notes.
    *   The query can also be a month name to find all catches from that month.
3.  **Display**: The results are displayed as a list of cards in the results container, with each card showing the details of a matching catch.

### 3.9. Location Handling

**Purpose**: To get the user's location to provide accurate, localized bite times and weather.

**UI Components**:
*   Location input field and search/GPS buttons within the **Daily Detail Modal**.
*   A "Set Location" button on the main page if no location is stored.

**Behaviors**:
1.  **Storage**: The user's location (`lat`, `lon`, `name`) is stored in the `userLocation` object in `localStorage`.
2.  **Automatic (GPS)**:
    *   User clicks the GPS icon.
    *   The browser's `Geolocation.getCurrentPosition()` API is called to get the device's coordinates.
    *   The coordinates are sent to the Nominatim API for reverse geocoding to get a human-readable location name.
    *   The location is saved to `localStorage` and the UI is updated.
3.  **Manual (Search)**:
    *   User types a location name into the input field and clicks "Search".
    *   The query is sent to the Nominatim API for forward geocoding.
    *   If a result is found, its coordinates and display name are saved to `localStorage` and the UI is updated.
4.  **Effect**: Once a location is set, the bite time, weather, and sun/moon sections in the **Daily Detail Modal** are populated with data relevant to that location.

### 3.10. Dark/Light Theme

**Purpose**: To provide user comfort in different lighting conditions and respect user's system preferences.

**UI Components**:
*   Theme toggle button (`#theme-toggle-btn`) in the header.

**Behaviors**:
1.  **Initial State**: On first load, the theme is set based on the user's operating system preference (`prefers-color-scheme: dark`). If no preference is set, it defaults to light mode.
2.  **Toggling**:
    *   The user clicks the theme toggle button.
    *   A `dark` class is added to or removed from the `<html>` element. The UI updates accordingly via CSS rules (`dark:` variants in TailwindCSS).
    *   The icon inside the button changes from a sun to a moon, or vice-versa.
3.  **Persistence**: The user's choice (`"dark"` or `"light"`) is saved to the `theme` key in `localStorage`, overriding the system preference on subsequent visits.

## 4. Acceptance Criteria

This section provides testable criteria for each core component to ensure functional parity in any implementation.

### 4.1. Calendar View
*   **Given** the app is loaded, **When** I view the calendar, **Then** I should see a grid of days for the current month and year.
*   **Given** I am viewing the calendar, **When** I click the "next" or "previous" month button, **Then** the calendar should update to show the correct month and year.
*   **Given** any day on the calendar, **Then** it must display a color-coded indicator representing the day's fishing quality.
*   **Given** a day has a logged trip, **When** the calendar for that month is displayed, **Then** a visual indicator (e.g., a fish icon) must be present on that day's cell.
*   **Given** I click on any day cell, **Then** the "Daily Detail Modal" for that specific day must open.

### 4.2. Daily Detail Modal & Predictions
*   **Given** the Daily Detail Modal is open, **When** a user location has not been set, **Then** the bite time and weather sections must display a prompt to set a location.
*   **Given** a user location is set, **When** the modal is open for any day, **Then** it must display Major and Minor bite time windows.
*   **Given** a user location is set, **When** the modal is open for any day, **Then** it must display a weather forecast for that day and location.
*   **Given** a user location is set, **When** the modal is open for any day, **Then** it must display the sun/moon rise and set times.
*   **Given** the modal is open, **When** I click the "next" or "previous" day buttons, **Then** all data in the modal must update to reflect the new day.

### 4.3. Trip Logging
*   **Given** I am in the Trip Log modal, **When** I click "Log a New Trip", **Then** I should be presented with a form to enter trip details.
*   **Given** I have filled out the trip details form, **When** I click "Save", **Then** the trip must be saved to storage and appear in the trip list for that day.
*   **Given** an existing trip, **When** I click "Delete Trip" and confirm, **Then** the trip and all its associated fish and weather logs must be removed from storage.
*   **Given** I add a fish to a trip, **When** I save it, **Then** the fish must appear in that trip's catch list and the total fish count for the trip must update.
*   **Given** I add a photo to a fish catch, **When** I save it, **Then** the photo must be visible in the catch log.

### 4.4. Tackle Box Management
*   **Given** I add a new gear item, **When** I save it, **Then** it must appear in the list of selectable gear items.
*   **Given** I update the name of a gear type, **When** I save it, **Then** all gear items of that type must reflect the new type name.
*   **Given** I delete a gear type, **When** I confirm the action, **Then** the type must be removed from the list of types AND all gear items of that type must be deleted.

### 4.5. Analytics Dashboard
*   **Given** I have logged at least one fish, **When** I open the Analytics Dashboard, **Then** I should see charts visualizing my catch data.
*   **Given** I have not logged any fish, **When** I try to open the Analytics Dashboard, **Then** I should be shown a message and the modal should not open.
*   **Given** I am viewing the "Top Gear Performance" section, **When** I select a species from the dropdown, **Then** the list of top gear must update to show rankings only for that species.
*   **Given** data exists for it, **Then** the "Personal Bests" section must correctly display my heaviest fish, longest fish, and the trip with the most catches.

### 4.6. Data Management
*   **Given** I have existing data, **When** I click "Export", **Then** a `.zip` file containing my data should be downloaded.
*   **Given** I have a valid exported data file, **When** I select it via the "Import" button and confirm, **Then** all my current data must be replaced by the data from the file.
*   **Given** the imported file contains photos, **When** the import is complete, **Then** those photos must be correctly associated with their respective catches.

### 4.7. Photo Gallery
*   **Given** I have catches with photos, **When** I open the Photo Gallery, **Then** the photos should be displayed in a grid, grouped by month.
*   **Given** I am in the Photo Gallery, **When** I click the sort button, **Then** the order of the month groups should reverse.
*   **Given** I click on a photo in the gallery, **Then** a detail modal must open showing a larger version of that photo and its associated catch details.

## 5. Pseudocode for Core Algorithms

This section provides a language-agnostic pseudocode implementation for the application's most critical algorithm.

### 5.1. Bite Time Calculation

**Purpose**: To calculate the major and minor fishing bite times for a given date and location, based on lunar events and the Maramataka calendar.

**Function**: `calculateBiteTimes(date, latitude, longitude)`

```pseudocode
FUNCTION calculateBiteTimes(date, lat, lon):
  // 1. Pre-computation and Data Retrieval
  // Get moon event times for the given date and location using an astronomical library (e.g., SunCalc.js).
  moonEvents = getMoonTimes(date, lat, lon) // Returns moonrise and moonset times

  // Get moon transit events (when it crosses the meridian). This is a complex calculation
  // that may require a specialized function. See note below.
  moonTransits = getMoonTransits(date, lat, lon) // Returns array of {time, is_overhead}

  // Determine the Maramataka phase for the given date.
  maramatakaPhase = getMaramatakaPhaseForDate(date) // Returns a MaramatakaPhase object

  // Get the specific bite qualities for today's phase.
  // e.g., ["excellent", "good", "average", "fair"]
  biteQualities = maramatakaPhase.biteQualities

  // 2. Calculate Major Bite Times (based on Moon Transits)
  majorBites = []
  FOR each transit in moonTransits:
    // A major bite is a 2-hour window centered on the transit time.
    startTime = transit.time - 1 hour
    endTime = transit.time + 1 hour

    // Assign quality from the pre-defined list for the current phase.
    // The first transit gets the first quality, the second gets the second.
    quality = biteQualities[indexOf(transit)] // e.g., quality = biteQualities[0]

    ADD {start: startTime, end: endTime, quality: quality} to majorBites
  ENDFOR

  // 3. Calculate Minor Bite Times (based on Moonrise and Moonset)
  minorBites = []
  IF moonEvents.rise is valid:
    // A minor bite is a 1-hour window centered on the moonrise time.
    startTime = moonEvents.rise - 30 minutes
    endTime = moonEvents.rise + 30 minutes
    quality = biteQualities[2] // Third quality is for moonrise

    ADD {start: startTime, end: endTime, quality: quality} to minorBites
  ENDIF

  IF moonEvents.set is valid:
    // A minor bite is a 1-hour window centered on the moonset time.
    startTime = moonEvents.set - 30 minutes
    endTime = moonEvents.set + 30 minutes
    quality = biteQualities[3] // Fourth quality is for moonset

    ADD {start: startTime, end: endTime, quality: quality} to minorBites
  ENDIF

  // 4. Return the results
  RETURN {major: majorBites, minor: minorBites}

ENDFUNCTION
```

**Note on `getMoonTransits`**: This is a non-trivial astronomical calculation. The original implementation iterates through the hours of the day, checking the moon's azimuth (horizontal position) from an astronomical library. A transit occurs when the azimuth crosses 0 (due South) or 180 (due North). A simpler approach for a new implementation could be to find the time of the moon's highest position (`moon.altitude`) for the day (upper transit) and the time of its lowest position (lower transit, which may be below the horizon).