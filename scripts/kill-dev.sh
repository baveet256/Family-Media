#!/usr/bin/env bash
# Kill stuck dev servers and free ports
set -e
echo "Stopping stuck processes..."
pkill -f "Family-Media/api.*nest" 2>/dev/null || true
pkill -f "Family-Media/mobile.*expo" 2>/dev/null || true
lsof -ti :3000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti :8081 2>/dev/null | xargs kill -9 2>/dev/null || true
echo "Done. Ports 3000 and 8081 are free."
