#!/usr/bin/env node

/**
 * Photo Debugging Script
 * Analyzes photo data in the database to identify why photos aren't showing in the gallery
 * Helps diagnose issues with photo storage, format, and retrieval
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple IndexedDB wrapper for debugging
class DebugDatabase {
  constructor() {
    this.db = null;
  }

  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('fishingLog', 3);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('Database upgrade needed - this may indicate schema issues');
      };
    });
  }

  async getAllFishCaught() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['fish_caught'], 'readonly');
      const store = transaction.objectStore('fish_caught');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAllTrips() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['trips'], 'readonly');
      const store = transaction.objectStore('trips');
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Analyze photo data in fish catches
 */
async function analyzePhotoData() {
  console.log('🔍 Analyzing photo data in database...\n');

  const db = new DebugDatabase();

  try {
    await db.open();

    // Get all fish catches and trips
    const [fishCatches, trips] = await Promise.all([
      db.getAllFishCaught(),
      db.getAllTrips()
    ]);

    console.log(`📊 Database Summary:`);
    console.log(`   • Total trips: ${trips.length}`);
    console.log(`   • Total fish catches: ${fishCatches.length}`);
    console.log(`   • Fish catches with photos: ${fishCatches.filter(fish => fish.photo).length}`);
    console.log(`   • Fish catches without photos: ${fishCatches.filter(fish => !fish.photo).length}`);
    console.log('');

    if (fishCatches.length === 0) {
      console.log('❌ No fish catches found in database');
      return;
    }

    // Analyze fish catches with photos
    const fishWithPhotos = fishCatches.filter(fish => fish.photo);

    if (fishWithPhotos.length === 0) {
      console.log('❌ No fish catches with photos found');
      console.log('\n🔧 Possible causes:');
      console.log('   • Photos not imported correctly from zip file');
      console.log('   • Photo data corrupted during import');
      console.log('   • Photo field is empty or null');
      return;
    }

    console.log(`✅ Found ${fishWithPhotos.length} fish catches with photos\n`);

    // Analyze photo data formats
    const photoFormats = new Map();
    const photoSizes = [];
    const invalidPhotos = [];

    fishWithPhotos.forEach((fish, index) => {
      console.log(`📸 Fish Catch ${index + 1}:`);
      console.log(`   Species: ${fish.species}`);
      console.log(`   Trip ID: ${fish.tripId}`);
      console.log(`   Photo data type: ${typeof fish.photo}`);
      console.log(`   Photo length: ${fish.photo ? fish.photo.length : 0} characters`);

      // Check photo format
      if (fish.photo) {
        if (fish.photo.startsWith('data:')) {
          const format = fish.photo.substring(5, fish.photo.indexOf(';'));
          photoFormats.set(format, (photoFormats.get(format) || 0) + 1);
          photoSizes.push(fish.photo.length);

          console.log(`   Photo format: ${format}`);

          // Validate base64 data
          try {
            const base64Data = fish.photo.split(',')[1];
            if (base64Data && base64Data.length % 4 === 0) {
              // Check if it's valid base64
              const testDecode = atob(base64Data.substring(0, 100));
              console.log(`   ✅ Base64 data appears valid`);
            } else {
              console.log(`   ⚠️  Base64 data may be invalid (length not divisible by 4)`);
              invalidPhotos.push(index);
            }
          } catch (error) {
            console.log(`   ❌ Invalid base64 data: ${error.message}`);
            invalidPhotos.push(index);
          }
        } else if (fish.photo.startsWith('http')) {
          photoFormats.set('http_url', (photoFormats.get('http_url') || 0) + 1);
          console.log(`   Photo format: HTTP URL`);
        } else {
          photoFormats.set('unknown', (photoFormats.get('unknown') || 0) + 1);
          console.log(`   Photo format: Unknown/invalid`);
          invalidPhotos.push(index);
        }
      }

      console.log('');
    });

    // Summary
    console.log('📊 Photo Analysis Summary:');
    console.log('========================');
    photoFormats.forEach((count, format) => {
      console.log(`   • ${format}: ${count} photos`);
    });

    if (photoSizes.length > 0) {
      const avgSize = photoSizes.reduce((a, b) => a + b, 0) / photoSizes.length;
      const minSize = Math.min(...photoSizes);
      const maxSize = Math.max(...photoSizes);
      console.log(`   • Average photo size: ${Math.round(avgSize / 1024)} KB`);
      console.log(`   • Photo size range: ${Math.round(minSize / 1024)} KB - ${Math.round(maxSize / 1024)} KB`);
    }

    if (invalidPhotos.length > 0) {
      console.log(`   • Invalid photos: ${invalidPhotos.length} (indices: ${invalidPhotos.join(', ')})`);
    }

    // Check trip associations
    console.log('\n🔗 Trip Association Analysis:');
    console.log('============================');

    const orphanedFish = fishWithPhotos.filter(fish => {
      const trip = trips.find(t => t.id === fish.tripId);
      if (!trip) {
        console.log(`   ⚠️  Fish catch ${fish.id} references non-existent trip ${fish.tripId}`);
        return true;
      }
      return false;
    });

    if (orphanedFish.length === 0) {
      console.log('   ✅ All fish catches are properly associated with trips');
    }

    // GalleryModal simulation
    console.log('\n🎨 GalleryModal Simulation:');
    console.log('===========================');

    // Simulate the GalleryModal logic
    const photoItems = [];

    fishWithPhotos.forEach(fish => {
      const trip = trips.find(t => t.id === fish.tripId);
      if (trip) {
        photoItems.push({
          id: `${fish.id}-${fish.tripId}`,
          fishId: fish.id,
          tripId: fish.tripId,
          photo: fish.photo,
          species: fish.species,
          length: fish.length,
          weight: fish.weight,
          date: trip.date,
          location: trip.location,
          water: trip.water,
          time: fish.time,
        });
      }
    });

    console.log(`   • Photo items that would be created: ${photoItems.length}`);
    console.log(`   • Expected gallery count: ${photoItems.length}`);

    if (photoItems.length === 0) {
      console.log('\n❌ GalleryModal would show "No photos found"');
      console.log('   Root cause: No valid photo-trip associations found');
    } else {
      console.log('\n✅ GalleryModal should show photos');
      console.log('   If gallery still shows "No photos found", the issue is in the React component');
    }

    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('===================');

    if (invalidPhotos.length > 0) {
      console.log('   • Fix invalid photo data formats');
      console.log('   • Re-import data from zip file');
    }

    if (orphanedFish.length > 0) {
      console.log('   • Fix broken trip associations');
      console.log('   • Ensure trips are imported before fish catches');
    }

    if (photoItems.length > 0 && fishWithPhotos.length > photoItems.length) {
      console.log('   • Some photos missing trip associations');
      console.log('   • Check trip import process');
    }

    if (photoFormats.get('data:image/jpeg') === 0 && photoFormats.get('data:image/png') === 0) {
      console.log('   • No base64 image data found');
      console.log('   • Photos may be stored as URLs or in wrong format');
    }

  } catch (error) {
    console.error('❌ Error analyzing photo data:', error);
  } finally {
    db.close();
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('📸 Photo Debugging Tool');
  console.log('======================\n');

  try {
    await analyzePhotoData();
  } catch (error) {
    console.error('Failed to run photo analysis:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('   • Ensure the app has been used and has data');
    console.log('   • Check browser console for IndexedDB errors');
    console.log('   • Try clearing browser data and re-importing');
  }
}

// Export for use as module
export { analyzePhotoData };

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}