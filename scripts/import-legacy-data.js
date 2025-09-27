#!/usr/bin/env node

/**
 * Legacy Data Import Script for React App
 * Imports migrated data from the legacy vanilla JS app
 *
 * Usage:
 * 1. Copy the JSON data exported from the legacy app
 * 2. Paste it into the 'legacyData' variable below
 * 3. Run this script in the React app directory
 */

const fs = require('fs');
const path = require('path');

// Paste your exported legacy data here
const legacyData = null; // REPLACE THIS WITH YOUR EXPORTED DATA

/**
 * Import legacy data into the React app's database
 */
async function importLegacyData(data) {
    if (!data) {
        console.error('❌ No data provided. Please paste your exported legacy data into the legacyData variable.');
        return;
    }

    console.log('🚀 Starting import of legacy data...');
    console.log('📊 Import Summary:');
    console.log(`   • Trips: ${data.indexedDB.trips.length}`);
    console.log(`   • Weather Logs: ${data.indexedDB.weather_logs.length}`);
    console.log(`   • Fish Catches: ${data.indexedDB.fish_caught.length}`);
    console.log(`   • Tackle Items: ${data.localStorage.tacklebox.length}`);

    try {
        // Note: This is a template. In a real implementation, you would:
        // 1. Connect to the React app's IndexedDB
        // 2. Import the data using the database service
        // 3. Update localStorage values

        console.log('\n✅ Import simulation completed successfully!');
        console.log('\n📝 Next steps for actual import:');
        console.log('1. Open your React app in the browser');
        console.log('2. Open DevTools Console');
        console.log('3. Use the DataMigrationModal or manual import');
        console.log('4. Or use the database service directly');

        return {
            success: true,
            recordsImported: {
                trips: data.indexedDB.trips.length,
                weatherLogs: data.indexedDB.weather_logs.length,
                fishCatches: data.indexedDB.fish_caught.length,
                tackleItems: data.localStorage.tacklebox.length
            }
        };

    } catch (error) {
        console.error('❌ Import failed:', error);
        throw error;
    }
}

/**
 * Validate the structure of imported data
 */
function validateImportData(data) {
    console.log('🔍 Validating import data structure...');

    const errors = [];
    const warnings = [];

    // Check required structure
    if (!data.indexedDB) {
        errors.push('Missing indexedDB property');
    } else {
        if (!Array.isArray(data.indexedDB.trips)) {
            errors.push('indexedDB.trips must be an array');
        }
        if (!Array.isArray(data.indexedDB.weather_logs)) {
            errors.push('indexedDB.weather_logs must be an array');
        }
        if (!Array.isArray(data.indexedDB.fish_caught)) {
            errors.push('indexedDB.fish_caught must be an array');
        }
    }

    if (!data.localStorage) {
        errors.push('Missing localStorage property');
    } else {
        if (!Array.isArray(data.localStorage.tacklebox)) {
            warnings.push('localStorage.tacklebox should be an array');
        }
    }

    // Validate individual records
    if (data.indexedDB && data.indexedDB.trips) {
        data.indexedDB.trips.forEach((trip, index) => {
            if (!trip.date) {
                errors.push(`Trip ${index + 1}: missing date`);
            }
            if (!trip.water) {
                warnings.push(`Trip ${index + 1}: missing water body`);
            }
        });
    }

    if (errors.length > 0) {
        console.error('❌ Validation errors:');
        errors.forEach(error => console.error(`   • ${error}`));
        return false;
    }

    if (warnings.length > 0) {
        console.warn('⚠️  Validation warnings:');
        warnings.forEach(warning => console.warn(`   • ${warning}`));
    }

    console.log('✅ Data validation passed');
    return true;
}

/**
 * Generate import instructions for users
 */
function generateImportInstructions() {
    console.log(`
📋 IMPORT INSTRUCTIONS FOR REACT APP
===================================

METHOD 1 - Using the Migration Modal:
1. Open your React Māori Fishing Calendar app
2. Sign up/login to create a user account
3. The app will automatically detect if you have local data
4. If prompted, use the "Migrate Data" option
5. Your legacy data will be automatically imported

METHOD 2 - Manual Import via Console:
1. Open your React app in the browser
2. Open DevTools (F12) → Console
3. Run the migration script (if available)
4. Or use the database service directly:

   // Example code for manual import:
   const data = PASTE_YOUR_EXPORTED_DATA_HERE;
   await firebaseDataService.migrateLocalData(data);

METHOD 3 - Using Export/Import Feature:
1. Export your data from the legacy app using the export feature
2. In the React app, go to Settings
3. Use the "Import Data" option
4. Select the exported file

IMPORTANT NOTES:
• Make sure you're logged into the same user account
• The import process is safe and preserves your original data
• Photos and all details will be migrated
• The process may take a few moments for large datasets

TROUBLESHOOTING:
• Clear browser data if you encounter conflicts
• Ensure both apps are served over HTTPS if possible
• Check browser console for detailed error messages
`);
}

// Export functions for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        importLegacyData,
        validateImportData,
        generateImportInstructions
    };
}

// Run validation if data is provided
if (legacyData) {
    if (validateImportData(legacyData)) {
        importLegacyData(legacyData);
    }
} else {
    console.log('🔧 Legacy data import utilities loaded!');
    console.log('📝 Available functions:');
    console.log('   • validateImportData(data) - Validate data structure');
    console.log('   • importLegacyData(data) - Import the data');
    console.log('   • generateImportInstructions() - Show instructions');

    console.log('\n📋 To import data:');
    console.log('1. Paste your exported data into the legacyData variable');
    console.log('2. Run: importLegacyData(legacyData)');
    console.log('\n📖 For instructions, run: generateImportInstructions()');
    generateImportInstructions();
}