# Multi-Claude 3.0 Database Schema

PostgreSQL database schema for the Multi-Claude 3.0 Autonomous Coding System.

## Overview

This database stores all operational data for the autonomous coding system, including:
- Agent session tracking
- Event logging and processing
- Task management and outcomes
- File operation history
- Merge operations and conflict resolution
- Brain processing decisions
- System metrics and analytics

## Schema Version

**Current Version:** 1.0
**Created:** 2025-12-16
**Database:** PostgreSQL 12+

## Quick Start

### Prerequisites

- PostgreSQL 12 or higher
- `uuid-ossp` extension
- `pgcrypto` extension

### Installation

1. **Create Database**
   ```bash
   createdb multi_claude_system
   ```

2. **Apply Schema**
   ```bash
   psql -d multi_claude_system -f schema.sql
   ```

3. **Verify Installation**
   ```bash
   psql -d multi_claude_system -c "\dt"
   psql -d multi_claude_system -c "SELECT * FROM system_metrics;"
   ```

### Using Docker (Optional)

```bash
# Start PostgreSQL container
docker run --name multi-claude-db \
  -e POSTGRES_DB=multi_claude_system \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:15

# Apply schema
docker exec -i multi-claude-db psql -U postgres -d multi_claude_system < schema.sql
```

## Database Structure

### Core Tables

#### `agent_sessions`
Tracks all agent session lifecycles.

**Key Columns:**
- `session_id` (UUID, PK)
- `agent_name` - Name of the agent
- `status` - Session status (initializing, active, completed, etc.)
- `metadata` - JSONB metadata
- `parent_session_id` - For nested agent sessions

**Common Queries:**
```sql
-- Get all active sessions
SELECT * FROM active_sessions;

-- Get session summary
SELECT * FROM session_summary WHERE session_id = 'xxx';

-- Get session hierarchy
SELECT * FROM get_session_hierarchy('root-session-id');
```

#### `agent_events`
Logs all events from agent operations.

**Key Columns:**
- `event_id` (UUID, PK)
- `session_id` (FK)
- `event_type` - Type of event
- `payload` - JSONB event data
- `status` - Processing status

**Common Queries:**
```sql
-- Recent events for a session
SELECT * FROM agent_events
WHERE session_id = 'xxx'
ORDER BY timestamp DESC
LIMIT 50;

-- Events by type
SELECT event_type, COUNT(*)
FROM agent_events
GROUP BY event_type;
```

#### `agent_tasks`
Tracks tasks assigned to and completed by agents.

**Key Columns:**
- `task_id` (UUID, PK)
- `session_id` (FK)
- `task_name` - Task name
- `status` - Task status
- `priority` - Priority (1-10)
- `result` - JSONB result data

**Common Queries:**
```sql
-- Pending tasks by priority
SELECT * FROM pending_tasks;

-- Completed tasks for session
SELECT * FROM agent_tasks
WHERE session_id = 'xxx' AND status = 'completed';

-- Task duration analysis
SELECT task_name, AVG(duration_ms) as avg_duration
FROM agent_tasks
WHERE status = 'completed'
GROUP BY task_name;
```

#### `file_operations`
Records all file system operations.

**Key Columns:**
- `operation_id` (UUID, PK)
- `session_id` (FK)
- `file_path` - Path to file
- `operation_type` - Type (read, write, edit, etc.)
- `lines_added/removed` - Code change metrics

**Common Queries:**
```sql
-- Files modified in session
SELECT DISTINCT file_path
FROM file_operations
WHERE session_id = 'xxx';

-- Most modified files
SELECT file_path, COUNT(*) as modifications
FROM file_operations
GROUP BY file_path
ORDER BY modifications DESC
LIMIT 10;
```

#### `merge_operations`
Tracks merge operations and conflict resolutions.

**Key Columns:**
- `merge_id` (UUID, PK)
- `session_ids` - Array of involved sessions
- `conflict_count` - Total conflicts
- `conflicts_resolved` - Auto-resolved count
- `conflicts_escalated` - Escalated count

**Common Queries:**
```sql
-- Recent merges
SELECT * FROM merge_operations
ORDER BY started_at DESC
LIMIT 20;

-- Merge statistics
SELECT * FROM merge_statistics;

-- Conflicts for a merge
SELECT * FROM merge_conflicts
WHERE merge_id = 'xxx';
```

#### `processing_decisions`
Records brain processing decisions and rationale.

**Key Columns:**
- `decision_id` (UUID, PK)
- `event_id` (FK)
- `decision_type` - Type of decision
- `rationale` - Explanation
- `actions` - JSONB action list
- `outcomes` - JSONB outcome data

**Common Queries:**
```sql
-- Decisions for session
SELECT * FROM processing_decisions
WHERE session_id = 'xxx'
ORDER BY timestamp DESC;

-- Decision types distribution
SELECT decision_type, COUNT(*)
FROM processing_decisions
GROUP BY decision_type;
```

### Supporting Tables

- `merge_conflicts` - Detailed conflict tracking
- `context_storage` - General context storage
- `system_metrics` - System-wide metrics

### Views

- `active_sessions` - Currently active sessions
- `session_summary` - Aggregated session statistics
- `recent_events` - Last 100 events
- `pending_tasks` - Tasks awaiting processing
- `merge_statistics` - Merge operation analytics

## Data Types

### Custom Enums

```sql
-- Session Status
'initializing' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled'

-- Event Status
'pending' | 'processing' | 'processed' | 'failed' | 'skipped'

-- Task Status
'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'blocked'

-- File Operation Type
'read' | 'write' | 'edit' | 'delete' | 'create' | 'move' | 'copy'

-- Merge Resolution Type
'auto_merged' | 'intelligent_reconciliation' | 'pattern_based' | 'user_decision' | 'rejected'

-- Decision Type
'spawn_agent' | 'merge_changes' | 'escalate_conflict' | 'run_validation' | 'persist_state' | 'user_interaction'
```

## JSONB Fields

### Common JSONB Structures

#### Session Metadata
```json
{
  "project_name": "game2048",
  "user_id": "user-123",
  "environment": "development",
  "configuration": {
    "timeout": 300000,
    "max_retries": 3
  }
}
```

#### Event Payload
```json
{
  "event_source": "ProjectScaffolder",
  "details": {
    "files_created": 15,
    "directories_created": 5
  },
  "success": true
}
```

#### Task Result
```json
{
  "output": "Successfully scaffolded project",
  "artifacts": [
    "src/App.tsx",
    "package.json"
  ],
  "metrics": {
    "duration_ms": 1250,
    "files_generated": 12
  }
}
```

### JSONB Query Examples

```sql
-- Query nested JSONB field
SELECT metadata->>'project_name' as project
FROM agent_sessions
WHERE metadata @> '{"environment": "production"}';

-- Update JSONB field
UPDATE agent_sessions
SET metadata = metadata || '{"updated": true}'::jsonb
WHERE session_id = 'xxx';

-- Array contains
SELECT * FROM merge_operations
WHERE 'session-id' = ANY(session_ids);
```

## Triggers

### Automatic Timestamp Updates

- `agent_sessions.updated_at` - Updated on any modification
- `agent_tasks.updated_at` - Updated on any modification
- `context_storage.updated_at` - Updated on any modification

### Status-Based Triggers

- **Session Completion**: Automatically sets `completed_at` when status changes to terminal state
- **Task Timing**: Automatically sets `started_at` and `completed_at` based on status transitions

## Utility Functions

### `get_session_hierarchy(session_id)`
Returns all sessions in a parent-child hierarchy starting from the given session.

```sql
SELECT * FROM get_session_hierarchy('root-session-id');
```

### `calculate_session_metrics(session_id)`
Returns aggregated metrics for a session as JSONB.

```sql
SELECT calculate_session_metrics('session-id');
```

**Example Output:**
```json
{
  "session_id": "abc-123",
  "total_events": 47,
  "total_tasks": 12,
  "completed_tasks": 10,
  "failed_tasks": 1,
  "file_operations": 23,
  "files_modified": 15,
  "processing_decisions": 8
}
```

## Performance Optimization

### Indexes

All tables have appropriate indexes on:
- Primary keys (automatic)
- Foreign keys
- Timestamp columns (for time-range queries)
- Status columns (for filtering)
- JSONB columns (GIN indexes for containment queries)

### Best Practices

1. **Use Prepared Statements**: For repeated queries
2. **Limit Result Sets**: Always use `LIMIT` for exploration queries
3. **Index on JSONB**: Use GIN indexes for frequently queried JSONB fields
4. **Partition Large Tables**: Consider partitioning by date for event tables
5. **Regular VACUUM**: Keep statistics up to date

## Maintenance

### Regular Tasks

```sql
-- Update table statistics
ANALYZE agent_sessions;
ANALYZE agent_events;
ANALYZE agent_tasks;

-- Clean up old data (example)
DELETE FROM agent_events
WHERE timestamp < NOW() - INTERVAL '90 days'
  AND status = 'processed';

-- Check database size
SELECT pg_size_pretty(pg_database_size('multi_claude_system'));

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### Backup & Restore

```bash
# Backup
pg_dump multi_claude_system > backup_$(date +%Y%m%d).sql

# Restore
psql multi_claude_system < backup_20251216.sql

# Backup with compression
pg_dump multi_claude_system | gzip > backup_$(date +%Y%m%d).sql.gz
```

## Connection Examples

### Node.js (pg)
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  database: 'multi_claude_system',
  user: 'postgres',
  password: 'postgres',
  port: 5432,
});

// Query example
const result = await pool.query(
  'SELECT * FROM agent_sessions WHERE session_id = $1',
  ['session-id']
);
```

### Python (psycopg2)
```python
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    database="multi_claude_system",
    user="postgres",
    password="postgres"
)

cursor = conn.cursor()
cursor.execute("SELECT * FROM agent_sessions WHERE status = %s", ('active',))
rows = cursor.fetchall()
```

## Security Considerations

### User Roles

```sql
-- Create read-only user (for Context Fetcher)
CREATE USER context_fetcher WITH PASSWORD 'secure_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO context_fetcher;
GRANT EXECUTE ON FUNCTION get_session_hierarchy TO context_fetcher;
GRANT EXECUTE ON FUNCTION calculate_session_metrics TO context_fetcher;

-- Create write user (for Context Updater)
CREATE USER context_updater WITH PASSWORD 'secure_password';
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO context_updater;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO context_updater;

-- Create admin user
CREATE USER admin_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin_user;
```

### Best Practices

- Use strong passwords
- Enable SSL connections
- Limit network access with `pg_hba.conf`
- Use connection pooling
- Never store credentials in code
- Use environment variables for configuration

## Troubleshooting

### Common Issues

**Issue: Extension not found**
```sql
-- Solution: Install extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

**Issue: Permission denied**
```sql
-- Solution: Grant appropriate permissions
GRANT ALL PRIVILEGES ON DATABASE multi_claude_system TO postgres;
```

**Issue: Slow queries**
```sql
-- Solution: Analyze query performance
EXPLAIN ANALYZE SELECT * FROM agent_events WHERE session_id = 'xxx';

-- Check missing indexes
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public';
```

## Migration Guide

When updating the schema:

1. **Backup database first**
2. **Test migrations on staging**
3. **Use transactions for schema changes**
4. **Document all changes**
5. **Update schema version in system_metrics**

```sql
-- Example migration
BEGIN;

-- Add new column
ALTER TABLE agent_sessions ADD COLUMN new_field TEXT;

-- Update schema version
INSERT INTO system_metrics (metric_name, metric_type, metric_value, metric_data)
VALUES ('schema_version', 'system', 1.1, '{"migration": "add_new_field"}'::jsonb);

COMMIT;
```

## Support

For issues or questions:
- Review agent specifications in `/specs` directory
- Check database logs: `/var/log/postgresql/`
- Consult PostgreSQL documentation: https://www.postgresql.org/docs/

## License

Part of the Multi-Claude 3.0 Autonomous Coding System.

---

**Last Updated:** 2025-12-16
**Schema Version:** 1.0
**Maintainer:** Multi-Claude System Team
