/**
 * Script to add test photos to the database for GalleryModal debugging
 * This will create some sample fish catches with base64 image data
 */

async function addTestPhotos() {
  console.log('🧪 Adding test photos to database for debugging...');

  try {
    // Create a simple test database service instance
    const { databaseService } = await import('../src/services/databaseService.ts');

    // Initialize the database
    await databaseService.initialize();
    console.log('✅ Database initialized');

    // Create a test trip
    const testTrip = {
      date: '2025-09-29',
      location: 'Test Location',
      water: 'Saltwater',
      weather: 'Sunny',
      temperature: '20°C',
      wind: 'Light',
      tide: 'High',
      moonPhase: 'Full Moon',
      notes: 'Test trip for debugging gallery'
    };

    const tripId = await databaseService.createTrip(testTrip);
    console.log(`✅ Created test trip with ID: ${tripId}`);

    // Create some test base64 images (small 1x1 pixel images in different colors)
    const testImages = [
      {
        name: 'red-pixel',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        species: 'Snapper',
        length: '45',
        weight: '2.5',
        time: '14:30'
      },
      {
        name: 'blue-pixel',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjRcfQAAAABJRU5ErkJggg==',
        species: 'Kahawai',
        length: '35',
        weight: '1.2',
        time: '15:45'
      },
      {
        name: 'green-pixel',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9gDwADhgGAWjRcfAAAAABJRU5ErkJggg==',
        species: 'Trevally',
        length: '28',
        weight: '0.8',
        time: '16:20'
      }
    ];

    // Also create some raw base64 data (without data URL prefix) to test the conversion
    const rawBase64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    console.log('📸 Adding test fish catches with photos...');

    for (let i = 0; i < testImages.length; i++) {
      const image = testImages[i];

      const fishData = {
        tripId: tripId,
        species: image.species,
        length: image.length,
        weight: image.weight,
        time: image.time,
        photo: image.data, // Use the data URL format
        gear: ['Rod', 'Reel'],
        details: `Test catch ${i + 1} for debugging`
      };

      const fishId = await databaseService.createFishCaught(fishData);
      console.log(`✅ Created fish catch: ${image.species} with photo (ID: ${fishId})`);
    }

    // Add one fish catch with raw base64 data to test the conversion
    const rawBase64FishData = {
      tripId: tripId,
      species: 'Test Raw Base64',
      length: '50',
      weight: '3.0',
      time: '17:00',
      photo: rawBase64Data, // Raw base64 without data URL prefix
      gear: ['Rod', 'Reel'],
      details: 'Test catch with raw base64 data'
    };

    const rawBase64FishId = await databaseService.createFishCaught(rawBase64FishData);
    console.log(`✅ Created fish catch with raw base64 data (ID: ${rawBase64FishId})`);

    console.log('🎉 Test data added successfully!');
    console.log('💡 Now open the GalleryModal to see the test images');

    return {
      tripId,
      fishCount: testImages.length + 1,
      images: testImages.map(img => img.name)
    };

  } catch (error) {
    console.error('❌ Error adding test photos:', error);
    throw error;
  }
}

// Auto-run if in browser context
if (typeof window !== 'undefined') {
  console.log('🧪 Test photo script loaded. Run addTestPhotos() to add test data.');
}

// Export for Node.js usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { addTestPhotos };
}