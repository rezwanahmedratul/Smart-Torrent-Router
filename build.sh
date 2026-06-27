#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "==========================================="
echo "⚙️  Smart Torrent Router - Build Utility"
echo "==========================================="

# Check Node.js installation
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed."
    echo "💡 Please install Node.js (v18 or higher) to compile this project."
    exit 1
fi

# Check npm installation
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed."
    echo "💡 Please install npm (included with Node.js) before running this script."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📥 Node modules not found. Installing packages..."
    npm install
else
    echo "✨ Node modules already present. Skipping npm install."
fi

# Build the WebExtension
echo "🛠️  Compiling typescript files and bundling assets..."
npm run build

# Packaging built extension files
if command -v zip &> /dev/null; then
    echo "📦 Packaging extension into a distribution ZIP..."
    rm -f smart-torrent-router.zip
    cd dist
    zip -r ../smart-torrent-router.zip . > /dev/null
    cd ..
    echo "✅ Success! Extension packaged: smart-torrent-router.zip"
else
    echo "⚠️  Warning: 'zip' utility not found. Skipping ZIP creation."
    echo "✅ Success! Unpacked extension files are ready in the 'dist/' folder."
fi

echo "==========================================="
