#!/bin/bash

# Data Migration Testing Script for Māori Fishing Calendar
# This script helps test data migration from the original app

set -e

echo "🔄 Data Migration Testing Script"
echo "================================"

echo ""
echo "📋 This script helps verify data migration compatibility between:"
echo "   • Original vanilla JS app (../)"
echo "   • New React app (./)"
echo ""

# Check if original app files exist
echo "🔍 Checking original app structure..."

ORIGINAL_FILES=(
    "../index.html"
    "../js/tacklebox.js"
    "../manifest.json"
    "../sw.js"
)

for file in "${ORIGINAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (not found)"
    fi
done

echo ""
echo "📊 Data Migration Test Instructions:"
echo ""
echo "1. 🌐 SETUP ORIGINAL APP:"
echo "   • Serve the original app from the parent directory"
echo "   • Add some test data (trips, tackle items, settings)"
echo "   • Verify data is stored in browser storage"
echo ""
echo "2. 🔍 INSPECT STORAGE:"
echo "   • Open DevTools > Application > Storage"
echo "   • Check IndexedDB for 'FishingCalendarDB'"
echo "   • Check localStorage for settings/preferences"
echo "   • Note the data structure and keys used"
echo ""
echo "3. 🚀 TEST REACT APP:"
echo "   • Build and serve the React app (npm run preview)"
echo "   • Open in the SAME browser (same origin)"
echo "   • Verify the React app can read existing data"
echo "   • Test that new data is compatible with original format"
echo ""
echo "4. ✅ VERIFICATION CHECKLIST:"
echo "   □ Existing trips display correctly"
echo "   □ Tackle box items are preserved"
echo "   □ User settings (theme, location) are maintained"
echo "   □ New data created in React app works in original app"
echo "   □ Data export/import works between versions"
echo ""
echo "🔧 Manual Testing Commands:"
echo ""
echo "# Serve original app (from parent directory):"
echo "cd .. && python3 -m http.server 8000"
echo ""
echo "# Serve React app (from this directory):"
echo "npm run preview"
echo ""
echo "# Compare data schemas:"
echo "# Original: Check ../js/tacklebox.js for data structure"
echo "# React: Check ./src/types/index.ts for type definitions"
echo ""
echo "💡 TIP: Use different ports to test both apps simultaneously"
echo "   and verify data compatibility across versions."