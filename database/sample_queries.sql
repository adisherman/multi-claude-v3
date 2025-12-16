-- Multi-Claude 3.0 Database - Sample Queries
-- Useful queries for interacting with the system database

-- =============================================================================
-- SESSION QUERIES
-- =============================================================================

-- Get all active sessions
SELECT * FROM active_sessions;

-- Get session details with metrics
SELECT
    s.*,
    calculate_session_metrics(s.session_id) as metrics
FROM agent_sessions s
WHERE s.session_id = 'your-session-id';

-- Get session hierarchy (parent-child relationships)
SELECT * FROM get_session_hierarchy('root-session-id');

-- Find sessions by agent type
SELECT * FROM agent_sessions
WHERE agent_name = 'ProjectScaffolder'
ORDER BY started_at DESC
LIMIT 10;

-- Get sessions that took longer than 5 minutes
SELECT
    session_id,
    agent_name,
    status,
    duration_ms / 1000 as duration_seconds
FROM agent_sessions
WHERE duration_ms > 300000
ORDER BY duration_ms DESC;

-- Get failed sessions with error details
SELECT
    session_id,
    agent_name,
    started_at,
    error_details
FROM agent_sessions
WHERE status = 'failed'
ORDER BY started_at DESC;

-- =============================================================================
-- EVENT QUERIES
-- =============================================================================

-- Get recent events across all sessions
SELECT * FROM recent_events;

-- Get events for specific session
SELECT
    event_id,
    event_type,
    timestamp,
    status,
    payload
FROM agent_events
WHERE session_id = 'your-session-id'
ORDER BY timestamp DESC
LIMIT 50;

-- Count events by type
SELECT
    event_type,
    COUNT(*) as count,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
FROM agent_events
GROUP BY event_type
ORDER BY count DESC;

-- Find error events
SELECT
    e.event_id,
    s.agent_name,
    e.event_type,
    e.timestamp,
    e.error_message
FROM agent_events e
JOIN agent_sessions s ON e.session_id = s.session_id
WHERE e.status = 'failed'
ORDER BY e.timestamp DESC;

-- Events within time range
SELECT * FROM agent_events
WHERE timestamp BETWEEN '2025-12-16 00:00:00' AND '2025-12-16 23:59:59'
ORDER BY timestamp DESC;

-- Search events by payload content
SELECT
    event_id,
    event_type,
    payload
FROM agent_events
WHERE payload @> '{"success": true}'::jsonb
LIMIT 20;

-- =============================================================================
-- TASK QUERIES
-- =============================================================================

-- Get all pending tasks ordered by priority
SELECT * FROM pending_tasks;

-- Get task completion statistics for a session
SELECT
    status,
    COUNT(*) as count,
    AVG(duration_ms) as avg_duration_ms
FROM agent_tasks
WHERE session_id = 'your-session-id'
GROUP BY status;

-- Find long-running tasks
SELECT
    task_id,
    session_id,
    task_name,
    status,
    duration_ms / 1000 as duration_seconds
FROM agent_tasks
WHERE status = 'completed' AND duration_ms > 60000
ORDER BY duration_ms DESC;

-- Get tasks with dependencies
SELECT
    task_id,
    task_name,
    status,
    dependencies,
    array_length(dependencies, 1) as dependency_count
FROM agent_tasks
WHERE array_length(dependencies, 1) > 0;

-- Task success rate by type
SELECT
    task_type,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
    ROUND(100.0 * COUNT(CASE WHEN status = 'completed' THEN 1 END) / COUNT(*), 2) as success_rate
FROM agent_tasks
WHERE task_type IS NOT NULL
GROUP BY task_type
ORDER BY total DESC;

-- =============================================================================
-- FILE OPERATION QUERIES
-- =============================================================================

-- Get files modified in a session
SELECT
    file_path,
    operation_type,
    COUNT(*) as operation_count
FROM file_operations
WHERE session_id = 'your-session-id'
GROUP BY file_path, operation_type
ORDER BY operation_count DESC;

-- Most frequently modified files (system-wide)
SELECT
    file_path,
    COUNT(*) as modification_count,
    SUM(lines_added) as total_lines_added,
    SUM(lines_removed) as total_lines_removed
FROM file_operations
WHERE operation_type IN ('write', 'edit')
GROUP BY file_path
ORDER BY modification_count DESC
LIMIT 20;

-- File operations timeline
SELECT
    DATE(timestamp) as date,
    operation_type,
    COUNT(*) as count
FROM file_operations
GROUP BY DATE(timestamp), operation_type
ORDER BY date DESC;

-- Failed file operations
SELECT
    operation_id,
    file_path,
    operation_type,
    timestamp,
    error_message
FROM file_operations
WHERE success = false
ORDER BY timestamp DESC;

-- Files by extension
SELECT
    SUBSTRING(file_path FROM '\.([^.]+)$') as extension,
    COUNT(*) as file_count
FROM file_operations
GROUP BY extension
ORDER BY file_count DESC;

-- =============================================================================
-- MERGE OPERATION QUERIES
-- =============================================================================

-- Recent merge operations
SELECT
    merge_id,
    session_ids,
    status,
    conflict_count,
    conflicts_resolved,
    conflicts_escalated,
    started_at
FROM merge_operations
ORDER BY started_at DESC
LIMIT 20;

-- Merge statistics
SELECT * FROM merge_statistics;

-- Get merge details with conflicts
SELECT
    m.merge_id,
    m.conflict_count,
    m.conflicts_resolved,
    m.conflicts_escalated,
    m.duration_ms,
    ARRAY_AGG(c.file_path) as conflicted_files
FROM merge_operations m
LEFT JOIN merge_conflicts c ON m.merge_id = c.merge_id
GROUP BY m.merge_id, m.conflict_count, m.conflicts_resolved, m.conflicts_escalated, m.duration_ms
ORDER BY m.started_at DESC;

-- Conflicts by severity
SELECT
    severity,
    COUNT(*) as count,
    COUNT(CASE WHEN auto_resolved THEN 1 END) as auto_resolved_count
FROM merge_conflicts
GROUP BY severity
ORDER BY
    CASE severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
    END;

-- Files with most conflicts
SELECT
    file_path,
    COUNT(*) as conflict_count,
    AVG(CASE WHEN auto_resolved THEN 1.0 ELSE 0.0 END) as auto_resolve_rate
FROM merge_conflicts
GROUP BY file_path
ORDER BY conflict_count DESC
LIMIT 10;

-- Merge success rate by resolution type
SELECT
    resolution_type,
    COUNT(*) as count,
    AVG(duration_ms) as avg_duration_ms
FROM merge_operations
WHERE resolution_type IS NOT NULL
GROUP BY resolution_type;

-- =============================================================================
-- PROCESSING DECISION QUERIES
-- =============================================================================

-- Recent processing decisions
SELECT
    decision_id,
    decision_type,
    timestamp,
    rationale,
    executed
FROM processing_decisions
ORDER BY timestamp DESC
LIMIT 20;

-- Decisions by type
SELECT
    decision_type,
    COUNT(*) as count,
    COUNT(CASE WHEN executed THEN 1 END) as executed_count,
    AVG(confidence_score) as avg_confidence
FROM processing_decisions
GROUP BY decision_type;

-- High confidence decisions
SELECT
    decision_id,
    decision_type,
    confidence_score,
    rationale
FROM processing_decisions
WHERE confidence_score > 0.8
ORDER BY confidence_score DESC;

-- Decisions for a specific session
SELECT
    d.decision_id,
    d.decision_type,
    d.timestamp,
    d.rationale,
    d.actions,
    d.outcomes
FROM processing_decisions d
WHERE d.session_id = 'your-session-id'
ORDER BY d.timestamp DESC;

-- =============================================================================
-- CONTEXT STORAGE QUERIES
-- =============================================================================

-- Get latest context by key
SELECT * FROM context_storage
WHERE context_key = 'your-context-key'
  AND (valid_until IS NULL OR valid_until > NOW())
ORDER BY valid_from DESC
LIMIT 1;

-- Get all context for a session
SELECT
    context_key,
    context_type,
    context_data,
    valid_from
FROM context_storage
WHERE session_id = 'your-session-id'
ORDER BY valid_from DESC;

-- Context by type
SELECT
    context_type,
    COUNT(*) as count,
    COUNT(CASE WHEN valid_until IS NULL OR valid_until > NOW() THEN 1 END) as active_count
FROM context_storage
GROUP BY context_type;

-- =============================================================================
-- SYSTEM METRICS QUERIES
-- =============================================================================

-- Get all system metrics
SELECT
    metric_name,
    metric_value,
    timestamp
FROM system_metrics
ORDER BY timestamp DESC;

-- Metrics by type
SELECT
    metric_type,
    COUNT(*) as count,
    AVG(metric_value) as avg_value
FROM system_metrics
WHERE metric_value IS NOT NULL
GROUP BY metric_type;

-- Track schema version history
SELECT
    metric_value as version,
    metric_data,
    timestamp
FROM system_metrics
WHERE metric_name = 'schema_version'
ORDER BY timestamp DESC;

-- =============================================================================
-- ANALYTICAL QUERIES
-- =============================================================================

-- Agent productivity analysis
SELECT
    s.agent_name,
    COUNT(DISTINCT s.session_id) as session_count,
    AVG(s.duration_ms) as avg_session_duration_ms,
    COUNT(DISTINCT t.task_id) as total_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.task_id END) as completed_tasks,
    COUNT(DISTINCT f.file_path) as files_modified
FROM agent_sessions s
LEFT JOIN agent_tasks t ON s.session_id = t.session_id
LEFT JOIN file_operations f ON s.session_id = f.session_id
WHERE s.status = 'completed'
GROUP BY s.agent_name
ORDER BY session_count DESC;

-- Daily activity summary
SELECT
    DATE(s.started_at) as date,
    COUNT(DISTINCT s.session_id) as sessions,
    COUNT(DISTINCT t.task_id) as tasks,
    COUNT(DISTINCT f.file_path) as files_modified,
    COUNT(DISTINCT m.merge_id) as merges
FROM agent_sessions s
LEFT JOIN agent_tasks t ON s.session_id = t.session_id
LEFT JOIN file_operations f ON s.session_id = f.session_id
LEFT JOIN merge_operations m ON s.session_id = ANY(m.session_ids)
GROUP BY DATE(s.started_at)
ORDER BY date DESC;

-- Error rate analysis
SELECT
    DATE(e.timestamp) as date,
    COUNT(*) as total_events,
    COUNT(CASE WHEN e.status = 'failed' THEN 1 END) as failed_events,
    ROUND(100.0 * COUNT(CASE WHEN e.status = 'failed' THEN 1 END) / COUNT(*), 2) as error_rate
FROM agent_events e
GROUP BY DATE(e.timestamp)
ORDER BY date DESC;

-- Session duration distribution
SELECT
    CASE
        WHEN duration_ms < 60000 THEN '< 1 min'
        WHEN duration_ms < 300000 THEN '1-5 min'
        WHEN duration_ms < 900000 THEN '5-15 min'
        WHEN duration_ms < 1800000 THEN '15-30 min'
        ELSE '> 30 min'
    END as duration_bucket,
    COUNT(*) as session_count
FROM agent_sessions
WHERE status = 'completed'
GROUP BY duration_bucket
ORDER BY MIN(duration_ms);

-- =============================================================================
-- CLEANUP QUERIES (USE WITH CAUTION)
-- =============================================================================

-- Delete old processed events (older than 90 days)
-- DELETE FROM agent_events
-- WHERE timestamp < NOW() - INTERVAL '90 days'
--   AND status = 'processed';

-- Delete completed sessions older than 6 months
-- DELETE FROM agent_sessions
-- WHERE status = 'completed'
--   AND completed_at < NOW() - INTERVAL '6 months';

-- Archive old metrics
-- INSERT INTO system_metrics_archive
-- SELECT * FROM system_metrics
-- WHERE timestamp < NOW() - INTERVAL '1 year';
--
-- DELETE FROM system_metrics
-- WHERE timestamp < NOW() - INTERVAL '1 year';

-- =============================================================================
-- MAINTENANCE QUERIES
-- =============================================================================

-- Analyze all tables
ANALYZE agent_sessions;
ANALYZE agent_events;
ANALYZE agent_tasks;
ANALYZE file_operations;
ANALYZE merge_operations;
ANALYZE processing_decisions;

-- Check table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- Check index usage
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Find unused indexes
SELECT
    schemaname,
    tablename,
    indexname
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexname NOT LIKE '%_pkey';

-- Database statistics
SELECT
    pg_size_pretty(pg_database_size(current_database())) as database_size,
    (SELECT COUNT(*) FROM agent_sessions) as total_sessions,
    (SELECT COUNT(*) FROM agent_events) as total_events,
    (SELECT COUNT(*) FROM agent_tasks) as total_tasks,
    (SELECT COUNT(*) FROM file_operations) as total_file_ops;
