#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Adiptify — Azure App Service Startup Script
# This runs after the deployment completes on Azure App Service
# ═══════════════════════════════════════════════════════════

set -e

echo "=== Adiptify Azure Startup ==="
echo "Node version: $(node -v)"
echo "NPM version: $(npm -v)"

# 1. Install backend dependencies
echo "=== Installing backend dependencies ==="
cd /home/site/wwwroot/backend
npm install --production

# 2. Build frontend (if dist/ doesn't exist yet)
if [ ! -f "/home/site/wwwroot/Frontend/dist/index.html" ]; then
    echo "=== Building frontend ==="
    cd /home/site/wwwroot/Frontend
    npm install
    npm run build
else
    echo "=== Frontend already built, skipping ==="
fi

# 3. Start the backend server (which also serves the frontend)
echo "=== Starting Adiptify server ==="
cd /home/site/wwwroot/backend
node app.js
