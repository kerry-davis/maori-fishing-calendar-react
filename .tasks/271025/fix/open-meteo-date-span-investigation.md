# Open-Meteo Date Span Issue - Investigation

## Issue Summary
Open-Meteo (fallback provider) is showing tide extrema that span into the next day when a single day is selected.

**Current Behavior (INCORRECT):**
When Monday Oct 27 is selected:
```
Data source: Open-Meteo (Enhanced NZ)
High, Mon, 27 Oct, 2:00 pm (1.22 m)   ← Monday ✓
Low, Mon, 27 Oct, 8:00 pm (-0.62 m)   ← Monday ✓
High, Tue, 28 Oct, 2:00 am (1.34 m)   ← Tuesday ❌
Low, Tue, 28 Oct, 9:00 am (-0.31 m)   ← Tuesday ❌
```

**Expected Behavior:**
Should only show Monday's tides:
```
Data source: Open-Meteo (Enhanced NZ)
High, Mon, 27 Oct, XX:XX am (X.XX m)   ← Monday ✓
Low, Mon, 27 Oct, XX:XX am (X.XX m)    ← Monday ✓
High, Mon, 27 Oct, 2:00 pm (1.22 m)    ← Monday ✓
Low, Mon, 27 Oct, 8:00 pm (-0.62 m)    ← Monday ✓
```

**NIWA (correct for comparison):**
```
Data source: NIWA API (Official NZ)✓
High, Mon, 27 Oct, 1:58 am (2.22 m)   ← Monday ✓
Low, Mon, 27 Oct, 8:14 am (0.59 m)    ← Monday ✓
High, Mon, 27 Oct, 2:30 pm (2.18 m)   ← Monday ✓
Low, Mon, 27 Oct, 8:36 pm (0.77 m)    ← Monday ✓
```

---

## Debug Logging Added

### Location: `src/shared/services/tideService.ts` (fetchOpenMeteoTideForecast)

Added comprehensive console.log statements to trace:

```javascript
🔍 Open-Meteo - Target date: 2025-10-27
🔍 Open-Meteo - All extrema found: X
🔍 Open-Meteo - First 6 extrema times: [type:time, ...]
🔍 Open-Meteo - Filtered extrema: X
🔍 Open-Meteo - Filtered extrema times: [type:time, ...]
🔍 Open-Meteo - Final extrema count: X
🔍 Open-Meteo - Final extrema: [type:time, ...]
```

---

## How to Test

### 1. Build and Run
```bash
# Build with debug logging
npm run build

# Run dev server (or deploy to staging)
npm run dev
```

### 2. Reproduce the Issue
1. Open browser console (F12)
2. Clear console
3. Navigate to the app
4. Set location to New Zealand (or any location where Open-Meteo is used)
5. Click on **Monday Oct 27** in calendar
6. Look for the 🔍 Open-Meteo logs

### 3. Collect Debug Output
Copy ALL lines starting with `🔍 Open-Meteo` and paste them here or in console.log.

---

## What the Logs Will Reveal

### Scenario A: Filter Working, But Not Enough Monday Extrema

**Expected logs:**
```
🔍 Open-Meteo - Target date: 2025-10-27
🔍 Open-Meteo - All extrema found: 12
🔍 Open-Meteo - First 6 extrema times: [
  "high:2025-10-26T14:00:00+13:00",
  "low:2025-10-26T20:00:00+13:00",
  "high:2025-10-27T14:00:00+13:00",  ← Monday
  "low:2025-10-27T20:00:00+13:00",   ← Monday
  "high:2025-10-28T02:00:00+13:00",  ← Tuesday
  "low:2025-10-28T09:00:00+13:00"    ← Tuesday
]
🔍 Open-Meteo - Filtered extrema: 2
🔍 Open-Meteo - Filtered extrema times: [
  "high:2025-10-27T14:00:00+13:00",
  "low:2025-10-27T20:00:00+13:00"
]
```

**Diagnosis:** Filter is working, but Open-Meteo only finds 2 extrema for Monday (missing morning high/low). The slice(0, 4) takes those 2, but somehow Tuesday's extrema are being added afterwards.

**Root Cause:** Logic issue after filtering - maybe fallback is being triggered?

---

### Scenario B: Filter Not Working (Times in UTC)

**Expected logs:**
```
🔍 Open-Meteo - Target date: 2025-10-27
🔍 Open-Meteo - All extrema found: 12
🔍 Open-Meteo - First 6 extrema times: [
  "high:2025-10-26T01:00:00Z",  ← UTC format!
  "low:2025-10-26T07:00:00Z",
  "high:2025-10-26T13:00:00Z",  ← This is Monday in NZ timezone
  "low:2025-10-26T19:00:00Z",   ← This is Monday in NZ timezone
  "high:2025-10-27T01:00:00Z",  ← This is Monday in NZ timezone
  "low:2025-10-27T08:00:00Z"    ← This is Monday in NZ timezone
]
🔍 Open-Meteo - Filtered extrema: 2
🔍 Open-Meteo - Filtered extrema times: [
  "high:2025-10-27T01:00:00Z",
  "low:2025-10-27T08:00:00Z"
]
```

**Diagnosis:** Open-Meteo is returning times in UTC despite requesting `timezone: "auto"`. The filter `startsWith("2025-10-27")` only matches UTC times on Oct 27, but those represent Monday afternoon/evening in NZ timezone.

**Root Cause:** Need to convert UTC times to NZ timezone before filtering, similar to NIWA's approach.

---

### Scenario C: Filter Working, Fallback Adding Wrong Times

**Expected logs:**
```
🔍 Open-Meteo - Filtered extrema: 1
🔍 Open-Meteo - Filtered extrema times: ["high:2025-10-27T14:00:00+13:00"]
🔍 Open-Meteo - Final extrema count: 4
🔍 Open-Meteo - Final extrema: [
  "high:2025-10-27T14:00:00+13:00",
  "low:2025-10-27T20:00:00+13:00",
  "high:2025-10-28T02:00:00+13:00",
  "low:2025-10-28T09:00:00+13:00"
]
```

**Diagnosis:** Filter finds < 2 extrema, so `fallbackExtrema(seriesForDate)` is called. But somehow the fallback is adding Tuesday extrema even though `seriesForDate` should only contain Monday data.

**Root Cause:** Bug in how series data is filtered or fallback logic.

---

## Potential Root Causes

### 1. **Open-Meteo Returns UTC Times (Most Likely)**

Despite requesting `timezone: "auto"`, Open-Meteo might be returning times in UTC format.

**Evidence:**
- Times shown are exactly on the hour (2:00 pm, 8:00 pm, 2:00 am, 9:00 am)
- Tides don't usually occur on exact hours in local time

**Fix:**
Convert Open-Meteo times from UTC to target timezone before filtering, similar to NIWA's implementation.

```typescript
// Similar to NIWA's approach
const targetDateValues = series.filter((point) => {
  const utcDate = new Date(point.time);
  const localDateString = localFormatter.format(utcDate); // Format in NZ timezone
  return localDateString === targetDate;
});
```

### 2. **Series Data Includes Next Day**

The `seriesForDate` filter might not be working correctly, allowing Tuesday data to slip through.

**Fix:**
Debug the `series.filter((entry) => entry.time.startsWith(targetDate))` to ensure it's working.

### 3. **Fallback Extrema Logic Bug**

The `fallbackExtrema(seriesForDate)` might somehow be receiving series data that includes the next day.

**Fix:**
Add logging in `fallbackExtrema` to see what data it receives.

---

## Comparison with NIWA (Working Correctly)

NIWA handles this correctly by:

```typescript
// NIWA explicitly converts UTC times to NZ timezone before filtering
const targetDateValues = data.values.filter((point) => {
  const utcDate = new Date(point.time);
  const nzDateString = nzDateFormatter.format(utcDate);  // Convert to NZ
  const isTarget = nzDateString === targetDate;
  return isTarget;
});
```

This ensures that:
- `2025-10-26T12:58:00Z` (Sunday UTC) → `2025-10-27` (Monday NZ) → ✅ Included
- `2025-10-27T01:30:00Z` (Monday UTC) → `2025-10-27` (Monday NZ) → ✅ Included
- `2025-10-27T12:00:00Z` (Monday UTC) → `2025-10-28` (Tuesday NZ) → ❌ Excluded

---

## Next Steps

### 1. Collect Debug Output
Run the app, click Monday Oct 27, and copy all `🔍 Open-Meteo` logs.

### 2. Analyze Time Format
Check if times are in UTC (ending with `Z`) or local timezone (ending with `+13:00`).

### 3. Apply Fix Based on Findings

**If times are UTC:**
```typescript
// Add timezone conversion before filtering
const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: json.timezone ?? "Pacific/Auckland",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const extremaForRange = allExtrema.filter((extremum) => {
  const utcDate = new Date(extremum.time);
  const localDateString = formatter.format(utcDate);
  return localDateString === targetDate;
});
```

**If times are local but filter not working:**
```typescript
// Check time string format and adjust filter
console.log('Sample extremum time:', allExtrema[0]?.time);
// Then fix the startsWith logic if needed
```

---

## Files Modified
- `src/shared/services/tideService.ts` (+12 lines debug logging)

## Commits
- `8b41cc1` - debug: add Open-Meteo extrema filtering trace logs

---

**Status:** Debug logging added, waiting for test results  
**Next:** Review console output and apply appropriate fix
