#!/bin/bash
# ==============================================================================
# Automated High-Concurrency Deployment Script for SkandX Staging
# Updates ~/shortmarket-staging from the 'development' branch
# ==============================================================================

set -e

STAGING_DIR="${STAGING_DIR:-/home/centralasp123/shortmarket-staging}"

if [ ! -d "$STAGING_DIR" ]; then
    # If run directly from inside the staging directory itself
    if [ -f "./ecosystem.config.js" ] && [ -d "./frontend" ]; then
        STAGING_DIR="$(pwd)"
    else
        echo "❌ Staging directory not found at $STAGING_DIR"
        echo "   Please run setup-staging.sh first."
        exit 1
    fi
fi

echo "🚀 Deploying Latest Code to Staging Environment ($STAGING_DIR)..."
cd "$STAGING_DIR"

# 1. Pull Latest Development Branch
echo "📦 Pulling latest changes from Git (branch: development)..."
PREV_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")
git fetch origin development
git reset --hard origin/development
NEW_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")

# 2. Smart Frontend Build
echo "🌐 Building Frontend..."
cd frontend
if [ -n "$PREV_HEAD" ] && [ "$PREV_HEAD" != "$NEW_HEAD" ] && git diff --name-only "$PREV_HEAD" "$NEW_HEAD" | grep -q "frontend/package"; then
    echo "📦 Frontend dependencies changed, running npm ci..."
    npm ci --prefer-offline || npm install
else
    echo "⚡ Frontend dependencies unchanged. Skipping npm install."
fi

if command -v nice >/dev/null 2>&1; then
    nice -n 15 npm run build
else
    npm run build
fi
cd ..

# 3. Smart Backend Dependencies
echo "⚙️ Updating Backend Dependencies..."
cd backend
if [ -n "$PREV_HEAD" ] && [ "$PREV_HEAD" != "$NEW_HEAD" ] && git diff --name-only "$PREV_HEAD" "$NEW_HEAD" | grep -q "backend/package"; then
    echo "📦 Backend dependencies changed, running npm ci..."
    npm ci --omit=dev --prefer-offline || npm install --omit=dev
else
    echo "⚡ Backend dependencies unchanged. Skipping npm install."
fi

# 4. Run Critical Database Schema Migrations on Staging DB
echo "🗄️ Running Migrations on Staging Database (shortmarket_staging)..."
node scripts/migrate_columns.js || node -e "const db = require('./database/db'); db.ensureCriticalColumns().then(() => process.exit(0)).catch(() => process.exit(0));"

# 5. Reload Staging PM2 Instance
echo "🔄 Reloading PM2 Cluster: skandx-backend-staging (Zero Downtime)..."
pm2 reload skandx-backend-staging --update-env 2>/dev/null || pm2 start ecosystem.config.js
pm2 save 2>/dev/null || true

echo "✅ Staging Deployment Successful! Staging environment is live and updated."
cd ..
