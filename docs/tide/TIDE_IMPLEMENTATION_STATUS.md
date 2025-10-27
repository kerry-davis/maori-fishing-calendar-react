# Tide Service Implementation Status

**Last Updated**: October 2025

## Current Provider Configuration

### Provider Priority (Waterfall Fallback)
1. **🥇 NIWA API (Official NZ)** - Primary provider
2. **🥈 Open-Meteo (Enhanced NZ)** - Secondary fallback  
3. **🥉 Original Tide Service** - Final fallback

### NIWA API Integration ✅

**Status**: Implemented and working with proxy

**Implementation Details**:
- Proxy endpoint: `http://127.0.0.1:8788/api/niwa-tides` (dev) / `https://your-domain.com/api/niwa-tides` (production)
- Cloudflare Pages Functions proxy protects API key server-side
- Coverage: New Zealand coastal waters only
- Accuracy: Official MetOcean Solutions data with local harbor corrections
- Returns UTC timestamps with 'Z' suffix: `"2025-10-26T12:58:00Z"`

**Timezone Handling**:
- NIWA returns UTC timestamps (ISO 8601 with Z suffix)
- `getUtcDateFromTideTime()` detects Z suffix and parses as UTC
- Display formatter converts to Pacific/Auckland for correct local time display
- Fixed date filtering bug where offset was erroneously subtracted

**Running Locally**:
```bash
# Start proxy server
npm run dev:cf

# Access app at http://127.0.0.1:8788
# NIWA proxy available at /api/niwa-tides
```

**Requirements**:
- `.dev.vars` file with `NIWA_API_KEY=your_key_here`
- Cloudflare account for production deployment

### Open-Meteo Integration ✅

**Status**: Implemented and working as fallback

**Implementation Details**:
- Direct API access (no proxy needed)
- Global coverage with enhanced NZ support
- Returns local timestamps without timezone suffix: `"2025-10-27T01:00:00"`
- Less accurate than NIWA but provides reliable fallback

**Timezone Handling**:
- Open-Meteo returns timestamps in target timezone (Pacific/Auckland for NZ)
- `getUtcDateFromTideTime()` detects missing Z suffix and parses as local time
- Timezone-aware filtering ensures only selected date's tides are displayed
- Fixed bug where Tuesday tides appeared when Monday was selected

**Key Fixes Applied**:
- Added timezone-aware date filtering using `Intl.DateTimeFormat`
- Extrema filtered by converting timestamps to target timezone before comparison
- Display formatter correctly handles local timestamps

## Recent Fixes

### Timezone Handling Improvements (Oct 2025)

**Problem**: Tide times were displaying incorrectly due to timezone parsing issues:
- NIWA: Date display was off by one day due to erroneous offset subtraction
- Open-Meteo: Showed tides from adjacent days (e.g., Tuesday tides when Monday selected)

**Root Causes**:
1. **NIWA**: `getUtcDateFromTideTime()` was subtracting UTC offset when creating Date objects, causing date to shift backwards
2. **Open-Meteo**: Timestamps without Z suffix were being parsed as UTC instead of local time

**Solutions Implemented**:

1. **Unified `getUtcDateFromTideTime()` Function**:
   ```typescript
   export function getUtcDateFromTideTime(time: string): Date {
     // Detect timestamp format
     if (time.endsWith('Z') || time.includes('+')) {
       // NIWA format: UTC timestamp - parse with Date.UTC()
       return new Date(Date.UTC(year, month - 1, day, hours, minutes));
     } else {
       // Open-Meteo format: Local timestamp - parse with new Date()
       return new Date(time);
     }
   }
   ```

2. **Timezone-Aware Filtering for Open-Meteo**:
   ```typescript
   const formatter = new Intl.DateTimeFormat("en-CA", {
     timeZone: json.timezone || "auto",
     year: "numeric",
     month: "2-digit",
     day: "2-digit"
   });
   
   const extremaForRange = allExtrema.filter((extremum) => {
     const extremumDate = new Date(extremum.time);
     const localDateString = formatter.format(extremumDate);
     return localDateString === targetDate;
   });
   ```

3. **Consistent Display Formatting**:
   - All tide times use `toLocaleString({ timeZone: tide.timezone })` for display
   - Timezone information passed through TideForecast object
   - Works correctly for both UTC and local timestamps

**Testing Status**: ✅
- NIWA: Correctly displays dates in NZ timezone
- Open-Meteo: Only shows tides for selected date
- Both providers work correctly with timezone-aware filtering

## Calendar Integration

### Date Handling
- Calendar uses `Date.UTC()` for all date creation to ensure timezone independence
- Tide queries use `setUTCHours(12, 0, 0, 0)` to query midday of target date
- Prevents date shifting across timezone boundaries

### Display Components
- **CurrentMoonInfo**: Shows current location's tide forecast
- **LunarModal**: Shows detailed tide forecast for selected calendar date
- **TideSummary**: Reusable component for tide display
- **TideChart**: Visual tide chart with timezone-aware labels

## Location Management Integration

### Consolidated UI (Oct 2025)

**Before**: Location search UI duplicated in three places (Settings, CurrentMoonInfo, LunarModal)

**After**: Single source of truth in Settings modal
- Settings Modal: Full location management (search, GPS, clear, CRUD)
- CurrentMoonInfo: Read-only display with "Change Location" button
- LunarModal: Read-only display with "Set Location" button
- All location buttons navigate to Settings modal

**Benefits**:
- Reduced code duplication (-280 lines)
- Consistent UX across app
- Easier maintenance
- Single source of truth

## Testing

### Test Coverage ✅
- **useSavedLocations hook**: 12 tests passing
- **SavedLocationSelector component**: 15+ tests passing
- Tide timezone handling: Manually verified with both providers

### Manual Testing Checklist
- [ ] NIWA proxy working locally (`npm run dev:cf`)
- [ ] NIWA tides display correctly for selected date
- [ ] Open-Meteo fallback works when NIWA unavailable
- [ ] Calendar dates don't shift across timezones
- [ ] Tide times display in correct timezone
- [ ] No duplicate tides from adjacent days
- [ ] Location management through Settings works
- [ ] Location selection updates tide forecast

## Known Limitations

1. **NIWA Coverage**: New Zealand waters only - Open-Meteo handles other regions
2. **Proxy Dependency**: NIWA requires proxy server for API key security
3. **Rate Limits**: Both APIs have rate limits (not currently enforced client-side)
4. **Accuracy**: Open-Meteo less accurate than NIWA for NZ harbors

## Future Improvements

- [ ] Add rate limiting and caching
- [ ] Implement retry logic with exponential backoff
- [ ] Add tide quality indicators (NIWA vs Open-Meteo)
- [ ] Support additional tide providers for better global coverage
- [ ] Add offline caching for tide data
- [ ] Implement tide prediction accuracy tracking

## Related Documentation

- `NIWA_PROXY_DEPLOYMENT.md` - Cloudflare proxy setup
- `DATA_MODEL.md` - Location and tide data structures
- `SECURITY.md` - API key security practices
- Service READMEs in `src/shared/services/`

---

**Status Summary**: ✅ Production ready with NIWA primary and Open-Meteo fallback
