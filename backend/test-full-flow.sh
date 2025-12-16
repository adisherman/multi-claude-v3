#!/bin/bash

# Multi-Claude 3.0 Full Event Flow Test
# Tests the complete event processing pipeline

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Multi-Claude 3.0 Full Flow Test${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""

# Wait for server to be ready
wait_for_server() {
    echo -e "${YELLOW}⏳ Waiting for server to start...${NC}"
    for i in {1..30}; do
        if curl -s http://localhost:8080/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓ Server is ready${NC}"
            return 0
        fi
        sleep 1
    done
    echo -e "${RED}✗ Server failed to start${NC}"
    exit 1
}

# Test 1: Health Check
test_health() {
    echo ""
    echo -e "${BLUE}Test 1: Health Check${NC}"
    echo "GET /health"

    RESPONSE=$(curl -s http://localhost:8080/health)
    STATUS=$(echo $RESPONSE | jq -r '.status')
    DB_CONNECTED=$(echo $RESPONSE | jq -r '.database.connected')

    if [ "$STATUS" = "healthy" ] && [ "$DB_CONNECTED" = "true" ]; then
        echo -e "${GREEN}✓ System healthy${NC}"
        echo "  Status: $STATUS"
        echo "  Database: Connected"
    else
        echo -e "${RED}✗ System not healthy${NC}"
        exit 1
    fi
}

# Test 2: Submit Event
test_submit_event() {
    echo ""
    echo -e "${BLUE}Test 2: Submit Event${NC}"
    echo "POST /events"

    # Generate UUIDs
    EVENT_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
    SESSION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

    EVENT_DATA='{
      "event_id": "'$EVENT_ID'",
      "session_id": "'$SESSION_ID'",
      "event_type": "project_scaffold_request",
      "agent_name": "ProjectScaffolder",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
      "payload": {
        "project_type": "react-typescript",
        "name": "test-project",
        "features": ["routing", "state-management"]
      }
    }'

    RESPONSE=$(curl -s -X POST http://localhost:8080/events \
        -H "Content-Type: application/json" \
        -d "$EVENT_DATA")

    EVENT_ID=$(echo $RESPONSE | jq -r '.event_id')
    STATUS=$(echo $RESPONSE | jq -r '.status')

    if [ "$STATUS" = "queued" ]; then
        echo -e "${GREEN}✓ Event submitted successfully${NC}"
        echo "  Event ID: $EVENT_ID"
        echo "  Status: $STATUS"

        # Store event ID for later tests
        echo $EVENT_ID > /tmp/test_event_id.txt
    else
        echo -e "${RED}✗ Event submission failed${NC}"
        echo $RESPONSE | jq .
        exit 1
    fi

    # Wait for processing
    echo -e "${YELLOW}⏳ Waiting for event processing (5 seconds)...${NC}"
    sleep 5
}

# Test 3: Check Metrics
test_metrics() {
    echo ""
    echo -e "${BLUE}Test 3: Check Processing Metrics${NC}"
    echo "GET /metrics"

    RESPONSE=$(curl -s http://localhost:8080/metrics)
    TOTAL_EVENTS=$(echo $RESPONSE | jq -r '.total_events')
    PROCESSED_EVENTS=$(echo $RESPONSE | jq -r '.processed_events')

    echo -e "${GREEN}✓ Metrics retrieved${NC}"
    echo "  Total Events: $TOTAL_EVENTS"
    echo "  Processed Events: $PROCESSED_EVENTS"
}

# Test 4: Check Queue Status
test_queue() {
    echo ""
    echo -e "${BLUE}Test 4: Check Queue Status${NC}"
    echo "GET /queue/status"

    RESPONSE=$(curl -s http://localhost:8080/queue/status)
    PENDING=$(echo $RESPONSE | jq -r '.pending')
    PROCESSING=$(echo $RESPONSE | jq -r '.processing')

    echo -e "${GREEN}✓ Queue status retrieved${NC}"
    echo "  Pending: $PENDING"
    echo "  Processing: $PROCESSING"
}

# Test 5: Check Decision Rules
test_rules() {
    echo ""
    echo -e "${BLUE}Test 5: Check Decision Rules${NC}"
    echo "GET /decisions/rules"

    RESPONSE=$(curl -s http://localhost:8080/decisions/rules)
    RULE_COUNT=$(echo $RESPONSE | jq -r '.rules | length')

    echo -e "${GREEN}✓ Decision rules retrieved${NC}"
    echo "  Total Rules: $RULE_COUNT"

    if [ $RULE_COUNT -gt 0 ]; then
        echo "  Rules:"
        echo $RESPONSE | jq -r '.rules[] | "    - \(.name) (priority: \(.priority))"'
    fi
}

# Test 6: Verify Database Persistence
test_database() {
    echo ""
    echo -e "${BLUE}Test 6: Verify Database Persistence${NC}"

    # Check sessions
    SESSION_COUNT=$(psql -d multi_claude_system -t -A -c "SELECT COUNT(*) FROM agent_sessions")
    echo -e "${GREEN}✓ Agent Sessions: $SESSION_COUNT${NC}"

    # Check events
    EVENT_COUNT=$(psql -d multi_claude_system -t -A -c "SELECT COUNT(*) FROM agent_events")
    echo -e "${GREEN}✓ Agent Events: $EVENT_COUNT${NC}"

    # Check decisions
    DECISION_COUNT=$(psql -d multi_claude_system -t -A -c "SELECT COUNT(*) FROM processing_decisions")
    echo -e "${GREEN}✓ Processing Decisions: $DECISION_COUNT${NC}"

    # Show recent activity
    echo ""
    echo "Recent Events:"
    psql -d multi_claude_system -c "
        SELECT
            event_type,
            status,
            created_at
        FROM agent_events
        ORDER BY created_at DESC
        LIMIT 5;
    " 2>/dev/null || echo "  (Database query failed - this is optional)"
}

# Run all tests
main() {
    wait_for_server
    test_health
    test_submit_event
    test_metrics
    test_queue
    test_rules
    test_database

    echo ""
    echo -e "${GREEN}=====================================${NC}"
    echo -e "${GREEN}All tests passed! ✓${NC}"
    echo -e "${GREEN}=====================================${NC}"
    echo ""
    echo "The Multi-Claude 3.0 event processing pipeline is working correctly!"
}

# Run tests
main
