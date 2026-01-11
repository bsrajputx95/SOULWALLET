#!/bin/bash
# Plan9 Step 6: API Performance Profiling Script
# Uses clinic.js for CPU, memory, and event loop analysis
#
# Prerequisites:
#   npm install -g clinic autocannon
#   npm run server:build
#
# Usage: ./scripts/profile-api.sh

set -e

echo "=========================================="
echo "SoulWallet API Performance Profiler"
echo "=========================================="

# Configuration
PORT=${PORT:-3001}
HOST=${HOST:-localhost}
DURATION=${DURATION:-30}
CONNECTIONS=${CONNECTIONS:-100}
OUTPUT_DIR=".clinic"

# Ensure output directory exists
mkdir -p $OUTPUT_DIR

echo ""
echo "Building server..."
npm run server:build || { echo "Build failed!"; exit 1; }

echo ""
echo "=========================================="
echo "1. Running Doctor Analysis (Overall Health)"
echo "=========================================="
echo "Testing: http://$HOST:$PORT/health"
clinic doctor --on-port "autocannon -c $CONNECTIONS -d $DURATION http://$HOST:$PORT/health" -- node dist/server/fastify.js &
DOCTOR_PID=$!
wait $DOCTOR_PID || true

echo ""
echo "=========================================="
echo "2. Running Flame Graph (CPU Profiling)"
echo "=========================================="
echo "Testing: http://$HOST:$PORT/api/trpc/market.getTopCoins"
clinic flame --on-port "autocannon -c $CONNECTIONS -d $DURATION http://$HOST:$PORT/api/trpc/market.getTopCoins" -- node dist/server/fastify.js &
FLAME_PID=$!
wait $FLAME_PID || true

echo ""
echo "=========================================="
echo "3. Running Bubbleprof (Async Operations)"
echo "=========================================="
echo "Testing: Mixed endpoints"
clinic bubbleprof --on-port "autocannon -c 50 -d 20 http://$HOST:$PORT/health" -- node dist/server/fastify.js &
BUBBLE_PID=$!
wait $BUBBLE_PID || true

echo ""
echo "=========================================="
echo "4. Running Heap Profiler (Memory)"
echo "=========================================="
echo "Testing: http://$HOST:$PORT/health"
clinic heapprofiler --on-port "autocannon -c 50 -d 20 http://$HOST:$PORT/health" -- node dist/server/fastify.js &
HEAP_PID=$!
wait $HEAP_PID || true

echo ""
echo "=========================================="
echo "Profiling Complete!"
echo "=========================================="
echo ""
echo "Reports saved to $OUTPUT_DIR directory."
echo "Open .html files in a browser to view results."
echo ""
echo "Report types:"
echo "  - .clinic/*.html (Doctor - overall health)"
echo "  - .clinic/*.html (Flame - CPU hotspots)"
echo "  - .clinic/*.html (Bubbleprof - async operations)"
echo "  - .clinic/*.html (Heapprofiler - memory usage)"
echo ""
ls -la $OUTPUT_DIR/*.html 2>/dev/null || echo "Reports generated, check $OUTPUT_DIR"
