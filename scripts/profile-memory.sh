#!/bin/bash
# profile-memory.sh - Memory profiling script for detecting leaks
# Uses Node.js inspector and captures heap snapshots

set -e

echo "=========================================="
echo "SoulWallet Memory Profiler"
echo "=========================================="
echo "Started at: $(date)"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROFILE_DIR=".clinic/memory"
DURATION=${1:-60}  # Default 60 seconds

# Create output directory
mkdir -p $PROFILE_DIR

echo -e "${YELLOW}Memory profiling configuration:${NC}"
echo "  Duration: ${DURATION} seconds"
echo "  Output: $PROFILE_DIR"
echo ""

# Check if clinic is installed
if ! command -v clinic &> /dev/null; then
    echo -e "${YELLOW}Installing clinic...${NC}"
    npm install -g clinic
fi

# Build server if needed
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}Building server...${NC}"
    npm run server:build
fi

echo ""
echo -e "${YELLOW}Starting memory profiling...${NC}"
echo "Press Ctrl+C to stop profiling early"
echo ""

# Option 1: Use clinic heapprofiler
echo "=== Using Clinic Heapprofiler ==="
timeout $DURATION clinic heapprofiler -- node dist/server/fastify.js &
PROFILER_PID=$!

# Wait for server to start
sleep 5

# Generate load during profiling
echo ""
echo -e "${YELLOW}Generating load for memory analysis...${NC}"

# Simple load generation
for i in {1..100}; do
    curl -s http://localhost:3001/health > /dev/null &
    curl -s -X POST http://localhost:3001/api/trpc/market.trending \
        -H "Content-Type: application/json" \
        -d '{"json":{}}' > /dev/null &
    sleep 0.5
done

# Wait for profiling to complete
wait $PROFILER_PID 2>/dev/null || true

echo ""
echo -e "${GREEN}Memory profiling complete!${NC}"
echo ""

# List generated reports
echo "Generated reports:"
ls -la $PROFILE_DIR/*.html 2>/dev/null || echo "  No HTML reports found"
ls -la .clinic/*.clinic-heapprofiler 2>/dev/null || echo "  Check .clinic directory"

echo ""
echo "=========================================="
echo "Analysis Tips"
echo "=========================================="
echo "1. Look for objects that grow over time"
echo "2. Check for retained DOM/closure references"
echo "3. Identify large allocations"
echo "4. Compare heap snapshots (before/after load)"
echo ""

# Optional: Node.js native heap snapshot
echo -e "${YELLOW}Creating heap snapshot with Node.js inspector...${NC}"

# Start server with inspector
node --inspect --heapsnapshot-signal=SIGUSR2 dist/server/fastify.js &
NODE_PID=$!
sleep 5

# Take baseline snapshot
echo "Taking baseline heap snapshot..."
kill -USR2 $NODE_PID 2>/dev/null || true
sleep 2

# Generate load
for i in {1..50}; do
    curl -s http://localhost:3001/health > /dev/null &
done
wait
sleep 5

# Take post-load snapshot
echo "Taking post-load heap snapshot..."
kill -USR2 $NODE_PID 2>/dev/null || true
sleep 2

# Cleanup
kill $NODE_PID 2>/dev/null || true

echo ""
echo -e "${GREEN}Heap snapshots saved in current directory${NC}"
echo "Open in Chrome DevTools: chrome://inspect"
echo ""
echo "Completed at: $(date)"
