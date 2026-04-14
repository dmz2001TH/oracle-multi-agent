#!/bin/bash

# Smoke Test Script
# Phase 3: VALIDATION
# From MAW Guide + Soul-Brews + LangGraph + PyAgentSpec + Superpowers

echo "=== Smoke Test ==="
echo "Testing critical endpoints..."

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test 1: Agent Service /agents/status
echo "Testing: curl http://localhost:4000/agents/status"
AGENT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/agents/status)
if [ "$AGENT_STATUS" -eq 200 ]; then
    echo -e "${GREEN}✓${NC} Agent service /agents/status returned 200"
else
    echo -e "${RED}✗${NC} Agent service /agents/status returned $AGENT_STATUS (expected 200)"
    exit 1
fi

# Test 2: Dashboard /health
echo "Testing: curl http://localhost:3456/health"
DASHBOARD_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3456/health)
if [ "$DASHBOARD_HEALTH" -eq 200 ]; then
    echo -e "${GREEN}✓${NC} Dashboard /health returned 200"
else
    echo -e "${RED}✗${NC} Dashboard /health returned $DASHBOARD_HEALTH (expected 200)"
    exit 1
fi

# Test 3: Dashboard index.html
echo "Testing: curl http://localhost:3456/dashboard/index.html"
DASHBOARD_INDEX=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3456/dashboard/index.html)
if [ "$DASHBOARD_INDEX" -eq 200 ]; then
    echo -e "${GREEN}✓${NC} Dashboard /dashboard/index.html returned 200"
else
    echo -e "${RED}✗${NC} Dashboard /dashboard/index.html returned $DASHBOARD_INDEX (expected 200)"
    exit 1
fi

echo ""
echo -e "${GREEN}=== All Smoke Tests Passed ===${NC}"
exit 0
