# PR Cleanup Plan - Address Review Feedback

## Issue 1: Separate Unrelated Changes

### Current Problem
The PR mixes two separate features:
1. **Location management simplification** (main feature)
2. **Tide timezone fix** (unrelated bug fix)

### Solution: Create Two Separate Commits

#### Step 1: Commit the Tide Timezone Fix First

```bash
# Stage only tide-related files
git add src/features/calendar/CalendarGrid.tsx
git add src/shared/services/tideService.ts
git add src/shared/services/niwaTideService.ts
git add src/features/weather/WeatherForecast.tsx
git add .tasks/fix/tide-timezone-fix-completed.md

# Create focused commit
git commit -m "fix: resolve tide date timezone offset issues

- Remove +24hr workaround from tideService and niwaTideService
- Use Date.UTC() in CalendarGrid for timezone-independent dates
- Use setUTCHours() in CurrentMoonInfo for tide date
- Add JSDoc documentation explaining UTC requirements
- Add Tide Forecast section header in WeatherForecast

Root cause: Calendar dates were created in local timezone, 
causing off-by-one date errors when UTC components were 
extracted for API calls in different timezones.

Fixes: Users in NZDT/AEDT seeing previous day's tide data"
```

#### Step 2: Commit Location Management Changes

```bash
# Stage location management files
git add src/app/App.tsx
git add src/features/modals/LunarModal.tsx
git add src/features/modals/SettingsModal.tsx
git add src/features/moon/CurrentMoonInfo.tsx

# Commit location changes
git commit -m "feat: simplify location management and fix dark mode

BREAKING CHANGE: Location search/GPS now only in Settings Modal

Consolidation:
- Move all location search UI to Settings Modal (GPS + autocomplete)
- Add 'Clear Location' button to Settings
- Remove duplicate search from CurrentMoonInfo (-140 lines)
- Remove duplicate search from LunarModal (-140 lines)
- Add 'Change Location' button to CurrentMoonInfo
- Add 'Set Location' button to LunarModal

Dark Mode Fixes:
- Replace hardcoded #000000 colors with CSS variables in LunarModal
- Use var(--primary-text) and var(--secondary-text) for visibility
- Match button styling across components

Co-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>"
```

#### Step 3: Clean up task files
```bash
git add .tasks/commands.txt
git commit -m "chore: update task tracking"
```

---

## Issue 2: Add Missing Tests

### Test Coverage Needed

1. **useSavedLocations hook** - Core business logic
2. **SavedLocationSelector component** - UI interactions
3. **Location CRUD in firebaseDataService** - Data layer

### Implementation Plan

#### Test 1: useSavedLocations Hook (Priority: HIGH)

**File:** `src/shared/hooks/__tests__/useSavedLocations.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSavedLocations } from '../useSavedLocations';

// Mock firebaseDataService
vi.mock('@shared/services/firebaseDataService', () => ({
  firebaseDataService: {
    isReady: vi.fn(() => false),
    getSavedLocations: vi.fn(),
    createSavedLocation: vi.fn(),
    updateSavedLocation: vi.fn(),
    deleteSavedLocation: vi.fn(),
  },
}));

describe('useSavedLocations', () => {
  describe('10-location limit', () => {
    it('enforces maximum of 10 saved locations', async () => {
      // Test implementation
    });

    it('prevents creation when limit reached', async () => {
      // Test implementation
    });
  });

  describe('Duplicate detection', () => {
    it('detects duplicate within 11m (0.0001 degrees)', async () => {
      // Test implementation
    });

    it('allows location outside 11m tolerance', async () => {
      // Test implementation
    });
  });

  describe('Guest mode', () => {
    it('uses localStorage for guest users', async () => {
      // Test implementation
    });

    it('migrates to Firestore on sign in', async () => {
      // Test implementation
    });
  });

  describe('Field encryption', () => {
    it('encrypts sensitive fields (name, water, location, notes)', async () => {
      // Test implementation
    });

    it('preserves coordinates as plaintext', async () => {
      // Test implementation
    });
  });
});
```

#### Test 2: SavedLocationSelector Component (Priority: MEDIUM)

**File:** `src/features/locations/__tests__/SavedLocationSelector.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SavedLocationSelector } from '../SavedLocationSelector';

// Mock LocationContext
const mockLocationContext = {
  savedLocations: [],
  createSavedLocation: vi.fn(),
  updateSavedLocation: vi.fn(),
  deleteSavedLocation: vi.fn(),
  selectSavedLocation: vi.fn(),
};

vi.mock('@app/providers/LocationContext', () => ({
  useLocationContext: () => mockLocationContext,
}));

describe('SavedLocationSelector', () => {
  describe('Form validation', () => {
    it('requires location name', async () => {
      // Test implementation
    });

    it('validates latitude range (-90 to 90)', async () => {
      // Test implementation
    });

    it('validates longitude range (-180 to 180)', async () => {
      // Test implementation
    });
  });

  describe('CRUD operations', () => {
    it('creates new location successfully', async () => {
      // Test implementation
    });

    it('updates existing location', async () => {
      // Test implementation
    });

    it('deletes location with confirmation', async () => {
      // Test implementation
    });

    it('selects location and triggers callback', async () => {
      // Test implementation
    });
  });

  describe('Search functionality', () => {
    it('filters locations by name', async () => {
      // Test implementation
    });

    it('searches water body field', async () => {
      // Test implementation
    });
  });

  describe('Limit enforcement', () => {
    it('disables add button when limit reached', async () => {
      // Test implementation
    });

    it('shows limit message', async () => {
      // Test implementation
    });
  });
});
```

#### Test 3: Simplified Integration Test (Priority: LOW)

**File:** `src/features/locations/__tests__/savedLocations.integration.test.ts`

```typescript
import { describe, it, expect } from 'vitest';

describe('Saved Locations Integration', () => {
  it('full workflow: create, select, update, delete', async () => {
    // End-to-end test of complete user flow
  });

  it('handles network errors gracefully', async () => {
    // Test error handling
  });
});
```

---

## Execution Steps

### Phase 1: Organize Commits (30 minutes)

```bash
# 1. Commit tide timezone fix
git add src/features/calendar/CalendarGrid.tsx \
        src/shared/services/tideService.ts \
        src/shared/services/niwaTideService.ts \
        src/features/weather/WeatherForecast.tsx \
        .tasks/fix/tide-timezone-fix-completed.md
git commit -m "fix: resolve tide date timezone offset issues..."

# 2. Commit location management
git add src/app/App.tsx \
        src/features/modals/LunarModal.tsx \
        src/features/modals/SettingsModal.tsx \
        src/features/moon/CurrentMoonInfo.tsx
git commit -m "feat: simplify location management and fix dark mode..."

# 3. Commit task files
git add .tasks/commands.txt .tasks/fix/cleanup-plan.md
git commit -m "chore: update task tracking"

# 4. Verify clean working tree
git status
```

### Phase 2: Add Basic Tests (1-2 hours)

```bash
# 1. Create test file for useSavedLocations
# (File creation and implementation)

# 2. Create test file for SavedLocationSelector  
# (File creation and implementation)

# 3. Run tests
npm run test:run

# 4. Commit tests
git add src/shared/hooks/__tests__/useSavedLocations.test.ts \
        src/features/locations/__tests__/SavedLocationSelector.test.tsx
git commit -m "test: add tests for saved locations feature

- Add useSavedLocations hook tests (limit, duplicates, encryption)
- Add SavedLocationSelector component tests (CRUD, validation)
- Achieve ~70% coverage on new code"
```

### Phase 3: Final Verification

```bash
# 1. Run all tests
npm run test:run

# 2. Build check
npm run build

# 3. Lint check
npm run lint

# 4. Review commits
git log --oneline -4

# 5. Push when ready
git push origin feature/add-locations
```

---

## Expected Outcomes

### After Phase 1 (Commit Organization)
✅ Clean commit history with logical separation
✅ Tide fix can be cherry-picked independently if needed
✅ Location feature has focused commit message
✅ Easy to review changes per commit

### After Phase 2 (Tests Added)
✅ Core business logic tested (useSavedLocations)
✅ UI interactions tested (SavedLocationSelector)
✅ ~60-70% test coverage on new code
✅ Confidence in limit enforcement and duplicate detection

### Final PR Status
✅ Commits organized logically
✅ Tests cover critical functionality
✅ Build passes
✅ Ready for review and merge

---

## Time Estimate

- **Phase 1 (Commit organization):** 30 minutes
- **Phase 2 (Basic tests):** 1-2 hours
- **Phase 3 (Verification):** 15 minutes

**Total:** ~2-3 hours to address all review feedback
