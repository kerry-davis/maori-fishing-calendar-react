#!/bin/bash
# Script to organize commits for PR cleanup
# Run this from the repository root

set -e  # Exit on error

echo "========================================="
echo "PR Cleanup: Organizing Commits"
echo "========================================="
echo ""

# Check we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Run this script from the repository root"
    exit 1
fi

# Check for uncommitted changes
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ Working tree is clean - nothing to organize"
    exit 0
fi

echo "📋 Current status:"
git status --short
echo ""

# Ask for confirmation
read -p "This will create 3 separate commits. Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted"
    exit 1
fi

echo ""
echo "========================================="
echo "Step 1: Commit Tide Timezone Fix"
echo "========================================="

# Stage tide-related files
git add src/features/calendar/CalendarGrid.tsx
git add src/shared/services/tideService.ts
git add src/shared/services/niwaTideService.ts
git add src/features/weather/WeatherForecast.tsx
git add .tasks/fix/tide-timezone-fix-completed.md

# Show what's being committed
echo "Files to commit:"
git diff --cached --name-only

# Commit with detailed message
git commit -m "fix: resolve tide date timezone offset issues

- Remove +24hr workaround from tideService and niwaTideService
- Use Date.UTC() in CalendarGrid for timezone-independent dates  
- Use setUTCHours() in CurrentMoonInfo for tide date
- Add JSDoc documentation explaining UTC requirements
- Add Tide Forecast section header in WeatherForecast

Root cause: Calendar dates were created in local timezone, 
causing off-by-one date errors when UTC components were 
extracted for API calls in different timezones.

The issue manifested as:
- User selects Oct 10 → receives tide data for Oct 9
- Problem was worse for timezones far from UTC (NZDT, AEDT)

Solution ensures all calendar dates use UTC midnight, making
date representation consistent regardless of user timezone.

Fixes #issue-with-tide-dates"

echo "✅ Tide timezone fix committed"
echo ""

echo "========================================="
echo "Step 2: Commit Location Management Changes"
echo "========================================="

# Stage location management files (including remaining CurrentMoonInfo changes)
git add src/app/App.tsx
git add src/features/modals/LunarModal.tsx
git add src/features/modals/SettingsModal.tsx
git add src/features/moon/CurrentMoonInfo.tsx

# Show what's being committed
echo "Files to commit:"
git diff --cached --name-only

# Commit with detailed message
git commit -m "feat: simplify location management and fix dark mode

BREAKING CHANGE: Location search/GPS moved to Settings Modal only

Consolidation:
- Move all location search UI to Settings Modal (GPS + autocomplete)
- Add 'Clear Location' button to Settings
- Remove duplicate search from CurrentMoonInfo (-140 lines)
- Remove duplicate search from LunarModal (-140 lines)
- Add 'Change Location' button to CurrentMoonInfo → opens Settings
- Add 'Set Location' button to LunarModal → opens Settings
- Pass onSettingsClick from App to both components

Dark Mode Fixes:
- Replace hardcoded #000000 colors with CSS variables in LunarModal
- Use var(--primary-text) for main content
- Use var(--secondary-text) for secondary content
- Match 'Set Location' button styling to 'Change Location' button

Benefits:
- Single source of truth for location management (Settings Modal)
- Removed ~280 lines of duplicate code
- Consistent UX across the app
- Better dark mode visibility

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"

echo "✅ Location management changes committed"
echo ""

echo "========================================="
echo "Step 3: Commit Tests and Task Files"
echo "========================================="

# Stage test files and task tracking
git add src/shared/hooks/__tests__/useSavedLocations.test.ts
git add src/features/locations/__tests__/SavedLocationSelector.test.tsx
git add .tasks/commands.txt
git add .tasks/fix/

# Show what's being committed
echo "Files to commit:"
git diff --cached --name-only

# Commit
git commit -m "test: add tests for saved locations feature

Test Coverage:
- useSavedLocations hook: CRUD operations, validation, events
- SavedLocationSelector: form validation, limit enforcement, search
- Test location selection, editing, deletion with confirmations
- Test error handling and edge cases

Also includes:
- Task tracking documentation
- PR cleanup plan and commit organization script

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"

echo "✅ Tests and task files committed"
echo ""

echo "========================================="
echo "✅ Commit Organization Complete!"
echo "========================================="
echo ""
echo "Summary of commits:"
git log --oneline -3
echo ""

# Check for any remaining uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "⚠️  Warning: Uncommitted changes remain:"
    git status --short
    echo ""
    echo "Review these and commit separately if needed"
else
    echo "✅ Working tree is clean"
fi

echo ""
echo "Next steps:"
echo "1. Review commits: git log -3 -p"
echo "2. Run tests: npm run test:run"
echo "3. Build check: npm run build"
echo "4. Push when ready: git push origin feature/add-locations"
echo ""
echo "✅ Done!"
