# NIWA Date Mismatch Debugging Plan

## Issue Summary
NIWA API returns **Sunday Oct 26** tide data when **Monday Oct 27** is requested.  
Open-Meteo API correctly returns Monday Oct 27 data for the same request.

## Current Console Log Evidence
```
Data source: Open-Meteo (Enhanced NZ)
✓ High, Mon, 27 Oct, 1:00 am (1.22 m)    ← Correct day
✓ Low, Mon, 27 Oct, 7:00 am (-0.62 m)    ← Correct day

Data source: NIWA API (Official NZ)
✗ High, Sun, 26 Oct, 12:58 pm (2.22 m)   ← Wrong day!
✗ Low, Sun, 26 Oct, 7:14 pm (0.59 m)     ← Wrong day!
High, Mon, 27 Oct, 1:30 am (2.18 m)      ← Some Monday data
Low, Mon, 27 Oct, 7:36 am (0.77 m)       ← Some Monday data
```

## Debug Logging Added

### In `fetchForecast()` (line ~121-132)
```
🔍 NIWA fetchForecast - Input date: [Date object]
🔍 NIWA fetchForecast - Input date ISO: 2024-10-27T00:00:00.000Z
🔍 NIWA fetchForecast - Input date UTC components: {year, month, date, hours}
🔍 NIWA fetchForecast - targetDateNz: 2024-10-27
```

**What to check:**
- Is the input date actually Monday Oct 27 00:00 UTC?
- Does `targetDateNz` correctly calculate as "2024-10-27"?

### In `processTideData()` (line ~327-348)
```
🔍 NIWA processTideData - targetDate: 2024-10-27
🔍 NIWA processTideData - First 5 data points: [UTC timestamps]
🔧 Point 0: UTC: 2024-10-26T01:58:00Z -> NZ: 2024-10-26 (target: 2024-10-27, match: false)
🔧 Point 1: UTC: 2024-10-26T06:14:00Z -> NZ: 2024-10-26 (target: 2024-10-27, match: false)
...
🔧 Point 10: UTC: 2024-10-26T12:30:00Z -> NZ: 2024-10-27 (target: 2024-10-27, match: true)
🔍 NIWA processTideData - Filtered to X points
🔍 NIWA processTideData - Filtered times: [UTC timestamps of matched points]
```

**What to check:**
- Are Sunday UTC times incorrectly matching Monday target?
- Is the NZ date conversion working correctly?
- Do the filtered results only include Monday events?

## Test Procedure

### 1. Run Development Server
```bash
npm run dev
```

### 2. Open Browser Console
- Navigate to the app
- Open DevTools Console (F12)
- Clear console

### 3. Click on Monday Oct 27 in Calendar
- Watch for NIWA debug logs
- Copy ALL console output related to NIWA

### 4. Analyze Output
Compare the debug output against expected values below:

## Expected Debug Output

### Scenario: User clicks Monday Oct 27, 2024

#### Expected Input to fetchForecast:
```
🔍 NIWA fetchForecast - Input date: Mon Oct 27 2024 00:00:00 GMT+0000 (UTC)
🔍 NIWA fetchForecast - Input date ISO: 2024-10-27T00:00:00.000Z
🔍 NIWA fetchForecast - Input date UTC components: {
  year: 2024,
  month: 9,        ← October (0-indexed)
  date: 27,
  hours: 0
}
🔍 NIWA fetchForecast - targetDateNz: 2024-10-27
```

#### Expected Filtering Behavior:
```
🔧 Point X: UTC: 2024-10-26T22:00:00Z -> NZ: 2024-10-27 (target: 2024-10-27, match: true)
                    ↑ Sunday in UTC    ↑ Monday in NZ timezone (UTC+13)
```

**Key Insight:**  
Events that occur late Sunday UTC (after 11:00 UTC) become Monday in NZ timezone (UTC+13).  
For example:
- Sunday Oct 26, 23:00 UTC = Monday Oct 27, 12:00 NZDT ← Should be included!
- Sunday Oct 26, 12:00 UTC = Monday Oct 27, 01:00 NZDT ← Should be included!
- Sunday Oct 26, 01:00 UTC = Sunday Oct 26, 14:00 NZDT ← Should NOT be included!

#### Expected Filtered Results:
Should ONLY include times that are Monday in NZ timezone, even if they're Sunday in UTC.

## Potential Root Causes

### Hypothesis 1: Wrong Input Date
**Symptom:** Input date ISO shows wrong date (e.g., Oct 26 instead of Oct 27)  
**Root Cause:** Calendar is not creating Date.UTC() correctly  
**Fix:** Update CalendarGrid date creation

### Hypothesis 2: Wrong targetDateNz Calculation
**Symptom:** targetDateNz shows "2024-10-26" when it should be "2024-10-27"  
**Root Cause:** nzDateFormatter.format() misinterpreting the date  
**Fix:** Adjust how we format dates for NZ timezone

### Hypothesis 3: Incorrect Filtering Logic
**Symptom:** Filtering includes Sunday NZ times or excludes valid Monday NZ times  
**Root Cause:** The UTC → NZ conversion in filter is wrong  
**Fix:** Adjust processTideData() filtering logic

### Hypothesis 4: Display Issue, Not Filtering Issue
**Symptom:** Correct data filtered, but displayed with wrong dates  
**Root Cause:** TideSummary formats times incorrectly  
**Fix:** Update how tide extrema times are displayed

## Next Steps After Debug Output

### Once you have the console output:

1. **Check Input Date**
   - Does ISO string match clicked date?
   - Are UTC components correct?

2. **Check Target Date Calculation**
   - Does targetDateNz match expected NZ date?

3. **Check Filtering**
   - Are the correct UTC times being matched?
   - Is the UTC → NZ conversion working?

4. **Share Output**
   - Copy complete console output
   - Paste into new file: `.tasks/fix/niwa-debug-output.txt`
   - We'll analyze together

## Useful Date Conversion Reference

### NZ Timezone (NZDT) = UTC+13 (Summer)
```
Sunday Oct 26, 11:00 UTC = Monday Oct 27, 00:00 NZDT ← Midnight Monday in NZ
Sunday Oct 26, 12:00 UTC = Monday Oct 27, 01:00 NZDT ← Monday morning
Sunday Oct 26, 23:00 UTC = Monday Oct 27, 12:00 NZDT ← Monday noon
Monday Oct 27, 00:00 UTC = Monday Oct 27, 13:00 NZDT ← Monday afternoon
```

### Key Cutoff:
Events after **Sunday 11:00 UTC** should be included in Monday's data for NZ users.

## Files Modified
- `src/shared/services/niwaTideService.ts` (+18 lines debug logging)

## Commit
- `06a43e0` - debug: add comprehensive NIWA date conversion logging

---

**Status:** Debug logging added, ready for testing  
**Next Action:** Run dev server and click Monday Oct 27 in calendar  
**Expected:** Console will show detailed date conversion trace
