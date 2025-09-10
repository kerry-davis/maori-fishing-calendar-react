#!/bin/bash

# PWA Testing Script for Māori Fishing Calendar
# This script tests PWA functionality including offline capabilities

set -e

echo "🧪 PWA Testing Script for Māori Fishing Calendar"
echo "================================================"

# Check if build exists
if [ ! -d "dist" ]; then
    echo "❌ No build found. Please run 'npm run build' first."
    exit 1
fi

echo "✅ Build directory found"

# Check for PWA essential files
echo ""
echo "🔍 Checking PWA essential files..."

PWA_FILES=(
    "dist/manifest.webmanifest"
    "dist/sw.js"
    "dist/icons/icon-192x192.png"
    "dist/icons/icon-512x512.png"
)

for file in "${PWA_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file (missing)"
    fi
done

# Check manifest content
echo ""
echo "📋 Manifest validation..."
if [ -f "dist/manifest.webmanifest" ]; then
    echo "✅ Manifest file exists"
    
    # Check if manifest is valid JSON using python
    if python3 -c "import json; json.load(open('dist/manifest.webmanifest'))" 2>/dev/null; then
        echo "✅ Manifest is valid JSON"
        
        # Extract key manifest properties using python
        NAME=$(python3 -c "import json; print(json.load(open('dist/manifest.webmanifest')).get('name', 'Not found'))" 2>/dev/null)
        START_URL=$(python3 -c "import json; print(json.load(open('dist/manifest.webmanifest')).get('start_url', 'Not found'))" 2>/dev/null)
        DISPLAY=$(python3 -c "import json; print(json.load(open('dist/manifest.webmanifest')).get('display', 'Not found'))" 2>/dev/null)
        
        echo "   📱 App Name: $NAME"
        echo "   🏠 Start URL: $START_URL"
        echo "   📺 Display Mode: $DISPLAY"
    else
        echo "❌ Manifest is not valid JSON"
    fi
else
    echo "❌ Manifest file not found"
fi

# Check service worker
echo ""
echo "🔧 Service Worker validation..."
if [ -f "dist/sw.js" ]; then
    echo "✅ Service worker file exists"
    
    # Check file size (should not be empty)
    SW_SIZE=$(wc -c < "dist/sw.js")
    if [ "$SW_SIZE" -gt 100 ]; then
        echo "✅ Service worker has content ($SW_SIZE bytes)"
    else
        echo "⚠️  Service worker seems too small ($SW_SIZE bytes)"
    fi
else
    echo "❌ Service worker file not found"
fi

# Check icons
echo ""
echo "🖼️  Icon validation..."
for icon in "dist/icons/icon-192x192.png" "dist/icons/icon-512x512.png"; do
    if [ -f "$icon" ]; then
        SIZE=$(wc -c < "$icon")
        echo "✅ $(basename "$icon") ($SIZE bytes)"
    else
        echo "❌ $(basename "$icon") (missing)"
    fi
done

echo ""
echo "🚀 PWA Testing Instructions:"
echo "1. Run 'npm run preview' to start the preview server"
echo "2. Open http://localhost:4173 in Chrome/Edge"
echo "3. Open DevTools > Application > Manifest"
echo "4. Verify manifest loads correctly"
echo "5. Check 'Service Workers' tab for registration"
echo "6. Test 'Add to Home Screen' functionality"
echo "7. Test offline mode by going offline in DevTools"
echo ""
echo "📱 Mobile Testing:"
echo "1. Access the preview URL on mobile device"
echo "2. Look for 'Add to Home Screen' prompt"
echo "3. Install the app and test offline functionality"