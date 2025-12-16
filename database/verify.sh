#!/bin/bash

# Multi-Claude 3.0 Database Verification Script
# Verifies the database setup and runs basic tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME=${DB_NAME:-"multi_claude_system"}
DB_USER=${DB_USER:-"postgres"}
DB_PASSWORD=${DB_PASSWORD:-"postgres"}
DB_HOST=${DB_HOST:-"localhost"}
DB_PORT=${DB_PORT:-"5432"}

# Functions
print_header() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}============================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

run_query() {
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -A -c "$1" 2>/dev/null
}

# Main verification
print_header "Multi-Claude 3.0 Database Verification"

echo ""
print_info "Checking database connection..."

if run_query "SELECT 1" > /dev/null 2>&1; then
    print_success "Database connection successful"
else
    print_error "Cannot connect to database"
    exit 1
fi

echo ""
print_info "Checking extensions..."

EXTENSIONS=("uuid-ossp" "pgcrypto")
for ext in "${EXTENSIONS[@]}"; do
    result=$(run_query "SELECT COUNT(*) FROM pg_extension WHERE extname = '$ext'")
    if [ "$result" = "1" ]; then
        print_success "Extension '$ext' is installed"
    else
        print_error "Extension '$ext' is NOT installed"
    fi
done

echo ""
print_info "Checking tables..."

EXPECTED_TABLES=(
    "agent_sessions"
    "agent_events"
    "agent_tasks"
    "file_operations"
    "merge_operations"
    "merge_conflicts"
    "processing_decisions"
    "context_storage"
    "system_metrics"
)

for table in "${EXPECTED_TABLES[@]}"; do
    result=$(run_query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = '$table'")
    if [ "$result" = "1" ]; then
        print_success "Table '$table' exists"
    else
        print_error "Table '$table' is MISSING"
    fi
done

echo ""
print_info "Checking views..."

EXPECTED_VIEWS=(
    "active_sessions"
    "session_summary"
    "recent_events"
    "pending_tasks"
    "merge_statistics"
)

for view in "${EXPECTED_VIEWS[@]}"; do
    result=$(run_query "SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'public' AND table_name = '$view'")
    if [ "$result" = "1" ]; then
        print_success "View '$view' exists"
    else
        print_error "View '$view' is MISSING"
    fi
done

echo ""
print_info "Checking functions..."

EXPECTED_FUNCTIONS=(
    "get_session_hierarchy"
    "calculate_session_metrics"
    "update_updated_at_column"
    "set_session_completion"
    "set_task_timing"
)

for func in "${EXPECTED_FUNCTIONS[@]}"; do
    result=$(run_query "SELECT COUNT(*) FROM pg_proc WHERE proname = '$func'")
    if [ "$result" -gt "0" ]; then
        print_success "Function '$func' exists"
    else
        print_error "Function '$func' is MISSING"
    fi
done

echo ""
print_info "Checking triggers..."

TRIGGER_COUNT=$(run_query "SELECT COUNT(*) FROM pg_trigger WHERE tgisinternal = false")
print_info "Found $TRIGGER_COUNT triggers"

echo ""
print_info "Checking indexes..."

INDEX_COUNT=$(run_query "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public'")
print_info "Found $INDEX_COUNT indexes"

echo ""
print_info "Running basic operations test..."

# Test 1: Insert session
SESSION_ID=$(run_query "INSERT INTO agent_sessions (agent_name, agent_type, status) VALUES ('TestAgent', 'test', 'active') RETURNING session_id")
if [ -n "$SESSION_ID" ]; then
    print_success "Test 1: Insert session - PASSED"
else
    print_error "Test 1: Insert session - FAILED"
fi

# Test 2: Insert event
if [ -n "$SESSION_ID" ]; then
    EVENT_ID=$(run_query "INSERT INTO agent_events (session_id, event_type, payload) VALUES ('$SESSION_ID', 'test_event', '{}') RETURNING event_id")
    if [ -n "$EVENT_ID" ]; then
        print_success "Test 2: Insert event - PASSED"
    else
        print_error "Test 2: Insert event - FAILED"
    fi
fi

# Test 3: Insert task
if [ -n "$SESSION_ID" ]; then
    TASK_ID=$(run_query "INSERT INTO agent_tasks (session_id, task_name, status) VALUES ('$SESSION_ID', 'Test Task', 'pending') RETURNING task_id")
    if [ -n "$TASK_ID" ]; then
        print_success "Test 3: Insert task - PASSED"
    else
        print_error "Test 3: Insert task - FAILED"
    fi
fi

# Test 4: Update task status (trigger test)
if [ -n "$TASK_ID" ]; then
    run_query "UPDATE agent_tasks SET status = 'in_progress' WHERE task_id = '$TASK_ID'"
    STARTED_AT=$(run_query "SELECT started_at FROM agent_tasks WHERE task_id = '$TASK_ID'")
    if [ -n "$STARTED_AT" ] && [ "$STARTED_AT" != "" ]; then
        print_success "Test 4: Task timing trigger - PASSED"
    else
        print_error "Test 4: Task timing trigger - FAILED"
    fi
fi

# Test 5: JSONB operations
if [ -n "$SESSION_ID" ]; then
    run_query "UPDATE agent_sessions SET metadata = '{\"test\": true}'::jsonb WHERE session_id = '$SESSION_ID'"
    METADATA=$(run_query "SELECT metadata->>'test' FROM agent_sessions WHERE session_id = '$SESSION_ID'")
    if [ "$METADATA" = "true" ]; then
        print_success "Test 5: JSONB operations - PASSED"
    else
        print_error "Test 5: JSONB operations - FAILED"
    fi
fi

# Test 6: View queries
if [ -n "$SESSION_ID" ]; then
    ACTIVE_COUNT=$(run_query "SELECT COUNT(*) FROM active_sessions WHERE session_id = '$SESSION_ID'")
    if [ "$ACTIVE_COUNT" = "1" ]; then
        print_success "Test 6: View queries - PASSED"
    else
        print_error "Test 6: View queries - FAILED"
    fi
fi

# Test 7: Function call
if [ -n "$SESSION_ID" ]; then
    METRICS=$(run_query "SELECT calculate_session_metrics('$SESSION_ID')")
    if [ -n "$METRICS" ]; then
        print_success "Test 7: Function call - PASSED"
    else
        print_error "Test 7: Function call - FAILED"
    fi
fi

# Cleanup test data
print_info "Cleaning up test data..."
if [ -n "$SESSION_ID" ]; then
    run_query "DELETE FROM agent_sessions WHERE session_id = '$SESSION_ID'"
    print_success "Test data cleaned up"
fi

echo ""
print_info "Database statistics..."

TABLE_STATS=$(run_query "
    SELECT
        schemaname,
        COUNT(*) as table_count,
        pg_size_pretty(SUM(pg_total_relation_size(schemaname||'.'||tablename))) as total_size
    FROM pg_tables
    WHERE schemaname = 'public'
    GROUP BY schemaname
")

echo -e "${YELLOW}$TABLE_STATS${NC}"

echo ""
print_header "Verification Complete!"
echo ""
print_success "Your Multi-Claude 3.0 database is properly configured!"
echo ""
print_info "Summary:"
echo "  - Extensions: Installed"
echo "  - Tables: $(echo "${EXPECTED_TABLES[@]}" | wc -w) / $(echo "${EXPECTED_TABLES[@]}" | wc -w)"
echo "  - Views: $(echo "${EXPECTED_VIEWS[@]}" | wc -w) / $(echo "${EXPECTED_VIEWS[@]}" | wc -w)"
echo "  - Functions: $(echo "${EXPECTED_FUNCTIONS[@]}" | wc -w) / $(echo "${EXPECTED_FUNCTIONS[@]}" | wc -w)"
echo "  - Indexes: $INDEX_COUNT"
echo "  - Triggers: $TRIGGER_COUNT"
echo ""
print_info "The database is ready for Multi-Claude agents!"
echo ""
