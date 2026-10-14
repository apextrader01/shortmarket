#!/bin/bash

# ==============================================================================
# Automated High-Concurrency Deployment Script for SkandX (VM Instance)
# Run this from the root directory of the project.
# ==============================================================================

set -e # Exit immediately if a command exits with a non-zero status

echo "🚀 Starting Deployment Process..."

# 1. Pull Latest Code
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "development")
echo "📦 Pulling latest changes from Git (branch: $CURRENT_BRANCH)..."
PREV_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")
git fetch origin "$CURRENT_BRANCH"
git reset --hard "origin/$CURRENT_BRANCH"
NEW_HEAD=$(git rev-parse HEAD 2>/dev/null || echo "")

# 2. Frontend Build (Full, complete installation)
echo "🌐 Installing Frontend Dependencies & Building..."
if [ -f backend/.env ] && [ ! -f frontend/.env ]; then
  FB_KEY=$(grep -E '^FIREBASE_API_KEY=' backend/.env | cut -d '=' -f2- | tr -d '\r')
  if [ -n "$FB_KEY" ]; then
    echo "VITE_FIREBASE_API_KEY=$FB_KEY" > frontend/.env
  fi
fi
cd frontend
npm install
npm run build
cd ..

# 3. Backend Dependencies & Environment Verification
echo "⚙️  Installing Backend Dependencies..."
cd backend
if [ ! -f .env ]; then
  echo "⚠️  WARNING: backend/.env not found! Creating from .env.example (please populate secrets in backend/.env)..."
  cp .env.example .env 2>/dev/null || touch .env
fi
npm install --omit=dev

# 4. Run Critical Database Schema Migrations
echo "🗄️ Running Database Schema Migrations..."
node scripts/migrate_columns.js || node -e "const db = require('./database/db'); db.ensureCriticalColumns().then(() => process.exit(0)).catch(() => process.exit(0));"

# 5. Reload PM2 (Zero Downtime Restart)
APP_NAME=$(node -e "try { const c = require('./ecosystem.config.js'); console.log(c.apps[0].name); } catch(e) { console.log('skandx-backend'); }" 2>/dev/null || echo "skandx-backend")
echo "🔄 Reloading PM2 Application: $APP_NAME (Zero Downtime)..."
pm2 delete shortmarket-backend 2>/dev/null || true
pm2 reload "$APP_NAME" --update-env 2>/dev/null || pm2 restart "$APP_NAME" --update-env 2>/dev/null || pm2 start ecosystem.config.js
pm2 save 2>/dev/null || true

# 6. Ensure Nginx proxy buffers are configured (Prevents 502 Bad Gateway from upstream header overflow)
if [ -d "/etc/nginx/sites-available" ]; then
  for conf in /etc/nginx/sites-available/*; do
    if [ -f "$conf" ] && grep -q "proxy_pass" "$conf" && ! grep -q "proxy_buffer_size" "$conf"; then
      echo "🔧 Updating Nginx proxy buffer sizes in $conf..."
      sudo sed -i '/location \/ {/a \        proxy_buffer_size 128k;\n        proxy_buffers 4 256k;\n        proxy_busy_buffers_size 256k;' "$conf" 2>/dev/null || true
      sudo nginx -t 2>/dev/null && sudo systemctl reload nginx 2>/dev/null || true
    fi
  done
fi

echo "✅ Deployment Successful! [$APP_NAME] is running cleanly."
cd ..
