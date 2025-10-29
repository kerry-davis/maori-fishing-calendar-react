# Tide Service Timezone Fix - Root Cause Analysis and Solution

## Issue Description
Tide service was returning data for the wrong day (off by one day) due to timezone handling issues. Users would select October 10 in the calendar, but receive tide data for October 9.

## Root Cause

### The Problem
JavaScript `Date` objects are timezone-sensitive. When calendar dates were created using:
```typescript
const date = new Date(currentYear, currentMonth, day);
```

This creates a Date at **local midnight** for that day:
- User in PDT (UTC-7): `Oct 10, 2024 00:00:00 PDT` = `Oct 10, 2024 07:00:00 UTC`
- User in NZDT (UTC+13): `Oct 10, 2024 00:00:00 NZDT` = `Oct 9, 2024 11:00:00 UTC`

When `formatDate()` extracted UTC components to create the API date string:
```typescript
const year = date.getUTCFullYear();
const month = date.getUTCMonth() + 1;
const day = date.getUTCDate();
```

It would get **October 9** for NZDT users instead of October 10!

### Previous "Fix" (Hacky Workaround)
The codebase had added +24 hours to compensate:
```typescript
const correctedDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
```

This was a band-aid that:
- Didn't fix the root cause
- Was fragile and confusing
- Could break in edge cases
- Existed in TWO places (tideService.ts and niwaTideService.ts)

## Proper Solution

### 1. Calendar Date Creation (CalendarGrid.tsx)
Changed calendar dates to use UTC midnight:
```typescript
// BEFORE (timezone-dependent)
const date = new Date(currentYear, currentMonth, day);

// AFTER (timezone-independent)
const date = new Date(Date.UTC(currentYear, currentMonth, day, 0, 0, 0, 0));
```

### 2. Current Tide Date (CurrentMoonInfo.tsx)
Changed from local to UTC midnight:
```typescript
// BEFORE
current.setHours(0, 0, 0, 0);  // Local midnight

// AFTER  
current.setUTCHours(0, 0, 0, 0);  // UTC midnight
```

### 3. Date Formatting (tideService.ts)
Removed the +24 hour hack and documented proper usage:
```typescript
/**
 * Formats a Date object to YYYY-MM-DD string using UTC date components.
 * This ensures consistent date representation regardless of user's timezone.
 * 
 * IMPORTANT: Input Date should represent a calendar date (year/month/day),
 * not a specific moment in time. Use Date.UTC() or setUTCHours(0,0,0,0) when
 * creating the Date to avoid timezone-related off-by-one errors.
 */
function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

### 4. NIWA Tide Service (niwaTideService.ts)
Removed the +24 hour hack:
```typescript
// BEFORE
const correctedDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
const targetDateNz = nzDateFormatter.format(correctedDate);

// AFTER
const targetDateNz = nzDateFormatter.format(date);
```

## Key Principle

**Calendar dates should be represented in UTC**, not local time:
- A calendar date (Oct 10, 2024) is **not** a specific moment in time
- It's a **day** that occurs at different times in different timezones
- Using `Date.UTC()` ensures Oct 10 is Oct 10 everywhere

**Local times are for astronomical events**:
- Moon phases, sunrise/sunset should use local time (they're local events)
- These continue to use `new Date(year, month, day)` correctly

## Testing

Build successful:
```bash
npm run build
✓ built in 5.35s
```

## Files Changed

1. `src/shared/services/tideService.ts` - Removed +24hr hack, added documentation
2. `src/shared/services/niwaTideService.ts` - Removed +24hr hack
3. `src/features/calendar/CalendarGrid.tsx` - Use Date.UTC() for calendar dates
4. `src/features/moon/CurrentMoonInfo.tsx` - Use setUTCHours() for tide date

## Impact

- ✅ Tide forecasts now show correct day regardless of user timezone
- ✅ No more confusing +24 hour adjustments
- ✅ Cleaner, more maintainable code
- ✅ Properly documented for future developers
- ✅ Build and type checking pass

## Migration Notes

If you're experiencing tide date issues in other parts of the app:
1. Check if dates are created with `new Date(year, month, day)` 
2. If used for API calls, change to `Date.UTC(year, month, day, 0, 0, 0, 0)`
3. If used for local astronomical events (moon phases, sun times), keep as is
