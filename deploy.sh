#!/bin/bash

# ==============================================================================
# Automated Deployment Script for ShortMarket (VM Instance)
# Run this from the root directory of the project.
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting Deployment Process..."

# 1. Pull Latest Code
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "development")
echo "📦 Pulling latest changes from Git (branch: $CURRENT_BRANCH)..."
git pull origin "$CURRENT_BRANCH"

# 2. Build Frontend
echo "🌐 Building Frontend..."
cd frontend
npm install
npm run build
cd ..

# 3. Update Backend Dependencies
echo "⚙️  Updating Backend Dependencies..."
cd backend
npm install --omit=dev

# 4. Reload PM2 (Zero Downtime Restart)
echo "🔄 Reloading PM2 Clusters..."
pm2 reload ecosystem.config.js --update-env

echo "✅ Deployment Successful!"
cd ..
