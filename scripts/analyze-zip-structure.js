#!/usr/bin/env node

/**
 * Zip File Structure Analysis Script
 * Analyzes the structure and contents of legacy fishing calendar zip files
 * to identify import issues and provide debugging information
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the zip file to analyze
const ZIP_FILE_PATH = 'fishing_log_export_2025-09-02_0641.zip';

/**
 * Analyze the structure of a zip file
 */
async function analyzeZipStructure(zipFilePath) {
    if (!fs.existsSync(zipFilePath)) {
        console.error(`❌ Zip file not found: ${zipFilePath}`);
        return;
    }

    console.log('🔍 Analyzing zip file structure...');
    console.log(`📁 File: ${zipFilePath}`);
    console.log(`📏 Size: ${fs.statSync(zipFilePath).size} bytes`);
    console.log('');

    try {
        // Read the zip file
        const zipData = fs.readFileSync(zipFilePath);
        const zip = await JSZip.loadAsync(zipData);

        console.log('📂 Zip Contents:');
        console.log('===============');

        // Analyze each file in the zip
        const fileAnalysis = [];

        zip.forEach((relativePath, zipEntry) => {
            console.log(`\n📄 ${relativePath}`);
            console.log(`   Size: ${zipEntry._data.uncompressedSize || 'Unknown'} bytes`);
            console.log(`   Compressed: ${zipEntry._data.compressedSize || 'Unknown'} bytes`);
            console.log(`   Directory: ${zipEntry.dir ? 'Yes' : 'No'}`);

            fileAnalysis.push({
                name: relativePath,
                size: zipEntry._data.uncompressedSize || 0,
                compressedSize: zipEntry._data.compressedSize || 0,
                isDirectory: zipEntry.dir,
                content: null // Will be filled if we read the content
            });
        });

        console.log(`\n📊 Summary:`);
        console.log(`   Total files: ${fileAnalysis.filter(f => !f.isDirectory).length}`);
        console.log(`   Total directories: ${fileAnalysis.filter(f => f.isDirectory).length}`);

        // Analyze content of key files
        await analyzeFileContents(zip, fileAnalysis);

        // Generate recommendations
        generateRecommendations(fileAnalysis);

    } catch (error) {
        console.error('❌ Failed to analyze zip file:', error.message);
        console.error('\n🔧 Troubleshooting suggestions:');
        console.error('   • Check if the zip file is corrupted');
        console.error('   • Verify the file was created by the legacy app export function');
        console.error('   • Try re-exporting from the legacy app');
    }
}

/**
 * Analyze the content of key files in the zip
 */
async function analyzeFileContents(zip, fileAnalysis) {
    console.log('\n📋 File Content Analysis:');
    console.log('========================');

    for (const file of fileAnalysis) {
        if (file.isDirectory) continue;

        try {
            const content = await zip.file(file.name)?.async('text');
            if (content) {
                file.content = content;

                // Analyze based on file type
                if (file.name.endsWith('.json')) {
                    analyzeJsonFile(file, content);
                } else if (file.name.endsWith('.csv')) {
                    analyzeCsvFile(file, content);
                } else if (isImageFile(file.name)) {
                    analyzeImageFile(file);
                } else {
                    analyzeGenericFile(file, content);
                }
            }
        } catch (error) {
            console.log(`   ⚠️  Could not read content: ${error.message}`);
        }
    }
}

/**
 * Analyze JSON file structure
 */
function analyzeJsonFile(file, content) {
    console.log(`   📋 JSON file detected`);

    try {
        const data = JSON.parse(content);

        // Check for expected data structures
        const hasIndexedDB = data.indexedDB !== undefined;
        const hasLocalStorage = data.localStorage !== undefined;
        const hasTrips = data.indexedDB?.trips !== undefined;
        const hasWeatherLogs = data.indexedDB?.weather_logs !== undefined;
        const hasFishCatches = data.indexedDB?.fish_caught !== undefined;
        const hasTackleBox = data.localStorage?.tacklebox !== undefined;

        console.log(`   ✅ Valid JSON structure`);
        console.log(`   📊 Data sections found:`);
        console.log(`      • indexedDB: ${hasIndexedDB ? '✅' : '❌'}`);
        console.log(`      • localStorage: ${hasLocalStorage ? '✅' : '❌'}`);
        console.log(`      • trips: ${hasTrips ? '✅' : '❌'}`);
        console.log(`      • weather_logs: ${hasWeatherLogs ? '✅' : '❌'}`);
        console.log(`      • fish_caught: ${hasFishCatches ? '✅' : '❌'}`);
        console.log(`      • tacklebox: ${hasTackleBox ? '✅' : '❌'}`);

        // Count records
        if (hasTrips) {
            console.log(`      • Trip count: ${Array.isArray(data.indexedDB.trips) ? data.indexedDB.trips.length : 'Not an array'}`);
        }
        if (hasWeatherLogs) {
            console.log(`      • Weather log count: ${Array.isArray(data.indexedDB.weather_logs) ? data.indexedDB.weather_logs.length : 'Not an array'}`);
        }
        if (hasFishCatches) {
            console.log(`      • Fish catch count: ${Array.isArray(data.indexedDB.fish_caught) ? data.indexedDB.fish_caught.length : 'Not an array'}`);
        }
        if (hasTackleBox) {
            console.log(`      • Tackle item count: ${Array.isArray(data.localStorage.tacklebox) ? data.localStorage.tacklebox.length : 'Not an array'}`);
        }

        // Check for photos
        const photosInFishCatches = data.indexedDB?.fish_caught?.filter(fish => fish.photo).length || 0;
        console.log(`      • Photos referenced: ${photosInFishCatches}`);

    } catch (error) {
        console.log(`   ❌ Invalid JSON: ${error.message}`);
    }
}

/**
 * Analyze CSV file structure
 */
function analyzeCsvFile(file, content) {
    console.log(`   📋 CSV file detected`);

    const lines = content.split('\n').filter(line => line.trim());
    console.log(`   📊 Lines: ${lines.length}`);

    if (lines.length > 0) {
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        console.log(`   📋 Headers: [${headers.join(', ')}]`);
        console.log(`   📊 Data rows: ${lines.length - 1}`);
    }
}

/**
 * Analyze image files
 */
function analyzeImageFile(file) {
    console.log(`   🖼️  Image file detected`);
    console.log(`   📏 Size: ${file.size} bytes`);

    // Check if it's a reasonable image size
    if (file.size > 10 * 1024 * 1024) {
        console.log(`   ⚠️  Large image file - may cause import issues`);
    }
}

/**
 * Analyze generic text files
 */
function analyzeGenericFile(file, content) {
    console.log(`   📄 Text file detected`);
    console.log(`   📏 Size: ${file.size} bytes`);

    // Show first few lines as preview
    const preview = content.substring(0, 200).replace(/\n/g, ' ↵ ');
    console.log(`   👀 Preview: "${preview}..."`);
}

/**
 * Check if file is an image
 */
function isImageFile(filename) {
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|bmp)$/i;
    return imageExtensions.test(filename);
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(fileAnalysis) {
    console.log('\n💡 Recommendations:');
    console.log('==================');

    const jsonFiles = fileAnalysis.filter(f => f.name.endsWith('.json') && !f.isDirectory);
    const csvFiles = fileAnalysis.filter(f => f.name.endsWith('.csv') && !f.isDirectory);
    const imageFiles = fileAnalysis.filter(f => isImageFile(f.name) && !f.isDirectory);

    if (jsonFiles.length === 0 && csvFiles.length === 0) {
        console.log('❌ No data files found (JSON or CSV)');
        console.log('   → Check if the zip was created by the legacy app export function');
        console.log('   → Try re-exporting from the legacy app');
    }

    if (jsonFiles.length > 0) {
        console.log('✅ JSON data files found - should be compatible with import');
    }

    if (csvFiles.length > 0) {
        console.log('✅ CSV data files found - should be compatible with import');
    }

    if (imageFiles.length > 0) {
        console.log(`✅ ${imageFiles.length} image files found`);
        const totalImageSize = imageFiles.reduce((sum, f) => sum + f.size, 0);
        console.log(`   Total image size: ${(totalImageSize / 1024 / 1024).toFixed(2)} MB`);

        if (totalImageSize > 50 * 1024 * 1024) {
            console.log('⚠️  Large total image size - may cause browser memory issues');
            console.log('   → Consider importing without images first');
        }
    }

    // Check for common issues
    const dataJson = fileAnalysis.find(f => f.name === 'data.json');
    if (dataJson) {
        try {
            const data = JSON.parse(dataJson.content);
            if (!data.indexedDB && !data.trips && !data.fishingData) {
                console.log('⚠️  JSON structure may not match expected format');
                console.log('   → Check if this is from the correct app version');
            }
        } catch (e) {
            console.log('❌ JSON parsing failed - file may be corrupted');
        }
    }

    console.log('\n🔧 Next Steps:');
    console.log('==============');
    console.log('1. Try importing the zip file in the React app');
    console.log('2. If import fails, check the browser console for detailed errors');
    console.log('3. Use the migration modal in the React app for browser-based import');
    console.log('4. If issues persist, the file structure has been analyzed for debugging');
}

/**
 * Main execution function
 */
async function main() {
    console.log('🧳 Legacy Fishing Calendar Zip Analyzer');
    console.log('=====================================\n');

    if (!fs.existsSync(ZIP_FILE_PATH)) {
        console.error(`❌ Zip file not found: ${ZIP_FILE_PATH}`);
        console.log('\n📝 To use this script:');
        console.log('1. Place your zip file in the project root');
        console.log('2. Update ZIP_FILE_PATH in this script if needed');
        console.log('3. Run: node scripts/analyze-zip-structure.js');
        return;
    }

    await analyzeZipStructure(ZIP_FILE_PATH);
}

// Export functions for external use
export {
    analyzeZipStructure,
    analyzeFileContents,
    generateRecommendations
};

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}