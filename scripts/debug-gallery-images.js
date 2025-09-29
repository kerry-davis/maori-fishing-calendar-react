/**
 * Debug script to analyze image data in GalleryModal
 * Run this in the browser console when the GalleryModal is open
 */

function debugGalleryImages() {
  console.log('🔍 Starting GalleryModal image debugging...');

  // Get all images in the gallery
  const galleryImages = document.querySelectorAll('img[src*="data:image"]');
  console.log(`📸 Found ${galleryImages.length} data URL images in gallery`);

  galleryImages.forEach((img, index) => {
    const src = img.src;
    const species = img.alt ? img.alt.split(' - ')[0] : 'Unknown';

    console.log(`\n🖼️ Image ${index + 1} (${species}):`);
    console.log(`   - Length: ${src.length} characters`);
    console.log(`   - Preview: ${src.substring(0, 80)}...`);
    console.log(`   - Is data URL: ${src.startsWith('data:')}`);
    console.log(`   - MIME type: ${src.split(';')[0].split(':')[1] || 'unknown'}`);

    if (src.startsWith('data:image')) {
      const parts = src.split(',');
      const header = parts[0];
      const data = parts[1];

      console.log(`   - Header: ${header}`);
      console.log(`   - Base64 length: ${data ? data.length : 0}`);
      console.log(`   - Has valid base64 chars: ${data ? /^[A-Za-z0-9+/=]+$/.test(data) : false}`);
      console.log(`   - Padding correct: ${data ? (data.length % 4 === 0 || data.endsWith('==') || data.endsWith('=')) : false}`);

      // Check image dimensions
      console.log(`   - Natural dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
      console.log(`   - Display dimensions: ${img.width}x${img.height}`);
      console.log(`   - Complete: ${img.complete}`);

      // Check if image loaded successfully
      if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) {
        console.log(`   ✅ Image loaded successfully`);
      } else if (img.complete && (img.naturalWidth === 0 || img.naturalHeight === 0)) {
        console.log(`   ⚠️ Image loaded but has zero dimensions (likely corrupted)`);
      } else {
        console.log(`   ❌ Image failed to load or still loading`);
      }
    }
  });

  // Also check for any error states
  const errorElements = document.querySelectorAll('[class*="error"], [class*="unavailable"]');
  console.log(`\n🚫 Found ${errorElements.length} error/placeholder elements`);

  return {
    totalImages: galleryImages.length,
    errorElements: errorElements.length,
    images: Array.from(galleryImages).map(img => ({
      src: img.src,
      alt: img.alt,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete
    }))
  };
}

// Auto-run if in browser context
if (typeof window !== 'undefined') {
  console.log('🔧 Gallery image debugger loaded. Run debugGalleryImages() to analyze images.');
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { debugGalleryImages };
}