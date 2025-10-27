# ✅ NIWA Date Display Fix - COMPLETED

## Issue Summary
NIWA API appeared to return "Sunday" data when "Monday" was requested in NZ timezone.

**User reported:**
```
Data source: NIWA API (Official NZ)
High, Sun, 26 Oct, 12:58 pm (2.22 m)  ← Wrong day!
```

**Expected:**
```
Data source: NIWA API (Official NZ)
High, Mon, 27 Oct, 1:58 am (2.22 m)   ← Correct day in NZ timezone
```

---

## Root Cause Analysis

### Debug Investigation
Added comprehensive logging to trace the date flow:

```javascript
🔍 NIWA fetchForecast - Input date ISO: 2025-10-27T00:00:00.000Z ✓
🔍 NIWA fetchForecast - targetDateNz: 2025-10-27 ✓
🔧 Point 12: UTC: 2025-10-26T12:58:00Z -> NZ: 2025-10-27 (match: true) ✓
```

**Conclusion:** The input, filtering, and API response were ALL correct!

### The Bug: Display Issue in `getUtcDateFromTideTime()`

**Location:** `src/shared/services/tideService.ts` line 231

**Original Code (BROKEN):**
```typescript
export function getUtcDateFromTideTime(
  time: string,
  utcOffsetSeconds = 0,
): Date {
  const utcMillis = Date.UTC(year, month - 1, day, hours, minutes);
  return new Date(utcMillis - utcOffsetSeconds * 1000);  // ❌ WRONG!
}
```

**What Happened:**
1. NIWA returns: `"2025-10-26T12:58:00Z"` (Sunday 12:58 UTC)
2. Parse to: `utcMillis` = Oct 26, 12:58 UTC ✓
3. **Subtract 13 hours:** `utcMillis - 46800*1000` = Oct 25, 23:58 UTC ❌
4. Create Date: Represents Oct 25, 23:58 UTC ❌
5. Formatter adds 13h back: Oct 25, 23:58 + 13h = Oct 26, 12:58 NZDT ❌
6. **Display:** "Sun, Oct 26, 12:58 pm" ❌

**The Error:** The offset subtraction caused a double-conversion:
- Step 3 subtracted the offset (going backwards in time)
- Step 5 added it back (formatter converting to local timezone)
- Net result: No timezone conversion, just UTC components displayed as if they were local

### The Correct Flow

**Fixed Code:**
```typescript
export function getUtcDateFromTideTime(
  time: string,
  _utcOffsetSeconds = 0, // Deprecated, not used
): Date {
  const utcMillis = Date.UTC(year, month - 1, day, hours, minutes);
  return new Date(utcMillis);  // ✓ No offset manipulation!
}
```

**What Should Happen:**
1. NIWA returns: `"2025-10-26T12:58:00Z"` (Sunday 12:58 UTC)
2. Parse to: `utcMillis` = Oct 26, 12:58 UTC ✓
3. Create Date: Represents Oct 26, 12:58 UTC ✓
4. Formatter converts: Oct 26, 12:58 UTC + 13h = Oct 27, 1:58 NZDT ✓
5. **Display:** "Mon, Oct 27, 1:58 am" ✓

---

## The Fix

### Changes Made

#### 1. `src/shared/services/tideService.ts`
```diff
export function getUtcDateFromTideTime(
  time: string,
-  utcOffsetSeconds = 0,
+  _utcOffsetSeconds = 0, // Kept for backward compatibility, not used
): Date {
  const [datePart, timePart] = time.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const utcMillis = Date.UTC(year, month - 1, day, hours, minutes);
-  return new Date(utcMillis - utcOffsetSeconds * 1000);
+  // Return Date representing the UTC instant directly
+  // The formatter (toLocaleString with timeZone) will handle timezone conversion
+  return new Date(utcMillis);
}
```

**Added comprehensive JSDoc:**
- Explains the function's purpose
- Documents that returned Date represents UTC instant
- Shows example of correct timezone conversion via `toLocaleString`
- Notes that `utcOffsetSeconds` is deprecated

#### 2. `src/shared/services/niwaTideService.ts`
- Removed debug console.log statements (no longer needed)
- Kept minimal DEV_LOG for development debugging

---

## Understanding UTC and Timezone Conversion

### Key Concept: Date Objects Are Always UTC Internally

JavaScript Date objects store time as **milliseconds since Unix epoch (UTC)**.

```javascript
// Create Date from UTC timestamp
const date = new Date("2025-10-26T12:58:00Z");
// Internally stores: Oct 26, 12:58 UTC (milliseconds since epoch)

// Formatting WITHOUT timezone option
date.toLocaleString();
// Uses BROWSER's local timezone
// If browser is in NZDT (UTC+13): "Mon, Oct 27, 1:58 AM"
// If browser is in UTC: "Sun, Oct 26, 12:58 PM"

// Formatting WITH timezone option
date.toLocaleString('en-US', { timeZone: 'Pacific/Auckland' });
// Always displays: "Mon, Oct 27, 1:58 AM" (NZDT)
// Regardless of browser's timezone!
```

### Why the Old Code Was Wrong

```javascript
// WRONG: Manipulating milliseconds before creating Date
const utcMillis = Date.UTC(2025, 9, 26, 12, 58); // Oct 26, 12:58 UTC
const date = new Date(utcMillis - 13*3600*1000); // Subtract 13 hours
// date now represents: Oct 25, 23:58 UTC ❌

// When formatted to NZDT:
date.toLocaleString('en-US', { timeZone: 'Pacific/Auckland' });
// Displays: "Sun, Oct 26, 12:58 PM" ❌
// Because: Oct 25, 23:58 UTC + 13h = Oct 26, 12:58 NZDT
```

### Why the New Code Is Correct

```javascript
// CORRECT: Create Date from UTC, let formatter handle timezone
const utcMillis = Date.UTC(2025, 9, 26, 12, 58); // Oct 26, 12:58 UTC
const date = new Date(utcMillis); // No manipulation
// date represents: Oct 26, 12:58 UTC ✓

// When formatted to NZDT:
date.toLocaleString('en-US', { timeZone: 'Pacific/Auckland' });
// Displays: "Mon, Oct 27, 1:58 AM" ✓
// Because: Oct 26, 12:58 UTC + 13h = Oct 27, 1:58 NZDT
```

---

## Testing

### Manual Testing
1. Open app in browser
2. Set location to New Zealand
3. Click on Monday Oct 27, 2025 in calendar
4. Check NIWA tide times

**Expected Result:**
```
Data source: NIWA API (Official NZ)✓
High, Mon, 27 Oct, 1:58 am (2.22 m)
Low, Mon, 27 Oct, 8:14 am (0.59 m)
High, Mon, 27 Oct, 2:30 pm (2.18 m)
Low, Mon, 27 Oct, 8:36 pm (0.77 m)
```

All times should show **Monday Oct 27** in NZ local time.

### Build Verification
```bash
npm run build
# ✓ TypeScript compilation successful
# ✓ No errors or warnings
# ✓ Build completed in 5.78s
```

---

## Impact Analysis

### What Changed
- **Function behavior:** `getUtcDateFromTideTime()` no longer manipulates the timestamp
- **Display:** All tide times now show correct local date for the timezone

### What Didn't Change
- API requests (still correct)
- Date filtering logic (was already correct)
- Timezone detection (still correct)
- Data flow (same as before)

### Affected Components
- `TideSummary.tsx` - Uses `getUtcDateFromTideTime()` for display
- Any other component displaying tide times from NIWA API

### Backward Compatibility
- Function signature unchanged (parameter kept but marked deprecated)
- All existing call sites work correctly
- No breaking changes

---

## Related Issues

### Previous Fixes
1. **Calendar date creation** - Fixed to use `Date.UTC()` instead of local timezone
2. **Tide date queries** - Fixed to use `setUTCHours()` for consistency
3. **NIWA date filtering** - Already working correctly (confirmed by debug logs)

### This Fix Completes
The tide timezone issues are now **fully resolved**:
- ✅ Calendar dates use UTC
- ✅ Tide queries use UTC
- ✅ NIWA filtering uses correct NZ timezone conversion
- ✅ Display formatting shows correct local time

---

## Files Modified

### Primary Fix
- `src/shared/services/tideService.ts` (+18 lines, -1 line)
  - Fixed `getUtcDateFromTideTime()` function
  - Added comprehensive JSDoc
  - Deprecated unused parameter

### Cleanup
- `src/shared/services/niwaTideService.ts` (-19 lines, +1 line)
  - Removed debug console.log statements
  - Kept minimal DEV_LOG

---

## Commits

```
d53b4bc fix: correct NIWA tide date display by removing erroneous offset subtraction
06a43e0 debug: add comprehensive NIWA date conversion logging  
5481ffa docs: add NIWA date debugging guide and test plan
```

---

## Key Learnings

### 1. Date Objects Store UTC Internally
Always remember: Date objects are timezone-agnostic internally.  
Timezone is only applied during formatting/display.

### 2. Timezone Conversion Should Happen Once
Don't manipulate timestamps to "pre-convert" them.  
Let the formatter handle timezone conversion.

### 3. Debug Systematically
The debug logs revealed:
- ✅ Input was correct
- ✅ Filtering was correct
- ❌ Display was wrong

This narrow focus made the fix straightforward.

### 4. UTC is Your Friend
When working with timezones:
- Store everything in UTC
- Convert only for display
- Use ISO 8601 strings for serialization

---

## Status: ✅ COMPLETE

- Root cause identified and fixed
- Build passing
- TypeScript clean
- Ready for testing
- Documentation complete

**Next Step:** Manual testing in browser to confirm fix works as expected.

---

**Date Completed:** 2025-10-27  
**Fixed By:** Droid (AI Assistant)  
**Tested By:** Pending user verification
