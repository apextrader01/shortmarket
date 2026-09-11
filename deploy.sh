#!/bin/bash

# ==============================================================================
# Automated High-Concurrency Deployment Script for ShortMarket (VM Instance)
# Run this from the root directory of the project.
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting Deployment Process..."

# 1. Pull Latest Code
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "development")
echo "📦 Pulling latest changes from Git (branch: $CURRENT_BRANCH)..."
PREV_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")
git pull origin "$CURRENT_BRANCH"
NEW_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")

# 2. Smart Frontend Build (Skips npm install if package.json hasn't changed)
echo "🌐 Building Frontend..."
cd frontend
if [ -n "$PREV_HEAD" ] && [ "$PREV_HEAD" != "$NEW_HEAD" ] && git diff --name-only "$PREV_HEAD" "$NEW_HEAD" | grep -q "frontend/package"; then
    echo "📦 Frontend dependencies changed, running npm ci..."
    npm ci --prefer-offline || npm install
else
    echo "⚡ Frontend dependencies unchanged. Skipping npm install (saving ~800 KiB/s bandwidth)."
fi

# Run Vite build with lower process priority to protect live user traffic
if command -v nice >/dev/null 2>&1; then
    nice -n 15 npm run build
else
    npm run build
fi
cd ..

# 3. Smart Backend Dependencies (Skips npm install if package.json hasn't changed)
echo "⚙️  Updating Backend Dependencies..."
cd backend
if [ -n "$PREV_HEAD" ] && [ "$PREV_HEAD" != "$NEW_HEAD" ] && git diff --name-only "$PREV_HEAD" "$NEW_HEAD" | grep -q "backend/package"; then
    echo "📦 Backend dependencies changed, running npm ci..."
    npm ci --omit=dev --prefer-offline || npm install --omit=dev
else
    echo "⚡ Backend dependencies unchanged. Skipping npm install."
fi

# 4. Reload PM2 (Zero Downtime Restart)
echo "🔄 Reloading PM2 Clusters (Zero Downtime)..."
pm2 reload ecosystem.config.js --update-env

echo "✅ Deployment Successful! Platform is running cleanly."
cd ..
