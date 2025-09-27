#!/usr/bin/env node

/**
 * Legacy App Data Migration Script
 * Migrates data from the vanilla JS Māori Fishing Calendar to the React version
 *
 * Usage:
 * 1. Open the legacy app in a browser
 * 2. Open DevTools Console
 * 3. Run: migrationScript()
 * 4. Copy the exported JSON data
 * 5. Import into the React app
 */

console.log('🔄 Legacy App Data Migration Tool');
console.log('==================================\n');

// Global variable to hold the database connection
let legacyDB = null;

/**
 * Connect to the legacy app's IndexedDB
 */
function connectToLegacyDB() {
    return new Promise((resolve, reject) => {
        console.log('🔌 Connecting to legacy database...');

        const request = indexedDB.open("fishingLog", 2);

        request.onsuccess = (event) => {
            legacyDB = event.target.result;
            console.log('✅ Connected to legacy database successfully');
            resolve(legacyDB);
        };

        request.onerror = (event) => {
            console.error('❌ Failed to connect to legacy database:', event.target.error);
            reject(event.target.error);
        };

        request.onupgradeneeded = (event) => {
            console.log('ℹ️  Database upgrade needed - this is normal for first run');
        };
    });
}

/**
 * Extract all data from a specific store
 */
function extractStoreData(storeName) {
    return new Promise((resolve, reject) => {
        if (!legacyDB) {
            reject(new Error('Database not connected'));
            return;
        }

        console.log(`📊 Extracting data from ${storeName}...`);

        const transaction = legacyDB.transaction([storeName], "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
            const data = request.result;
            console.log(`✅ Extracted ${data.length} records from ${storeName}`);
            resolve(data);
        };

        request.onerror = (event) => {
            console.error(`❌ Failed to extract ${storeName}:`, event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * Extract localStorage data
 */
function extractLocalStorageData() {
    console.log('💾 Extracting localStorage data...');

    const localStorageData = {
        tacklebox: [],
        gearTypes: [],
        theme: 'light',
        userLocation: null
    };

    try {
        const tackleboxData = localStorage.getItem('tacklebox');
        if (tackleboxData) {
            localStorageData.tacklebox = JSON.parse(tackleboxData);
            console.log(`✅ Extracted ${localStorageData.tacklebox.length} tackle items`);
        }

        const gearTypesData = localStorage.getItem('gearTypes');
        if (gearTypesData) {
            localStorageData.gearTypes = JSON.parse(gearTypesData);
            console.log(`✅ Extracted ${localStorageData.gearTypes.length} gear types`);
        }

        const themeData = localStorage.getItem('theme');
        if (themeData) {
            localStorageData.theme = themeData;
            console.log(`✅ Extracted theme: ${themeData}`);
        }

        const locationData = localStorage.getItem('userLocation');
        if (locationData) {
            localStorageData.userLocation = JSON.parse(locationData);
            console.log(`✅ Extracted user location: ${localStorageData.userLocation.name || 'Unknown'}`);
        }

    } catch (error) {
        console.error('❌ Error extracting localStorage data:', error);
    }

    return localStorageData;
}

/**
 * Transform legacy trip data to React format
 */
function transformTripData(legacyTrips) {
    console.log('🔄 Transforming trip data...');

    return legacyTrips.map(trip => ({
        id: trip.id,
        date: trip.date,
        water: trip.water || '',
        location: trip.location || '',
        hours: trip.hours || 0,
        companions: trip.companions || '',
        notes: trip.notes || ''
    }));
}

/**
 * Transform legacy weather data to React format
 */
function transformWeatherData(legacyWeather) {
    console.log('🔄 Transforming weather data...');

    return legacyWeather.map(weather => ({
        id: `${weather.tripId}-${Date.now()}-${Math.random()}`,
        tripId: weather.tripId,
        timeOfDay: weather.timeOfDay || '',
        sky: weather.sky || '',
        windCondition: weather.windCondition || '',
        windDirection: weather.windDirection || '',
        waterTemp: weather.waterTemp || '',
        airTemp: weather.airTemp || ''
    }));
}

/**
 * Transform legacy fish data to React format
 */
function transformFishData(legacyFish) {
    console.log('🔄 Transforming fish data...');

    return legacyFish.map(fish => ({
        id: `${fish.tripId}-${Date.now()}-${Math.random()}`,
        tripId: fish.tripId,
        species: fish.species || '',
        length: fish.length || '',
        weight: fish.weight || '',
        time: fish.time || '',
        gear: Array.isArray(fish.gear) ? fish.gear : (fish.bait ? [fish.bait] : []),
        details: fish.details || '',
        photo: fish.photo || undefined
    }));
}

/**
 * Transform legacy tackle box data to React format
 */
function transformTackleData(legacyTackle) {
    console.log('🔄 Transforming tackle box data...');

    return legacyTackle.map((item, index) => ({
        id: index + 1, // Generate simple sequential IDs
        name: item.name || '',
        brand: item.brand || '',
        type: item.type || 'Lure', // Default to Lure if not specified
        colour: item.colour || ''
    }));
}

/**
 * Main migration function
 */
async function performMigration() {
    try {
        console.log('🚀 Starting migration from legacy app...\n');

        // Step 1: Connect to database
        await connectToLegacyDB();

        // Step 2: Extract all data
        const [legacyTrips, legacyWeather, legacyFish] = await Promise.all([
            extractStoreData('trips'),
            extractStoreData('weather_logs'),
            extractStoreData('fish_caught')
        ]);

        const localStorageData = extractLocalStorageData();

        // Step 3: Transform data
        const transformedTrips = transformTripData(legacyTrips);
        const transformedWeather = transformWeatherData(legacyWeather);
        const transformedFish = transformFishData(legacyFish);
        const transformedTackle = transformTackleData(localStorageData.tacklebox);

        // Step 4: Create migration package
        const migrationPackage = {
            metadata: {
                migratedAt: new Date().toISOString(),
                source: 'legacy-maori-fishing-calendar',
                version: '1.0.0',
                totalRecords: {
                    trips: transformedTrips.length,
                    weatherLogs: transformedWeather.length,
                    fishCatches: transformedFish.length,
                    tackleItems: transformedTackle.length
                }
            },
            indexedDB: {
                trips: transformedTrips,
                weather_logs: transformedWeather,
                fish_caught: transformedFish
            },
            localStorage: {
                tacklebox: transformedTackle,
                gearTypes: localStorageData.gearTypes,
                theme: localStorageData.theme,
                userLocation: localStorageData.userLocation
            }
        };

        console.log('\n✅ Migration completed successfully!');
        console.log('📊 Migration Summary:');
        console.log(`   • Trips: ${transformedTrips.length}`);
        console.log(`   • Weather Logs: ${transformedWeather.length}`);
        console.log(`   • Fish Catches: ${transformedFish.length}`);
        console.log(`   • Tackle Items: ${transformedTackle.length}`);

        return migrationPackage;

    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
}

/**
 * Export migration data as JSON (for copying to React app)
 */
function exportMigrationData() {
    performMigration().then(data => {
        console.log('\n📋 COPY THE JSON DATA BELOW INTO YOUR REACT APP');
        console.log('==================================================');
        console.log(JSON.stringify(data, null, 2));
        console.log('==================================================');
        console.log('\n💡 Next steps:');
        console.log('1. Copy the JSON data above');
        console.log('2. Open your React app');
        console.log('3. Use the import feature to load this data');
        console.log('4. Or manually add to your React app database');
    }).catch(error => {
        console.error('❌ Export failed:', error);
    });
}

/**
 * Generate migration instructions
 */
function showMigrationInstructions() {
    console.log(`
🔄 MIGRATION INSTRUCTIONS
========================

MANUAL MIGRATION:
1. Open your legacy Māori Fishing Calendar app in a browser
2. Open Developer Tools (F12) → Console tab
3. Run: exportMigrationData()
4. Copy the JSON output that appears
5. Open your React Māori Fishing Calendar app
6. Go to Settings → Data Import
7. Paste the JSON data and import

AUTOMATED MIGRATION:
1. Serve both apps on different ports:
   - Legacy: python3 -m http.server 8000
   - React: npm run dev (usually port 5173)
2. Use the automated migration script (coming soon)

IMPORTANT NOTES:
• Make sure you're logged into the same user account in the React app
• The migration will preserve all your fishing data, weather logs, and tackle box
• Photos will be included in the migration
• The process is safe - your original data remains unchanged

DATA INCLUDED IN MIGRATION:
✅ Fishing trips with all details
✅ Weather observations for each trip
✅ Fish catches with photos and gear used
✅ Tackle box items and gear types
✅ User preferences (theme, location)
`);
}

// Make functions available globally for console use
window.migrationScript = performMigration;
window.exportMigrationData = exportMigrationData;
window.showMigrationInstructions = showMigrationInstructions;

console.log('🔧 Migration tools loaded!');
console.log('📝 Available commands:');
console.log('   • migrationScript() - Run the migration');
console.log('   • exportMigrationData() - Export data as JSON');
console.log('   • showMigrationInstructions() - Show detailed instructions');

console.log('\n🚀 To start migration, run: exportMigrationData()');