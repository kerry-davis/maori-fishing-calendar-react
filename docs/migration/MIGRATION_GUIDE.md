# 🐟 Māori Fishing Calendar - Legacy Data Migration Guide

This guide explains how to migrate your fishing data from the legacy vanilla JavaScript app to the new React version.

## 📊 Migration Overview

✅ **Data Compatibility**: 100% compatible
✅ **Data Preserved**: All fishing trips, weather logs, fish catches, and tackle box items
✅ **Photos**: Included in migration
✅ **Settings**: Theme and location preferences migrated

## 🚀 Migration Methods

### Method 1: Automated Migration (Recommended)

#### Step 1: Export Data from Legacy App
1. Open your legacy Māori Fishing Calendar app in a browser
2. Open Developer Tools (F12) → Console tab
3. Copy and paste this script into the console:
   ```javascript
   // Load the migration script
   const script = document.createElement('script');
   script.src = 'http://localhost:8000/migrate-from-legacy.js';
   document.head.appendChild(script);
   ```
4. Wait for the script to load, then run:
   ```javascript
   exportMigrationData();
   ```
5. Copy the JSON data that appears in the console

#### Step 2: Import Data into React App
1. Open your React Māori Fishing Calendar app
2. Sign up/login to create a user account
3. The app will automatically detect local data and show a migration prompt
4. Click "Migrate Data" to automatically import your legacy data

### Method 2: Manual Migration

#### Step 1: Export from Legacy App
1. Open legacy app in browser
2. Open DevTools Console
3. Run the migration script (from `scripts/migrate-from-legacy.js`)
4. Copy the exported JSON data

#### Step 2: Manual Import Process
1. Open React app in browser
2. Open DevTools Console
3. Use the database service to import data:
   ```javascript
   // Paste your exported data here
   const legacyData = [PASTE_YOUR_EXPORTED_JSON_HERE];

   // Import using the Firebase data service
   await window.firebaseDataService.migrateLocalData(legacyData);
   ```

## 📁 Data Structure Compatibility

| Data Type | Legacy Format | React Format | Status |
|-----------|---------------|--------------|--------|
| **Database** | fishingLog v2 | fishingLog v3 | ✅ Compatible |
| **Trips** | id, date, water, location, hours, companions, notes | Same fields | ✅ Compatible |
| **Weather** | id, tripId, timeOfDay, sky, windCondition, windDirection, waterTemp, airTemp | Same fields | ✅ Compatible |
| **Fish** | id, tripId, species, length, weight, time, gear, photo, details | Same fields | ✅ Compatible |
| **Tackle Box** | Array of items | Array of items | ✅ Compatible |
| **Settings** | localStorage | localStorage | ✅ Compatible |

## 🔧 Migration Scripts

### Available Scripts:
- `scripts/migrate-from-legacy.js` - Extracts data from legacy app
- `scripts/import-legacy-data.js` - Imports data into React app
- `scripts/verify-data-compatibility.js` - Verifies compatibility

### Using the Scripts:
```bash
# Verify data compatibility
node scripts/verify-data-compatibility.js

# Import legacy data (after pasting into script)
node scripts/import-legacy-data.js
```

## 🛠️ Troubleshooting

### Common Issues:

**❌ "Database not found"**
- Ensure the legacy app is open and running
- Check that you're running the script in the correct browser tab

**❌ "Import failed"**
- Verify the JSON data structure is correct
- Check browser console for detailed error messages
- Ensure you're logged into the React app

**❌ "Photos not migrated"**
- Photos are included in the migration automatically
- Check file size limits (should handle most images)
- Verify photo data is valid base64 format

### Data Validation:
- All data is validated before migration
- Backup your original data before migrating
- The migration process is non-destructive to original data

## 📝 Migration Checklist

- [ ] Export data from legacy app using migration script
- [ ] Verify exported JSON structure and data integrity
- [ ] Sign up/login to React app with desired user account
- [ ] Import data using migration modal or manual method
- [ ] Verify all trips, fish catches, and weather logs appear
- [ ] Check that tackle box items are preserved
- [ ] Confirm photos are migrated (if any)
- [ ] Test creating new data to ensure everything works

## 🎯 Post-Migration

After successful migration:

1. **Your data is now in the cloud** and synced across devices
2. **Future changes** will automatically sync
3. **Local data remains** as a backup
4. **You can continue using** both apps if needed

## 🔄 Rollback (if needed)

If you need to rollback the migration:

1. **Export your data** from the React app
2. **Clear the React app data** (Settings → Clear Data)
3. **Your original legacy data** remains intact in the original app

## 📞 Support

If you encounter issues:

1. Check the browser console for error messages
2. Verify data structure compatibility
3. Ensure both apps are using compatible data formats
4. Check network connectivity for cloud features

---

**Migration Status**: ✅ **READY**
**Data Safety**: ✅ **PRESERVED**
**Compatibility**: ✅ **VERIFIED**