-- Multi-Claude 3.0 Autonomous Coding System
-- PostgreSQL Database Schema
-- Version: 1.0
-- Created: 2025-12-16

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable advanced JSONB operations
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- CUSTOM TYPES
-- =============================================================================

-- Session status enumeration
CREATE TYPE session_status AS ENUM (
    'initializing',
    'active',
    'paused',
    'completed',
    'failed',
    'cancelled'
);

-- Event status enumeration
CREATE TYPE event_status AS ENUM (
    'pending',
    'processing',
    'processed',
    'failed',
    'skipped'
);

-- Task status enumeration
CREATE TYPE task_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
    'blocked'
);

-- File operation type enumeration
CREATE TYPE file_operation_type AS ENUM (
    'read',
    'write',
    'edit',
    'delete',
    'create',
    'move',
    'copy'
);

-- Merge resolution type enumeration
CREATE TYPE merge_resolution_type AS ENUM (
    'auto_merged',
    'intelligent_reconciliation',
    'pattern_based',
    'user_decision',
    'rejected'
);

-- Decision type enumeration
CREATE TYPE decision_type AS ENUM (
    'spawn_agent',
    'merge_changes',
    'escalate_conflict',
    'run_validation',
    'persist_state',
    'user_interaction'
);

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Agent Sessions Table
-- Tracks all agent session lifecycles
-- -----------------------------------------------------------------------------
CREATE TABLE agent_sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_name VARCHAR(255) NOT NULL,
    agent_type VARCHAR(100) NOT NULL,
    parent_session_id UUID REFERENCES agent_sessions(session_id) ON DELETE SET NULL,
    status session_status NOT NULL DEFAULT 'initializing',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
            ELSE NULL
        END
    ) STORED,
    metadata JSONB DEFAULT '{}'::jsonb,
    configuration JSONB DEFAULT '{}'::jsonb,
    error_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_completion_time CHECK (
        completed_at IS NULL OR completed_at >= started_at
    ),
    CONSTRAINT valid_agent_name CHECK (
        agent_name <> ''
    )
);

-- Indexes for agent_sessions
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX idx_agent_sessions_agent_name ON agent_sessions(agent_name);
CREATE INDEX idx_agent_sessions_started_at ON agent_sessions(started_at DESC);
CREATE INDEX idx_agent_sessions_parent ON agent_sessions(parent_session_id);
CREATE INDEX idx_agent_sessions_metadata ON agent_sessions USING GIN(metadata);

-- -----------------------------------------------------------------------------
-- Agent Events Table
-- Logs all events from agent operations
-- -----------------------------------------------------------------------------
CREATE TABLE agent_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    status event_status NOT NULL DEFAULT 'pending',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    processed_at TIMESTAMP WITH TIME ZONE,
    processing_duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_event_type CHECK (
        event_type <> ''
    ),
    CONSTRAINT valid_processed_time CHECK (
        processed_at IS NULL OR processed_at >= timestamp
    )
);

-- Indexes for agent_events
CREATE INDEX idx_agent_events_session_id ON agent_events(session_id);
CREATE INDEX idx_agent_events_timestamp ON agent_events(timestamp DESC);
CREATE INDEX idx_agent_events_event_type ON agent_events(event_type);
CREATE INDEX idx_agent_events_status ON agent_events(status);
CREATE INDEX idx_agent_events_payload ON agent_events USING GIN(payload);
CREATE INDEX idx_agent_events_composite ON agent_events(session_id, timestamp DESC);

-- -----------------------------------------------------------------------------
-- Agent Tasks Table
-- Tracks tasks assigned to and completed by agents
-- -----------------------------------------------------------------------------
CREATE TABLE agent_tasks (
    task_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
    task_name VARCHAR(255) NOT NULL,
    task_type VARCHAR(100),
    description TEXT,
    status task_status NOT NULL DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    dependencies UUID[] DEFAULT ARRAY[]::UUID[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN completed_at IS NOT NULL AND started_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
            ELSE NULL
        END
    ) STORED,
    result JSONB,
    error_details JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_task_name CHECK (
        task_name <> ''
    ),
    CONSTRAINT valid_task_timing CHECK (
        (started_at IS NULL OR started_at >= created_at) AND
        (completed_at IS NULL OR completed_at >= started_at)
    ),
    CONSTRAINT valid_priority CHECK (
        priority BETWEEN 1 AND 10
    )
);

-- Indexes for agent_tasks
CREATE INDEX idx_agent_tasks_session_id ON agent_tasks(session_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX idx_agent_tasks_priority ON agent_tasks(priority DESC);
CREATE INDEX idx_agent_tasks_created_at ON agent_tasks(created_at DESC);
CREATE INDEX idx_agent_tasks_composite ON agent_tasks(session_id, status, priority DESC);
CREATE INDEX idx_agent_tasks_metadata ON agent_tasks USING GIN(metadata);

-- -----------------------------------------------------------------------------
-- File Operations Table
-- Records all file system operations performed by agents
-- -----------------------------------------------------------------------------
CREATE TABLE file_operations (
    operation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
    task_id UUID REFERENCES agent_tasks(task_id) ON DELETE SET NULL,
    file_path TEXT NOT NULL,
    operation_type file_operation_type NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL DEFAULT true,
    file_size_bytes BIGINT,
    lines_added INTEGER,
    lines_removed INTEGER,
    details JSONB DEFAULT '{}'::jsonb,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_file_path CHECK (
        file_path <> ''
    ),
    CONSTRAINT valid_file_size CHECK (
        file_size_bytes IS NULL OR file_size_bytes >= 0
    ),
    CONSTRAINT valid_line_counts CHECK (
        (lines_added IS NULL OR lines_added >= 0) AND
        (lines_removed IS NULL OR lines_removed >= 0)
    )
);

-- Indexes for file_operations
CREATE INDEX idx_file_operations_session_id ON file_operations(session_id);
CREATE INDEX idx_file_operations_file_path ON file_operations(file_path);
CREATE INDEX idx_file_operations_operation_type ON file_operations(operation_type);
CREATE INDEX idx_file_operations_timestamp ON file_operations(timestamp DESC);
CREATE INDEX idx_file_operations_composite ON file_operations(session_id, file_path, timestamp DESC);

-- -----------------------------------------------------------------------------
-- Merge Operations Table
-- Tracks merge operations and conflict resolutions
-- -----------------------------------------------------------------------------
CREATE TABLE merge_operations (
    merge_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_ids UUID[] NOT NULL,
    initiated_by_session_id UUID REFERENCES agent_sessions(session_id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    conflict_count INTEGER DEFAULT 0,
    conflicts_resolved INTEGER DEFAULT 0,
    conflicts_escalated INTEGER DEFAULT 0,
    resolution_type merge_resolution_type,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER GENERATED ALWAYS AS (
        CASE
            WHEN completed_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
            ELSE NULL
        END
    ) STORED,
    conflict_summary JSONB DEFAULT '{}'::jsonb,
    resolution_details JSONB DEFAULT '{}'::jsonb,
    merged_files TEXT[] DEFAULT ARRAY[]::TEXT[],
    validation_results JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_session_ids CHECK (
        array_length(session_ids, 1) >= 2
    ),
    CONSTRAINT valid_conflict_counts CHECK (
        conflict_count >= 0 AND
        conflicts_resolved >= 0 AND
        conflicts_escalated >= 0 AND
        (conflicts_resolved + conflicts_escalated) <= conflict_count
    ),
    CONSTRAINT valid_completion_time CHECK (
        completed_at IS NULL OR completed_at >= started_at
    )
);

-- Indexes for merge_operations
CREATE INDEX idx_merge_operations_session_ids ON merge_operations USING GIN(session_ids);
CREATE INDEX idx_merge_operations_status ON merge_operations(status);
CREATE INDEX idx_merge_operations_started_at ON merge_operations(started_at DESC);
CREATE INDEX idx_merge_operations_merged_files ON merge_operations USING GIN(merged_files);

-- -----------------------------------------------------------------------------
-- Merge Conflicts Table
-- Detailed tracking of individual merge conflicts
-- -----------------------------------------------------------------------------
CREATE TABLE merge_conflicts (
    conflict_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merge_id UUID NOT NULL REFERENCES merge_operations(merge_id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    conflict_type VARCHAR(100) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    line_number INTEGER,
    conflicting_sessions UUID[] NOT NULL,
    resolution_strategy VARCHAR(100),
    auto_resolved BOOLEAN DEFAULT false,
    resolution_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,

    -- Constraints
    CONSTRAINT valid_severity CHECK (
        severity IN ('low', 'medium', 'high', 'critical')
    ),
    CONSTRAINT valid_line_number CHECK (
        line_number IS NULL OR line_number > 0
    )
);

-- Indexes for merge_conflicts
CREATE INDEX idx_merge_conflicts_merge_id ON merge_conflicts(merge_id);
CREATE INDEX idx_merge_conflicts_file_path ON merge_conflicts(file_path);
CREATE INDEX idx_merge_conflicts_severity ON merge_conflicts(severity);
CREATE INDEX idx_merge_conflicts_auto_resolved ON merge_conflicts(auto_resolved);

-- -----------------------------------------------------------------------------
-- Processing Decisions Table
-- Records brain processing decisions and rationale
-- -----------------------------------------------------------------------------
CREATE TABLE processing_decisions (
    decision_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES agent_events(event_id) ON DELETE CASCADE,
    session_id UUID REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
    decision_type decision_type NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    rationale TEXT,
    actions JSONB NOT NULL DEFAULT '[]'::jsonb,
    outcomes JSONB,
    confidence_score DECIMAL(3, 2),
    executed BOOLEAN DEFAULT false,
    executed_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_confidence_score CHECK (
        confidence_score IS NULL OR (confidence_score >= 0 AND confidence_score <= 1)
    ),
    CONSTRAINT valid_executed_time CHECK (
        executed_at IS NULL OR executed_at >= timestamp
    )
);

-- Indexes for processing_decisions
CREATE INDEX idx_processing_decisions_event_id ON processing_decisions(event_id);
CREATE INDEX idx_processing_decisions_session_id ON processing_decisions(session_id);
CREATE INDEX idx_processing_decisions_decision_type ON processing_decisions(decision_type);
CREATE INDEX idx_processing_decisions_timestamp ON processing_decisions(timestamp DESC);
CREATE INDEX idx_processing_decisions_executed ON processing_decisions(executed);

-- -----------------------------------------------------------------------------
-- Context Storage Table
-- General-purpose context and state storage
-- -----------------------------------------------------------------------------
CREATE TABLE context_storage (
    context_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
    context_key VARCHAR(255) NOT NULL,
    context_type VARCHAR(100) NOT NULL,
    context_data JSONB NOT NULL,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE,
    version INTEGER DEFAULT 1,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_context_key CHECK (
        context_key <> ''
    ),
    CONSTRAINT valid_validity_period CHECK (
        valid_until IS NULL OR valid_until > valid_from
    ),
    CONSTRAINT valid_version CHECK (
        version > 0
    )
);

-- Indexes for context_storage
CREATE INDEX idx_context_storage_session_id ON context_storage(session_id);
CREATE INDEX idx_context_storage_context_key ON context_storage(context_key);
CREATE INDEX idx_context_storage_context_type ON context_storage(context_type);
CREATE INDEX idx_context_storage_valid_from ON context_storage(valid_from DESC);
CREATE INDEX idx_context_storage_composite ON context_storage(session_id, context_key, valid_from DESC);
CREATE INDEX idx_context_storage_data ON context_storage USING GIN(context_data);

-- -----------------------------------------------------------------------------
-- System Metrics Table
-- System-wide performance and operational metrics
-- -----------------------------------------------------------------------------
CREATE TABLE system_metrics (
    metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(255) NOT NULL,
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL,
    metric_data JSONB,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    session_id UUID REFERENCES agent_sessions(session_id) ON DELETE SET NULL,
    tags JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_metric_name CHECK (
        metric_name <> ''
    )
);

-- Indexes for system_metrics
CREATE INDEX idx_system_metrics_metric_name ON system_metrics(metric_name);
CREATE INDEX idx_system_metrics_metric_type ON system_metrics(metric_type);
CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp DESC);
CREATE INDEX idx_system_metrics_session_id ON system_metrics(session_id);
CREATE INDEX idx_system_metrics_composite ON system_metrics(metric_name, timestamp DESC);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Update timestamp trigger function
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_agent_sessions_updated_at
    BEFORE UPDATE ON agent_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agent_tasks_updated_at
    BEFORE UPDATE ON agent_tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_context_storage_updated_at
    BEFORE UPDATE ON context_storage
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------------------------------
-- Session completion trigger
-- Automatically set completed_at when status changes to completed/failed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_session_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status IN ('completed', 'failed', 'cancelled') AND OLD.status NOT IN ('completed', 'failed', 'cancelled') THEN
        NEW.completed_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_session_completion
    BEFORE UPDATE ON agent_sessions
    FOR EACH ROW
    EXECUTE FUNCTION set_session_completion();

-- -----------------------------------------------------------------------------
-- Task timing trigger
-- Automatically set started_at and completed_at based on status changes
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_task_timing()
RETURNS TRIGGER AS $$
BEGIN
    -- Set started_at when task moves to in_progress
    IF NEW.status = 'in_progress' AND OLD.status = 'pending' AND NEW.started_at IS NULL THEN
        NEW.started_at = NOW();
    END IF;

    -- Set completed_at when task reaches terminal status
    IF NEW.status IN ('completed', 'failed', 'cancelled') AND OLD.status NOT IN ('completed', 'failed', 'cancelled') THEN
        NEW.completed_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_task_timing
    BEFORE UPDATE ON agent_tasks
    FOR EACH ROW
    EXECUTE FUNCTION set_task_timing();

-- =============================================================================
-- VIEWS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Active Sessions View
-- Quick view of all currently active sessions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW active_sessions AS
SELECT
    session_id,
    agent_name,
    agent_type,
    status,
    started_at,
    EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000 AS running_duration_ms,
    metadata
FROM agent_sessions
WHERE status IN ('initializing', 'active', 'paused')
ORDER BY started_at DESC;

-- -----------------------------------------------------------------------------
-- Session Summary View
-- Aggregated view of session activities
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW session_summary AS
SELECT
    s.session_id,
    s.agent_name,
    s.status,
    s.started_at,
    s.completed_at,
    s.duration_ms,
    COUNT(DISTINCT e.event_id) AS total_events,
    COUNT(DISTINCT t.task_id) AS total_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.task_id END) AS completed_tasks,
    COUNT(DISTINCT CASE WHEN t.status = 'failed' THEN t.task_id END) AS failed_tasks,
    COUNT(DISTINCT f.operation_id) AS file_operations
FROM agent_sessions s
LEFT JOIN agent_events e ON s.session_id = e.session_id
LEFT JOIN agent_tasks t ON s.session_id = t.session_id
LEFT JOIN file_operations f ON s.session_id = f.session_id
GROUP BY s.session_id, s.agent_name, s.status, s.started_at, s.completed_at, s.duration_ms;

-- -----------------------------------------------------------------------------
-- Recent Events View
-- Last 100 events across all sessions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW recent_events AS
SELECT
    e.event_id,
    e.session_id,
    s.agent_name,
    e.event_type,
    e.event_category,
    e.timestamp,
    e.status,
    e.payload
FROM agent_events e
JOIN agent_sessions s ON e.session_id = s.session_id
ORDER BY e.timestamp DESC
LIMIT 100;

-- -----------------------------------------------------------------------------
-- Pending Tasks View
-- All tasks waiting to be processed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW pending_tasks AS
SELECT
    t.task_id,
    t.session_id,
    s.agent_name,
    t.task_name,
    t.task_type,
    t.priority,
    t.created_at,
    t.dependencies,
    t.metadata
FROM agent_tasks t
JOIN agent_sessions s ON t.session_id = s.session_id
WHERE t.status = 'pending'
ORDER BY t.priority DESC, t.created_at ASC;

-- -----------------------------------------------------------------------------
-- Merge Statistics View
-- Summary of merge operations and success rates
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW merge_statistics AS
SELECT
    DATE(started_at) AS date,
    COUNT(*) AS total_merges,
    AVG(conflict_count) AS avg_conflicts,
    AVG(conflicts_resolved) AS avg_resolved,
    AVG(conflicts_escalated) AS avg_escalated,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) AS successful_merges,
    AVG(duration_ms) AS avg_duration_ms
FROM merge_operations
GROUP BY DATE(started_at)
ORDER BY date DESC;

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Get session hierarchy
-- Returns all sessions in a parent-child hierarchy
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_session_hierarchy(root_session_id UUID)
RETURNS TABLE (
    session_id UUID,
    agent_name VARCHAR(255),
    status session_status,
    depth INTEGER
) AS $$
WITH RECURSIVE session_tree AS (
    -- Base case: root session
    SELECT
        s.session_id,
        s.agent_name,
        s.status,
        0 AS depth
    FROM agent_sessions s
    WHERE s.session_id = root_session_id

    UNION ALL

    -- Recursive case: child sessions
    SELECT
        s.session_id,
        s.agent_name,
        s.status,
        st.depth + 1
    FROM agent_sessions s
    JOIN session_tree st ON s.parent_session_id = st.session_id
)
SELECT * FROM session_tree
ORDER BY depth, session_id;
$$ LANGUAGE SQL;

-- -----------------------------------------------------------------------------
-- Calculate session metrics
-- Aggregates key metrics for a given session
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_session_metrics(p_session_id UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'session_id', p_session_id,
        'total_events', COUNT(DISTINCT e.event_id),
        'total_tasks', COUNT(DISTINCT t.task_id),
        'completed_tasks', COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.task_id END),
        'failed_tasks', COUNT(DISTINCT CASE WHEN t.status = 'failed' THEN t.task_id END),
        'file_operations', COUNT(DISTINCT f.operation_id),
        'files_modified', COUNT(DISTINCT f.file_path),
        'processing_decisions', COUNT(DISTINCT d.decision_id)
    ) INTO result
    FROM agent_sessions s
    LEFT JOIN agent_events e ON s.session_id = e.session_id
    LEFT JOIN agent_tasks t ON s.session_id = t.session_id
    LEFT JOIN file_operations f ON s.session_id = f.session_id
    LEFT JOIN processing_decisions d ON s.session_id = d.session_id
    WHERE s.session_id = p_session_id;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS
-- =============================================================================

COMMENT ON TABLE agent_sessions IS 'Tracks all agent session lifecycles and metadata';
COMMENT ON TABLE agent_events IS 'Logs all events from agent operations';
COMMENT ON TABLE agent_tasks IS 'Tracks tasks assigned to and completed by agents';
COMMENT ON TABLE file_operations IS 'Records all file system operations performed by agents';
COMMENT ON TABLE merge_operations IS 'Tracks merge operations and conflict resolutions';
COMMENT ON TABLE merge_conflicts IS 'Detailed tracking of individual merge conflicts';
COMMENT ON TABLE processing_decisions IS 'Records brain processing decisions and rationale';
COMMENT ON TABLE context_storage IS 'General-purpose context and state storage';
COMMENT ON TABLE system_metrics IS 'System-wide performance and operational metrics';

-- =============================================================================
-- INITIAL DATA
-- =============================================================================

-- Insert initial system metrics record
INSERT INTO system_metrics (metric_name, metric_type, metric_value, metric_data, tags)
VALUES (
    'schema_version',
    'system',
    1.0,
    '{"created_at": "2025-12-16", "description": "Initial schema deployment"}'::jsonb,
    '{"component": "database", "environment": "development"}'::jsonb
);

-- =============================================================================
-- GRANTS (Optional - uncomment and modify as needed)
-- =============================================================================

-- Example grants for application user
-- GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_user;

-- Example grants for read-only user (e.g., for Context Fetcher)
-- GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly_user;
-- GRANT EXECUTE ON FUNCTION get_session_hierarchy TO readonly_user;
-- GRANT EXECUTE ON FUNCTION calculate_session_metrics TO readonly_user;

-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
