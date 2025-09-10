#!/bin/bash

# Production Build Script for Māori Fishing Calendar
# This script builds the React application for production deployment

set -e  # Exit on any error

echo "🚀 Starting production build for Māori Fishing Calendar..."

# Check if we're in the correct directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the react-fishing-calendar directory."
    exit 1
fi

# Clean previous build
echo "🧹 Cleaning previous build..."
rm -rf dist/

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm ci
fi

# Run tests (optional - can be skipped with --skip-tests)
if [ "$1" != "--skip-tests" ]; then
    echo "🧪 Running tests..."
    npm run test:run
fi

# Build the application
echo "🔨 Building application..."
npm run build

# Verify build output
if [ ! -d "dist" ]; then
    echo "❌ Build failed: dist directory not found"
    exit 1
fi

# Check for essential files
REQUIRED_FILES=("dist/index.html" "dist/manifest.webmanifest" "dist/sw.js")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        echo "❌ Build verification failed: $file not found"
        exit 1
    fi
done

echo "✅ Production build completed successfully!"
echo "📁 Build output is in the 'dist' directory"
echo "🌐 Ready for deployment"

# Display build size information
echo ""
echo "📊 Build size information:"
du -sh dist/
echo ""
echo "📋 Build contents:"
ls -la dist/