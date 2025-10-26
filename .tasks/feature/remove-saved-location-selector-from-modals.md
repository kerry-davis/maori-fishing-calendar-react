# Remove SavedLocationSelector from Non-Settings Locations

## Goal
Only allow editing saved locations from the Settings modal, not from other places in the app.

## Files to Update

### ✅ Completed
- CurrentMoonInfo.tsx - DONE

### 🔄 Remaining
- LunarModal.tsx
- TripFormModal.tsx
- TripDetailsModal.tsx

## Changes Needed for Each File

1. Remove import: `import SavedLocationSelector from '@features/locations/SavedLocationSelector';`
2. Remove type import: `SavedLocation` from `@shared/types`
3. Remove from destructuring: `savedLocations` from `useLocationContext()`
4. Remove state: `selectedSavedLocationId`
5. Remove handler: `handleSavedLocationSelect`
6. Remove useEffect that syncs `selectedSavedLocationId`
7. Remove all `setSelectedSavedLocationId("")` calls
8. Remove JSX: `<SavedLocationSelector ... />` component

## Quick Fix Script

For each file, search and remove:
- Any line with `SavedLocationSelector`
- Any line with `selectedSavedLocationId`
- Any line with `handleSavedLocationSelect`
- The `savedLocations` from destructuring
