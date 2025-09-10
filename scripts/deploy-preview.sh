#!/bin/bash

# Preview Deployment Script for Māori Fishing Calendar
# This script serves the built application locally for testing

set -e

echo "🔍 Starting preview deployment..."

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo "❌ No build found. Running production build first..."
    ./scripts/build-production.sh --skip-tests
fi

# Start preview server
echo "🌐 Starting preview server..."
echo "📱 Testing PWA functionality..."
echo ""
echo "🔗 Preview will be available at: http://localhost:4173"
echo "💡 Use this to test:"
echo "   - PWA installation"
echo "   - Offline functionality" 
echo "   - Service worker caching"
echo "   - Data migration from existing app"
echo ""
echo "Press Ctrl+C to stop the server"

npm run preview