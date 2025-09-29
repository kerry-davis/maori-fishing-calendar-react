// Simple script to add test data to the GalleryModal for debugging
// Run this in the browser console at http://localhost:5173

async function addTestDataToGallery() {
  console.log('🧪 Adding test data to GalleryModal...');

  try {
    // Get the database service from the app
    const dbService = window.databaseService || window.db;

    if (!dbService) {
      console.error('❌ Database service not found. Make sure the app is loaded.');
      return;
    }

    console.log('✅ Database service found');

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

    const tripId = await dbService.createTrip(testTrip);
    console.log('✅ Created test trip:', tripId);

    // Test images (1x1 pixel PNGs in base64)
    const testImages = [
      {
        species: 'Snapper',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        length: '45',
        weight: '2.5',
        time: '14:30'
      },
      {
        species: 'Kahawai',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjRcfQAAAABJRU5ErkJggg==',
        length: '35',
        weight: '1.2',
        time: '15:45'
      },
      {
        species: 'Trevally',
        data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9gDwADhgGAWjRcfAAAAABJRU5ErkJggg==',
        length: '28',
        weight: '0.8',
        time: '16:20'
      }
    ];

    // Add fish catches with photos
    for (const fish of testImages) {
      const fishData = {
        tripId: tripId,
        species: fish.species,
        length: fish.length,
        weight: fish.weight,
        time: fish.time,
        photo: fish.data,
        gear: ['Rod', 'Reel'],
        details: `Test catch for debugging - ${fish.species}`
      };

      const fishId = await dbService.createFishCaught(fishData);
      console.log(`✅ Added ${fish.species} with photo (ID: ${fishId})`);
    }

    console.log('🎉 Test data added successfully!');
    console.log('💡 Now refresh the page and open the GalleryModal to see the test images');

    return {
      tripId,
      fishCount: testImages.length,
      species: testImages.map(f => f.species)
    };

  } catch (error) {
    console.error('❌ Error adding test data:', error);
    throw error;
  }
}

// Auto-run instructions
console.log('🧪 Gallery test script loaded');
console.log('💡 Run addTestDataToGallery() in the console to add test data');
console.log('📋 Make sure you are on http://localhost:5173 when running this');