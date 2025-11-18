# Database Service

The `DatabaseService` class provides a TypeScript-based interface for managing IndexedDB operations in the Māori Fishing Calendar application. It maintains full compatibility with the existing vanilla JavaScript schema while providing type safety and modern async/await patterns.

## Features

- **Type-safe operations** with full TypeScript support
- **Maintains existing schema** compatibility with the original vanilla JS app
- **Comprehensive CRUD operations** for trips, weather logs, and fish caught records
- **Error handling** with detailed error types and recovery information
- **Transaction management** for data integrity
- **Cascading deletes** to maintain referential integrity
- **Utility methods** for common operations

## Usage

### Basic Setup

```typescript
import { databaseService } from './services/databaseService';

// Initialize the database
await databaseService.initialize();

// Check if database is ready
if (databaseService.isReady()) {
  // Database is ready for operations
}
```

### Trip Operations

```typescript
// Create a new trip
const tripData = {
  date: '2024-01-15',
  water: 'Lake Taupo',
  location: 'Western Bay',
  hours: 4,
  companions: 'John Doe',
  notes: 'Great fishing day'
};

const tripId = await databaseService.createTrip(tripData);

// Get a trip by ID
const trip = await databaseService.getTripById(tripId);

// Get all trips for a specific date
const trips = await databaseService.getTripsByDate('2024-01-15');

// Update a trip
const updatedTrip = { ...trip, hours: 5 };
await databaseService.updateTrip(updatedTrip);

// Delete a trip (also deletes associated weather logs and fish)
await databaseService.deleteTrip(tripId);
```

### Weather Log Operations

```typescript
// Create a weather log
const weatherData = {
  tripId: 1,
  timeOfDay: 'Morning',
  sky: 'Partly Cloudy',
  windCondition: 'Light',
  windDirection: 'NE',
  waterTemp: '18',
  airTemp: '22'
};

const weatherId = await databaseService.createWeatherLog(weatherData);

// Get weather logs for a trip
const weatherLogs = await databaseService.getWeatherLogsByTripId(tripId);

// Update a weather log
const updatedWeather = { ...weatherLogs[0], sky: 'Clear' };
await databaseService.updateWeatherLog(updatedWeather);

// Delete a weather log
await databaseService.deleteWeatherLog(weatherId);
```

### Fish Caught Operations

```typescript
// Create a fish caught record
const fishData = {
  tripId: 1,
  species: 'Rainbow Trout',
  length: '45',
  weight: '2.5',
  time: '10:30',
  gear: ['Spinner', 'Light Rod'],
  details: 'Caught near the rocks',
  photo: 'base64-encoded-image-data' // optional
};

const fishId = await databaseService.createFishCaught(fishData);

// Get fish caught records for a trip
const fishRecords = await databaseService.getFishCaughtByTripId(tripId);

// Get fish count for a trip
const fishCount = await databaseService.getFishCountForTrip(tripId);

// Update a fish caught record
const updatedFish = { ...fishRecords[0], weight: '3.0' };
await databaseService.updateFishCaught(updatedFish);

// Delete a fish caught record
await databaseService.deleteFishCaught(fishId);
```

### Utility Operations

```typescript
// Check if a date has any trips
const hasTrips = await databaseService.hasTripsOnDate('2024-01-15');

// Get all dates that have trips (for calendar highlighting)
const datesWithTrips = await databaseService.getDatesWithTrips();

// Get all trips
const allTrips = await databaseService.getAllTrips();

// Get all weather logs
const allWeatherLogs = await databaseService.getAllWeatherLogs();

// Get all fish caught records
const allFishCaught = await databaseService.getAllFishCaught();

// Clear all data (useful for testing or reset)
await databaseService.clearAllData();
```

### Error Handling

```typescript
try {
  const trip = await databaseService.getTripById(999);
} catch (error) {
  if (error.type === 'connection') {
    // Handle connection errors
    console.error('Database connection failed:', error.message);
  } else if (error.type === 'transaction') {
    // Handle transaction errors
    console.error('Transaction failed:', error.message);
  }
  
  if (error.recoverable) {
    // Attempt recovery
  }
}
```

### Cleanup

```typescript
// Close the database connection when done
databaseService.close();
```

## Database Schema

The service maintains the following IndexedDB schema:

### Trips Store
- **Store Name**: `trips`
- **Key Path**: `id` (auto-increment)
- **Indexes**: `date`

### Weather Logs Store
- **Store Name**: `weather_logs`
- **Key Path**: `id` (auto-increment)
- **Indexes**: `tripId`

### Fish Caught Store
- **Store Name**: `fish_caught`
- **Key Path**: `id` (auto-increment)
- **Indexes**: `tripId`

## Data Types

All data types are fully typed with TypeScript interfaces:

- `Trip`: Trip information including date, location, duration, etc.
- `WeatherLog`: Weather conditions for a specific trip
- `FishCaught`: Individual fish catch records with species, size, gear, etc.
- `DatabaseError`: Structured error information with recovery hints

## Compatibility

This service is fully compatible with the existing vanilla JavaScript application's data format and schema. Data created by the original app can be read by this service, and vice versa.
# L
unar Service

The `lunarService` module provides comprehensive lunar calculations for the Māori Fishing Calendar application. It integrates with the SunCalc library to provide accurate astronomical calculations while maintaining compatibility with the existing vanilla JavaScript implementation.

## Features

- **Moon phase calculations** using the traditional Māori lunar calendar (30 phases)
- **Bite time calculations** for major and minor feeding periods
- **Sun/moon rise and set times** for any location
- **Moon transit calculations** for precise bite time predictions
- **TypeScript support** with full type safety
- **Compatibility** with existing vanilla JavaScript calculations

## Usage

### Basic Moon Phase Information

```typescript
import { 
  getMoonPhaseData, 
  getLunarPhase, 
  getCurrentMoonInfo 
} from './services/lunarService';

// Get moon phase data for a specific date
const date = new Date('2024-01-15');
const phaseData = getMoonPhaseData(date);
console.log(phaseData);
// { phaseIndex: 12, moonAge: 14.2, illumination: 0.87 }

// Get the Māori lunar phase information
const lunarPhase = getLunarPhase(date);
console.log(lunarPhase);
// { name: "Atua", quality: "Poor", biteQualities: ["fair", "poor", "poor", "poor"] }
// (Static descriptions were removed; derive any user-facing copy from live solunar quality data instead.)

// Get current moon information
const currentMoon = getCurrentMoonInfo();
console.log(currentMoon);
// { phase: {...}, moonAge: 14.2, illumination: 0.87, formattedAge: "14.2", formattedIllumination: "87%" }
```

### Bite Time Calculations

```typescript
import { calculateBiteTimes } from './services/lunarService';

// Calculate bite times for a specific date and location
const date = new Date('2024-01-15');
const lat = -36.8485; // Auckland latitude
const lon = 174.7633; // Auckland longitude

const biteTimes = calculateBiteTimes(date, lat, lon);
console.log(biteTimes);
// {
//   major: [
//     { start: "06:30", end: "08:30", quality: "fair" },
//     { start: "18:45", end: "20:45", quality: "poor" }
//   ],
//   minor: [
//     { start: "12:15", end: "13:15", quality: "poor" },
//     { start: "00:30", end: "01:30", quality: "poor" }
//   ]
// }
```

### Sun and Moon Times

```typescript
import { 
  getSunTimes, 
  getMoonTimes, 
  getSunMoonTimes, 
  formatTime 
} from './services/lunarService';

const date = new Date('2024-01-15');
const location = { lat: -36.8485, lon: 174.7633, name: 'Auckland' };

// Get sun times
const sunTimes = getSunTimes(date, location.lat, location.lon);
console.log(sunTimes);
// { sunrise: Date, sunset: Date }

// Get moon times
const moonTimes = getMoonTimes(date, location.lat, location.lon);
console.log(moonTimes);
// { moonrise: Date, moonset: Date }

// Get all times formatted as strings
const allTimes = getSunMoonTimes(date, location);
console.log(allTimes);
// { sunrise: "06:15", sunset: "20:30", moonrise: "14:22", moonset: "02:45" }

// Format individual times
const formattedTime = formatTime(sunTimes.sunrise);
console.log(formattedTime); // "06:15" or "N/A" if null
```

### Advanced Calculations

```typescript
import { getMoonTransitTimes, minutesToTime } from './services/lunarService';

// Get moon transit times (for major bite calculations)
const transits = getMoonTransitTimes(date, lat, lon);
console.log(transits);
// { transits: [{ time: Date, overhead: true }, { time: Date, overhead: false }] }

// Convert minutes to time format
const timeString = minutesToTime(90); // 90 minutes = 1:30
console.log(timeString); // "01:30"
```

## Māori Lunar Calendar

The service uses the traditional Māori lunar calendar with 30 phases, each with specific fishing qualities:

### Fishing Qualities
- **Excellent**: Best days for fishing (Hoata, Ohua, Tangaroa phases)
- **Good**: Good fishing days (Oue, Okoro, Tamatea-a-ngana, etc.)
- **Average**: Moderate fishing conditions (Tirea, Tamatea-a-hotu, etc.)
- **Poor**: Unfavorable fishing days (Whiro, Huna, Ari, etc.)

### Bite Qualities
Each lunar phase has four bite quality ratings for different times:
- **excellent**: Peak feeding times
- **good**: Good feeding activity
- **average**: Moderate activity
- **fair**: Some activity expected
- **poor**: Low activity expected

## Bite Time Calculations

The service calculates two types of bite times:

### Major Bite Times
- Based on moon transit times (when moon crosses the meridian)
- 2-hour windows (1 hour before and after transit)
- Typically 2 major periods per day
- Use the first two bite qualities from the lunar phase

### Minor Bite Times
- Based on moonrise and moonset times
- 1-hour windows (30 minutes before and after rise/set)
- Use the last two bite qualities from the lunar phase

## Location Requirements

Most functions require latitude and longitude coordinates:
- Use decimal degrees format (e.g., -36.8485, 174.7633)
- Positive values for North/East, negative for South/West
- Functions handle invalid coordinates gracefully

## Error Handling

The service includes robust error handling:
- Invalid dates are handled gracefully
- Extreme coordinates don't cause crashes
- Missing moon rise/set times are handled (polar regions)
- All functions return sensible defaults for edge cases

## Compatibility

This service maintains full compatibility with the original vanilla JavaScript implementation:
- Same calculation methods and algorithms
- Identical lunar phase data and bite qualities
- Compatible time formats and data structures
- Same SunCalc library integration

## Performance

The service is optimized for performance:
- Calculations are cached where appropriate
- Minimal external dependencies (only SunCalc)
- Efficient algorithms for transit calculations
- TypeScript compilation optimizations

---

# Tide Service

The tide service provides accurate tide forecasts using multiple data providers with automatic fallback.

## Provider Architecture

### Waterfall Fallback System
1. **NIWA API (Primary)** - Official NZ MetOcean Solutions data
2. **Open-Meteo (Secondary)** - Global coverage with enhanced NZ support
3. **Original Tide Service (Fallback)** - Legacy calculation-based service

### NIWA Integration

**Features**:
- Official NZ harbor tide data with local corrections
- High accuracy for NZ coastal waters
- UTC timestamps with 'Z' suffix
- Requires Cloudflare proxy for API key security

**Usage**:
```typescript
import { fetchNwaTideForecast } from './niwaTideService';

const forecast = await fetchNwaTideForecast(
  -38.0651053,  // lat
  174.818273,   // lon
  new Date('2025-10-27')
);
```

**Local Development**:
```bash
# Requires .dev.vars file with NIWA_API_KEY
npm run dev:cf
# Access at http://127.0.0.1:8788
```

### Open-Meteo Integration

**Features**:
- Global tide coverage
- No API key required
- Local timezone timestamps (no Z suffix)
- Automatic fallback when NIWA unavailable

**Usage**:
```typescript
import { fetchOpenMeteoTideForecast } from './tideService';

const forecast = await fetchOpenMeteoTideForecast(
  -38.0651053,  // lat
  174.818273,   // lon
  new Date('2025-10-27')
);
```

## Timezone Handling

### Unified Date Parsing

The `getUtcDateFromTideTime()` function handles both UTC and local timestamps:

```typescript
// NIWA format (UTC)
getUtcDateFromTideTime("2025-10-26T12:58:00Z")
// Parsed as UTC, displays correctly in any timezone

// Open-Meteo format (local)
getUtcDateFromTideTime("2025-10-27T01:00:00")
// Parsed as local time in target timezone
```

### Display Formatting

All tide times use timezone-aware formatting:

```typescript
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: forecast.timezone,  // e.g., "Pacific/Auckland"
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit"
});

const displayTime = formatter.format(tideDate);
```

### Date Filtering

Ensures only selected date's tides are shown:

```typescript
// Timezone-aware filtering for Open-Meteo
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: forecast.timezone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const extremaForDate = allExtrema.filter((extremum) => {
  const localDateString = formatter.format(new Date(extremum.time));
  return localDateString === targetDate;  // "2025-10-27"
});
```

## Recent Fixes

### Timezone Bug Fixes (Oct 2025)

1. **NIWA Date Display**: Removed erroneous offset subtraction that caused dates to shift backwards
2. **Open-Meteo Date Filtering**: Added timezone-aware filtering to prevent adjacent day tides
3. **Unified Timestamp Handling**: Single function handles both UTC (NIWA) and local (Open-Meteo) formats

### Calendar Integration

**Timezone-Safe Date Construction**:

The tide service provides `createLocalCalendarDateUTC()` utility for consistent date handling:

```typescript
import { createLocalCalendarDateUTC, addDays } from './tideService';

// Create a Date representing today's local calendar date
const today = createLocalCalendarDateUTC();

// Create a Date for a specific date
const specificDate = createLocalCalendarDateUTC(new Date('2025-10-27'));

// Navigate dates using UTC arithmetic
const tomorrow = addDays(today, 1);
const yesterday = addDays(today, -1);
```

**Problem it solves**: In timezones ahead of UTC (e.g., NZ UTC+13), creating `new Date()` then calling `setUTCHours(0,0,0,0)` results in the UTC date being one day behind the local calendar date.

**Solution**: `createLocalCalendarDateUTC()` uses `Date.UTC()` with local calendar components:
```typescript
export function createLocalCalendarDateUTC(date?: Date): Date {
  const source = date || new Date();
  return new Date(Date.UTC(
    source.getFullYear(),  // Local year
    source.getMonth(),     // Local month
    source.getDate(),      // Local day
    0, 0, 0, 0            // Midnight UTC
  ));
}
```

**Usage in Components**:
- `CurrentMoonInfo`: Uses for tide date initialization and daily updates
- `LunarModal`: Uses for initial state and date navigation
- Both components use the same function ensuring consistent tide data

## Location Integration

Tide forecasts integrate with saved locations:

```typescript
// Get tide forecast for saved location
const location = await getSavedLocation(locationId);
const forecast = await fetchTideForecast(
  location.lat,
  location.lon,
  new Date()
);
```

## Caching

Forecasts are cached by location and date:

```typescript
// Cache key format
const key = `${providerId}:${lat.toFixed(6)},${lon.toFixed(6)}@${date}`;

// Cache checked before API calls
if (!forceRefresh && cache.has(key)) {
  return cache.get(key);
}
```

## Error Handling

Comprehensive error types and fallback:

```typescript
try {
  const forecast = await fetchNwaTideForecast(...);
} catch (error) {
  if (error.type === 'network') {
    // Fall back to Open-Meteo
    return fetchOpenMeteoTideForecast(...);
  }
  throw error;
}
```

## Related Documentation

- `docs/tide/TIDE_IMPLEMENTATION_STATUS.md` - Current implementation details
- `docs/deployment/NIWA_PROXY_DEPLOYMENT.md` - Proxy setup guide
- `docs/tide/COMPLETE_TIDE_COMPARISON.md` - Provider accuracy analysis
