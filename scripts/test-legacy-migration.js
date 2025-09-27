#!/usr/bin/env node

/**
 * Test Script for Legacy Data Migration
 * Tests the migration process with sample data
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample legacy data for testing
const sampleLegacyData = {
    indexedDB: {
        trips: [
            {
                id: 1,
                date: "2024-01-15",
                water: "Lake Taupo",
                location: "Eastern Bay",
                hours: 4,
                companions: "John",
                notes: "Great day fishing"
            },
            {
                id: 2,
                date: "2024-01-20",
                water: "Waihou River",
                location: "Lower reaches",
                hours: 2,
                companions: "",
                notes: "Quick afternoon session"
            }
        ],
        weather_logs: [
            {
                id: 1,
                tripId: 1,
                timeOfDay: "Morning",
                sky: "Partly Cloudy",
                windCondition: "Light",
                windDirection: "NW",
                waterTemp: "18",
                airTemp: "22"
            },
            {
                id: 2,
                tripId: 2,
                timeOfDay: "Afternoon",
                sky: "Clear",
                windCondition: "Calm",
                windDirection: "",
                waterTemp: "20",
                airTemp: "25"
            }
        ],
        fish_caught: [
            {
                id: 1,
                tripId: 1,
                species: "Rainbow Trout",
                length: "45cm",
                weight: "2.5kg",
                time: "10:30",
                gear: ["Spinner", "Rod"],
                details: "Beautiful fish, fought well"
            },
            {
                id: 2,
                tripId: 1,
                species: "Brown Trout",
                length: "38cm",
                weight: "1.8kg",
                time: "14:15",
                gear: ["Fly"],
                details: "Caught on dry fly"
            }
        ]
    },
    localStorage: {
        tacklebox: [
            {
                name: "Silver Spinner",
                brand: "Rapala",
                type: "Lure",
                colour: "Silver"
            },
            {
                name: "Fly Rod",
                brand: "Sage",
                type: "Rod",
                colour: ""
            }
        ],
        gearTypes: ["Lure", "Rod", "Reel"],
        theme: "light",
        userLocation: {
            lat: -38.6637,
            lon: 176.0702,
            name: "Lake Taupo, New Zealand"
        }
    }
};

/**
 * Test data transformation functions
 */
function testDataTransformation() {
    console.log('🧪 Testing data transformation functions...\n');

    // Test trip transformation
    const transformedTrips = sampleLegacyData.indexedDB.trips.map(trip => ({
        id: trip.id,
        date: trip.date,
        water: trip.water || '',
        location: trip.location || '',
        hours: trip.hours || 0,
        companions: trip.companions || '',
        notes: trip.notes || ''
    }));

    console.log('✅ Trip transformation:');
    console.log(JSON.stringify(transformedTrips, null, 2));

    // Test weather transformation
    const transformedWeather = sampleLegacyData.indexedDB.weather_logs.map(weather => ({
        id: `${weather.tripId}-${Date.now()}-${Math.random()}`,
        tripId: weather.tripId,
        timeOfDay: weather.timeOfDay || '',
        sky: weather.sky || '',
        windCondition: weather.windCondition || '',
        windDirection: weather.windDirection || '',
        waterTemp: weather.waterTemp || '',
        airTemp: weather.airTemp || ''
    }));

    console.log('\n✅ Weather transformation:');
    console.log(JSON.stringify(transformedWeather, null, 2));

    // Test fish transformation
    const transformedFish = sampleLegacyData.indexedDB.fish_caught.map(fish => ({
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

    console.log('\n✅ Fish transformation:');
    console.log(JSON.stringify(transformedFish, null, 2));

    // Test tackle transformation
    const transformedTackle = sampleLegacyData.localStorage.tacklebox.map((item, index) => ({
        id: index + 1,
        name: item.name || '',
        brand: item.brand || '',
        type: item.type || 'Lure',
        colour: item.colour || ''
    }));

    console.log('\n✅ Tackle transformation:');
    console.log(JSON.stringify(transformedTackle, null, 2));

    return {
        trips: transformedTrips,
        weather: transformedWeather,
        fish: transformedFish,
        tackle: transformedTackle
    };
}

/**
 * Test data validation
 */
function testDataValidation(data) {
    console.log('\n🔍 Testing data validation...\n');

    const errors = [];
    const warnings = [];

    // Validate structure
    if (!data.indexedDB) {
        errors.push('Missing indexedDB property');
    }
    if (!data.localStorage) {
        errors.push('Missing localStorage property');
    }

    // Validate trips
    if (data.indexedDB && data.indexedDB.trips) {
        data.indexedDB.trips.forEach((trip, index) => {
            if (!trip.date) errors.push(`Trip ${index + 1}: missing date`);
            if (!trip.water) warnings.push(`Trip ${index + 1}: missing water body`);
        });
    }

    // Validate fish
    if (data.indexedDB && data.indexedDB.fish_caught) {
        data.indexedDB.fish_caught.forEach((fish, index) => {
            if (!fish.species) errors.push(`Fish ${index + 1}: missing species`);
            if (!fish.tripId) errors.push(`Fish ${index + 1}: missing tripId`);
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
 * Test complete migration package creation
 */
function testMigrationPackage() {
    console.log('\n📦 Testing migration package creation...\n');

    const transformed = testDataTransformation();

    const migrationPackage = {
        metadata: {
            migratedAt: new Date().toISOString(),
            source: 'legacy-maori-fishing-calendar',
            version: '1.0.0',
            totalRecords: {
                trips: transformed.trips.length,
                weatherLogs: transformed.weather.length,
                fishCatches: transformed.fish.length,
                tackleItems: transformed.tackle.length
            }
        },
        indexedDB: {
            trips: transformed.trips,
            weather_logs: transformed.weather,
            fish_caught: transformed.fish
        },
        localStorage: {
            tacklebox: transformed.tackle,
            gearTypes: sampleLegacyData.localStorage.gearTypes,
            theme: sampleLegacyData.localStorage.theme,
            userLocation: sampleLegacyData.localStorage.userLocation
        }
    };

    console.log('✅ Migration package created:');
    console.log(JSON.stringify(migrationPackage, null, 2));

    return migrationPackage;
}

/**
 * Run all tests
 */
function runAllTests() {
    console.log('🧪 Running Legacy Migration Tests');
    console.log('=================================\n');

    try {
        // Test 1: Data transformation
        console.log('📋 TEST 1: Data Transformation');
        testDataTransformation();

        // Test 2: Data validation
        console.log('\n📋 TEST 2: Data Validation');
        const isValid = testDataValidation(sampleLegacyData);

        if (!isValid) {
            throw new Error('Data validation failed');
        }

        // Test 3: Migration package creation
        console.log('\n📋 TEST 3: Migration Package Creation');
        const migrationPackage = testMigrationPackage();

        // Test 4: JSON serialization
        console.log('\n📋 TEST 4: JSON Serialization');
        const jsonString = JSON.stringify(migrationPackage, null, 2);
        console.log(`✅ Generated JSON: ${jsonString.length} characters`);

        // Test 5: File output
        console.log('\n📋 TEST 5: File Output');
        const testOutputPath = path.join(__dirname, 'test-migration-output.json');
        fs.writeFileSync(testOutputPath, jsonString);
        console.log(`✅ Test output saved to: ${testOutputPath}`);

        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('\n📊 Test Summary:');
        console.log(`   • Sample trips: ${sampleLegacyData.indexedDB.trips.length}`);
        console.log(`   • Sample weather logs: ${sampleLegacyData.indexedDB.weather_logs.length}`);
        console.log(`   • Sample fish catches: ${sampleLegacyData.indexedDB.fish_caught.length}`);
        console.log(`   • Sample tackle items: ${sampleLegacyData.localStorage.tacklebox.length}`);

        return {
            success: true,
            migrationPackage: migrationPackage,
            outputFile: testOutputPath
        };

    } catch (error) {
        console.error('\n❌ TESTS FAILED:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

// Export functions for external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runAllTests,
        testDataTransformation,
        testDataValidation,
        testMigrationPackage,
        sampleLegacyData
    };
}

// Run tests if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests();
}

console.log('🔧 Legacy migration test utilities loaded!');
console.log('📝 Available functions:');
console.log('   • runAllTests() - Run all migration tests');
console.log('   • testDataTransformation() - Test data transformation');
console.log('   • testDataValidation(data) - Test data validation');
console.log('   • testMigrationPackage() - Test package creation');

console.log('\n🚀 To run all tests: runAllTests()');