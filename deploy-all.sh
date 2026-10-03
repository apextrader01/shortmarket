#!/bin/bash
# ==============================================================================
# SkandX Unified Deployment Script: Updates Both Staging and Main
# ==============================================================================
set -e

echo "========================================================"
echo "🚀 [1/2] UPDATING STAGING (staging.skandx.in)..."
echo "========================================================"
if [ -d "/home/centralasp123/shortmarket-staging" ]; then
    cd /home/centralasp123/shortmarket-staging
    echo "📥 Syncing branch 'development' in staging..."
    rm -f .git/index.lock 2>/dev/null || true
    git fetch origin development
    git checkout development
    git reset --hard origin/development
    chmod +x deploy.sh deploy-all.sh 2>/dev/null || true
    ./deploy.sh
else
    echo "⚠️ Directory /home/centralasp123/shortmarket-staging not found! Skipping staging."
fi

echo ""
echo "========================================================"
echo "🚀 [2/2] UPDATING PRODUCTION / MAIN (skandx.in)..."
echo "========================================================"
if [ -d "/home/centralasp123/shortmarket" ]; then
    cd /home/centralasp123/shortmarket
    echo "📥 Syncing branch 'main' in production..."
    rm -f .git/index.lock 2>/dev/null || true
    git fetch origin main
    git checkout main
    git reset --hard origin/main
    chmod +x deploy.sh deploy-all.sh 2>/dev/null || true
    ./deploy.sh
else
    echo "⚠️ Directory /home/centralasp123/shortmarket not found! Skipping production."
fi

echo ""
echo "========================================================"
echo "📊 Current PM2 Cluster Status:"
echo "========================================================"
pm2 status

echo ""
echo "========================================================"
echo "🎉 SUCCESS! Both Staging and Production are updated and live!"
echo "   - Staging: https://staging.skandx.in"
echo "   - Main:    https://skandx.in"
echo "========================================================"
