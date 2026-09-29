#!/bin/bash
# ==============================================================================
# Deploy Both Staging and Production in One Command
# ==============================================================================

set -e

echo "========================================================"
echo "🚀 1/2 DEPLOYING STAGING (staging.skandx.in)..."
echo "========================================================"
cd /home/centralasp123/shortmarket-staging
./deploy.sh

echo ""
echo "========================================================"
echo "🚀 2/2 DEPLOYING PRODUCTION (skandx.in)..."
echo "========================================================"
cd /home/centralasp123/shortmarket
./deploy.sh

echo ""
echo "========================================================"
echo "🎉 SUCCESS! Both Staging and Production are updated and live!"
echo "========================================================"
