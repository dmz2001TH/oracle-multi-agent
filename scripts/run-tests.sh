#!/bin/bash
# Test Runner — Oracle Multi-Agent System
# Usage: bash run-tests.sh [port]

PORT=${1:-3456}
DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "🔮 Oracle Multi-Agent — Test Suite"
echo "════════════════════════════════════"

# Check if server is running
if curl -s "http://localhost:$PORT/api/stats" >/dev/null 2>&1; then
  echo "✅ Server running on port $PORT"
else
  echo "🚀 Starting server..."
  cd "$DIR"
  LLM_PROVIDER=mimo AGENT_MODEL=mimo-v2-pro npx tsx src/index.ts &>/tmp/oracle-test.log &
  SERVER_PID=$!
  sleep 5
  echo "✅ Server started (PID: $SERVER_PID)"
fi

echo ""
echo "📦 Running Unit Tests (49 tests)..."
node "$DIR/test/test-10-features.mjs" 2>&1 | tail -3

echo ""
echo "🌐 Running Integration Tests (34 tests)..."
node "$DIR/test/test-integration.mjs" "$PORT" 2>&1 | tail -3

echo ""
echo "🤖 Running Autonomous E2E Tests (17 tests)..."
node "$DIR/test/test-autonomous-e2e.mjs" "$PORT" 2>&1 | tail -3

echo ""
echo "════════════════════════════════════"
echo "📊 To run MiMo agent test (uses API tokens):"
echo "   curl -X POST http://localhost:$PORT/api/agents \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"name\":\"test\",\"role\":\"coder\"}'"
echo ""
echo "📊 To test autonomous spawning:"
echo "   curl -X POST http://localhost:$PORT/api/orchestrator/goal \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"title\":\"fix bug\",\"description\":\"something broke\"}'"
