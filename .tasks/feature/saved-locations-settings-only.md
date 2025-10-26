# Saved Locations - Settings Modal Only

## Date: 2025-10-26

## Change Summary

**Requirement**: Only provide edit location features in the Settings modal, not on the main screen or other modals.

## Files Modified

### ✅ Removed SavedLocationSelector From:

1. **src/features/moon/CurrentMoonInfo.tsx**
   - Removed import
   - Removed `SavedLocation` type import
   - Removed `savedLocations` from useLocationContext
   - Removed `selectedSavedLocationId` state
   - Removed `handleSavedLocationSelect` callback
   - Removed auto-matching useEffect
   - Removed `setSelectedSavedLocationId` calls
   - Removed `<SavedLocationSelector />` component

2. **src/features/modals/LunarModal.tsx**
   - Removed import
   - Removed `<SavedLocationSelector />` component

3. **src/features/modals/TripFormModal.tsx**
   - Removed import
   - Removed `<SavedLocationSelector />` component

4. **src/features/modals/TripDetailsModal.tsx**
   - Removed import
   - Removed `<SavedLocationSelector />` component

### ✅ Kept SavedLocationSelector In:

1. **src/features/modals/SettingsModal.tsx**
   - ✅ Only location with edit/delete functionality
   - ✅ `allowManage={false}` - shows only selected location with Edit/Delete buttons
   - ✅ No auto-matching - dropdown empty until explicitly selected
   - ✅ `showSaveCurrentButton` - can save current location
   - ✅ Selector errors stay in selector area
   - ✅ Form errors stay in modal

## User Experience

### Settings Modal
- **Initial State**: Dropdown is empty, no locations shown
- **Select Location**: Choose from dropdown → shows that location with Edit/Delete buttons below
- **Save Current**: Click button → modal opens → enter name → save
- **Duplicate Prevention**: Can't save same coordinates twice (11m tolerance)
- **Error Handling**: Duplicate errors only in form modal, not below dropdown

### Other Screens/Modals
- **NO SavedLocationSelector** - no quick switcher, no dropdown
- Users must use Settings modal to manage saved locations
- Manual location entry still works everywhere

## Technical Details

### Removed Components
- All `<SavedLocationSelector />` instances except Settings
- All related state (`selectedSavedLocationId`)
- All related handlers (`handleSavedLocationSelect`)
- All auto-matching logic

### Cleanup Status
- ✅ All imports removed
- ✅ All components removed
- ⚠️ Some unused variables remain in modal files (harmless)
  - `selectedSavedLocationId` state declarations (unused)
  - `handleSavedLocationSelect` handlers (unused)
  - `savedLocations` from context (unused)
  - These can be cleaned up later if desired

## Build Status
✅ Build successful (`npm run build:skip-types`)

## Testing Checklist

- [ ] Main screen (CurrentMoonInfo) - no saved location selector visible
- [ ] Lunar Modal - no saved location selector visible
- [ ] Trip Form Modal - no saved location selector visible
- [ ] Trip Details Modal - no saved location selector visible
- [ ] Settings Modal - saved location selector works
  - [ ] Dropdown starts empty
  - [ ] Select location shows it below with Edit/Delete
  - [ ] Save Current Location button works
  - [ ] Can't save duplicates
  - [ ] Edit button opens form with location details
  - [ ] Delete button removes location
  - [ ] Errors display correctly

## Future Cleanup (Optional)

If desired, can remove unused variables from modal files:
- `selectedSavedLocationId` state
- `handleSavedLocationSelect` callbacks
- `savedLocations` from destructuring
- Related useEffects

These are currently harmless (just unused) but could be cleaned for code cleanliness.
