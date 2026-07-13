#!/usr/bin/env bash
# Start API without watch mode (uses pre-built dist/ — instant start)
set -e
cd "$(dirname "$0")/../api"
if [ ! -f dist/main.js ]; then
  echo "Building API first..."
  npm run build
fi
echo "Starting API on http://localhost:3000"
node dist/main.js
