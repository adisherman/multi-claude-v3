/**
 * Multi-Claude 3.0 - Event Type Definitions
 * Core event structures for the autonomous coding system
 */

export interface AgentEvent {
  event_id: string;
  session_id: string;
  event_type: string;
  event_category?: string;
  timestamp: string;
  payload: Record<string, any>;
  context?: Record<string, any>;
  priority?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

export interface ContextRequest {
  request_type: 'context_fetch';
  session_id: string;
  event_details: {
    event_type: string;
    timestamp: string;
    payload: Record<string, any>;
  };
  investigation_scope: string[];
}

export interface IntelligenceReport {
  investigation_id: string;
  timestamp: string;
  session_id: string;
  query_count: number;
  findings: {
    session_info?: any;
    recent_events?: any[];
    agent_status?: any;
    related_context?: any;
    patterns_identified?: any[];
    concurrent_sessions?: number;
    potential_conflicts?: number;
    session_ids?: string[];
  };
  summary: string;
  recommendations?: string[];
  confidence?: 'high' | 'medium' | 'low';
  errors?: any[];
}

export type DecisionType =
  | 'spawn_agent'
  | 'merge_changes'
  | 'escalate_conflict'
  | 'run_validation'
  | 'persist_state'
  | 'user_interaction'
  | 'no_action';

export interface Action {
  type: string;
  [key: string]: any;
}

export interface SpawnAgentAction extends Action {
  type: 'spawn_agent';
  agent_type: string;
  configuration: Record<string, any>;
  priority: number;
  timeout_ms: number;
}

export interface MergeAction extends Action {
  type: 'merge';
  session_ids: string[];
  merge_strategy: string;
  conflict_policy: string;
}

export interface PersistStateAction extends Action {
  type: 'persist_state';
  data: Record<string, any>;
}

export interface NotificationAction extends Action {
  type: 'notification';
  channel: string;
  urgency: 'low' | 'medium' | 'high';
  message: string;
}

export interface ValidationAction extends Action {
  type: 'validation';
  validation_type: string;
  targets: string[];
}

export interface RollbackPlan {
  steps: Array<{
    action: string;
    params: Record<string, any>;
  }>;
}

export interface Decision {
  decision_id: string;
  decision_type: DecisionType;
  actions: Action[];
  rationale: string;
  confidence_score: number;
  dependencies?: string[];
  rollback_plan?: RollbackPlan;
  metadata?: Record<string, any>;
}

export interface DecisionContext {
  event: AgentEvent;
  context: IntelligenceReport;
  session_state: SessionState;
  system_state: SystemState;
  policies: BusinessRules;
}

export interface SessionState {
  session_id: string;
  agent_name: string;
  status: string;
  started_at: string;
  metadata: Record<string, any>;
}

export interface SystemState {
  active_sessions: number;
  queue_depth: number;
  system_load: number;
  available_resources: Record<string, number>;
}

export interface BusinessRules {
  max_concurrent_agents: number;
  auto_execute_threshold: number;
  escalate_threshold: number;
  default_timeout_ms: number;
}

export interface ActionOutcome {
  action: Action;
  status: 'success' | 'failed' | 'partial';
  result?: any;
  error?: string;
  duration_ms: number;
}

export interface ProcessingMetrics {
  event_id: string;
  processing_start: string;
  processing_end: string;
  duration_ms: number;
  context_fetch_ms: number;
  decision_ms: number;
  action_execution_ms: number;
  persistence_ms: number;
}

export interface PersistenceRequest {
  event_data: AgentEvent;
  processing_results: Decision;
  action_outcomes: ActionOutcome[];
  metrics: ProcessingMetrics;
}

export interface PersistenceConfirmation {
  update_id: string;
  timestamp: string;
  operations: Array<{
    operation: string;
    table: string;
    record_id: string;
    success: boolean;
  }>;
  summary: {
    total_operations: number;
    successful: number;
    failed: number;
  };
}

export interface AgentSpawnRequest {
  agent_type: string;
  parent_session_id: string;
  configuration: Record<string, any>;
  priority: number;
  timeout_ms: number;
  callback_url?: string;
}

export interface AgentSpawnResponse {
  session_id: string;
  agent_name: string;
  status: 'spawned' | 'queued' | 'failed';
  estimated_start?: string;
  error?: string;
}

export interface MergeRequest {
  merge_id: string;
  session_ids: string[];
  merge_strategy: string;
  conflict_policy: string;
  initiated_by: string;
}

export interface MergeReport {
  merge_id: string;
  timestamp: string;
  status: 'success' | 'partial' | 'failed';
  conflicts_detected: number;
  conflicts_resolved: number;
  conflicts_escalated: number;
  merged_files: string[];
  validation_results: Record<string, any>;
  escalated_conflicts?: Array<{
    file: string;
    line: number;
    description: string;
  }>;
}

export interface BrainLog {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  event_id?: string;
  session_id?: string;
  message: string;
  metadata?: Record<string, any>;
  trace_id?: string;
}

export interface ComponentHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  last_check: string;
  details?: Record<string, any>;
}

export interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: ComponentHealth[];
  metrics: {
    uptime_seconds: number;
    events_processed: number;
    queue_depth: number;
    active_sessions: number;
  };
}
