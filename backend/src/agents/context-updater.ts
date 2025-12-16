/**
 * Multi-Claude 3.0 - Context Updater Agent
 * Database Persistence Specialist
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentEvent,
  Decision,
  ActionOutcome,
  ProcessingMetrics,
  PersistenceRequest,
  PersistenceConfirmation,
} from '../types/events.js';

export class ContextUpdater {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 30000,
    });
  }

  /**
   * Connect to database
   */
  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      this.isConnected = true;
      console.log('✓ Context Updater connected to database');
    } catch (error: any) {
      console.error('Failed to connect Context Updater to database:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from database
   */
  async disconnect(): Promise<void> {
    await this.pool.end();
    this.isConnected = false;
    console.log('✓ Context Updater disconnected from database');
  }

  /**
   * Check if connected
   */
  isHealthy(): boolean {
    return this.isConnected;
  }

  /**
   * Persist event processing results
   */
  async persistProcessingResults(
    request: PersistenceRequest
  ): Promise<PersistenceConfirmation> {
    const client = await this.pool.connect();
    const operations: PersistenceConfirmation['operations'] = [];

    try {
      await client.query('BEGIN');

      // 1. Upsert agent session
      const sessionOp = await this.upsertSession(client, request.event_data);
      operations.push(sessionOp);

      // 2. Insert agent event
      const eventOp = await this.insertEvent(client, request.event_data);
      operations.push(eventOp);

      // 3. Insert processing decision
      const decisionOp = await this.insertDecision(
        client,
        request.event_data,
        request.processing_results
      );
      operations.push(decisionOp);

      // 4. Update metrics
      const metricsOp = await this.updateMetrics(
        client,
        request.event_data,
        request.metrics
      );
      operations.push(metricsOp);

      await client.query('COMMIT');

      return {
        update_id: uuidv4(),
        timestamp: new Date().toISOString(),
        operations,
        summary: {
          total_operations: operations.length,
          successful: operations.filter((op) => op.success).length,
          failed: operations.filter((op) => !op.success).length,
        },
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Failed to persist processing results:', error.message);

      return {
        update_id: uuidv4(),
        timestamp: new Date().toISOString(),
        operations: operations.concat([
          {
            operation: 'transaction',
            table: 'all',
            record_id: 'rollback',
            success: false,
          },
        ]),
        summary: {
          total_operations: operations.length + 1,
          successful: operations.filter((op) => op.success).length,
          failed: operations.filter((op) => !op.success).length + 1,
        },
      };
    } finally {
      client.release();
    }
  }

  /**
   * Upsert agent session
   */
  private async upsertSession(client: any, event: AgentEvent) {
    try {
      // Validate required fields
      if (!event || !event.session_id) {
        throw new Error('Invalid event: missing session_id');
      }

      if (!event.payload) {
        throw new Error('Invalid event: missing payload');
      }

      const result = await client.query(
        `
        INSERT INTO agent_sessions (session_id, agent_name, agent_type, status, started_at, metadata)
        VALUES ($1, $2, $3, 'active', $4, $5::jsonb)
        ON CONFLICT (session_id)
        DO UPDATE SET
          metadata = agent_sessions.metadata || EXCLUDED.metadata,
          updated_at = NOW()
        RETURNING session_id
        `,
        [
          event.session_id,
          event.payload?.agent_name || 'Unknown',
          event.event_type?.includes('agent') ? 'system' : 'task',
          event.timestamp || new Date().toISOString(),
          JSON.stringify(event.payload?.metadata || {}),
        ]
      );

      return {
        operation: 'upsert',
        table: 'agent_sessions',
        record_id: result.rows[0]?.session_id || event.session_id,
        success: true,
      };
    } catch (error: any) {
      console.error('Failed to upsert session:', error.message);
      return {
        operation: 'upsert',
        table: 'agent_sessions',
        record_id: event?.session_id || 'unknown',
        success: false,
      };
    }
  }

  /**
   * Insert agent event
   */
  private async insertEvent(client: any, event: AgentEvent) {
    try {
      // Validate required fields
      if (!event || !event.event_id || !event.session_id || !event.event_type) {
        throw new Error('Invalid event: missing required fields (event_id, session_id, or event_type)');
      }

      const result = await client.query(
        `
        INSERT INTO agent_events (
          event_id, session_id, event_type, event_category,
          timestamp, status, payload, context
        )
        VALUES ($1, $2, $3, $4, $5, 'processed', $6::jsonb, $7::jsonb)
        RETURNING event_id
        `,
        [
          event.event_id,
          event.session_id,
          event.event_type,
          event.event_category || 'general',
          event.timestamp || new Date().toISOString(),
          JSON.stringify(event.payload || {}),
          JSON.stringify(event.context || {}),
        ]
      );

      return {
        operation: 'insert',
        table: 'agent_events',
        record_id: result.rows[0]?.event_id || event.event_id,
        success: true,
      };
    } catch (error: any) {
      console.error('Failed to insert event:', error.message);
      return {
        operation: 'insert',
        table: 'agent_events',
        record_id: event?.event_id || 'unknown',
        success: false,
      };
    }
  }

  /**
   * Insert processing decision
   */
  private async insertDecision(
    client: any,
    event: AgentEvent,
    decision: Decision
  ) {
    try {
      // Validate required fields
      if (!decision || !decision.decision_id || !decision.decision_type) {
        throw new Error('Invalid decision: missing required fields (decision_id or decision_type)');
      }

      if (!event || !event.event_id || !event.session_id) {
        throw new Error('Invalid event: missing required fields (event_id or session_id)');
      }

      const result = await client.query(
        `
        INSERT INTO processing_decisions (
          decision_id, event_id, session_id, decision_type,
          timestamp, context, rationale, actions, confidence_score, executed
        )
        VALUES ($1, $2, $3, $4, $5, '{}'::jsonb, $6, $7::jsonb, $8, true)
        RETURNING decision_id
        `,
        [
          decision.decision_id,
          event.event_id,
          event.session_id,
          decision.decision_type,
          new Date().toISOString(),
          decision.rationale || '',
          JSON.stringify(decision.actions || []),
          decision.confidence_score || 0,
        ]
      );

      return {
        operation: 'insert',
        table: 'processing_decisions',
        record_id: result.rows[0]?.decision_id || decision.decision_id,
        success: true,
      };
    } catch (error: any) {
      console.error('Failed to insert decision:', error.message);
      return {
        operation: 'insert',
        table: 'processing_decisions',
        record_id: decision?.decision_id || 'unknown',
        success: false,
      };
    }
  }

  /**
   * Update system metrics
   */
  private async updateMetrics(
    client: any,
    event: AgentEvent,
    metrics: ProcessingMetrics
  ) {
    try {
      // Validate required fields
      if (!event || !event.event_id || !event.session_id) {
        throw new Error('Invalid event: missing required fields (event_id or session_id)');
      }

      if (!metrics || metrics.duration_ms === undefined) {
        throw new Error('Invalid metrics: missing duration_ms');
      }

      const result = await client.query(
        `
        INSERT INTO system_metrics (
          metric_name, metric_type, metric_value, metric_data, session_id, tags
        )
        VALUES ('event_processed', 'processing', $1, $2::jsonb, $3, $4::jsonb)
        RETURNING metric_id
        `,
        [
          metrics.duration_ms,
          JSON.stringify({
            event_id: event.event_id,
            event_type: event.event_type || 'unknown',
            processing_start: metrics.processing_start || new Date().toISOString(),
            processing_end: metrics.processing_end || new Date().toISOString(),
            context_fetch_ms: metrics.context_fetch_ms || 0,
            decision_ms: metrics.decision_ms || 0,
            action_execution_ms: metrics.action_execution_ms || 0,
          }),
          event.session_id,
          JSON.stringify({
            event_type: event.event_type || 'unknown',
          }),
        ]
      );

      return {
        operation: 'insert',
        table: 'system_metrics',
        record_id: result.rows[0]?.metric_id || 'unknown',
        success: true,
      };
    } catch (error: any) {
      console.error('Failed to update metrics:', error.message);
      return {
        operation: 'insert',
        table: 'system_metrics',
        record_id: 'unknown',
        success: false,
      };
    }
  }

  /**
   * Record agent completion
   */
  async recordAgentCompletion(
    sessionId: string,
    status: 'completed' | 'failed',
    result?: any
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query(
        `
        UPDATE agent_sessions
        SET status = $1, completed_at = NOW(), metadata = metadata || $2::jsonb
        WHERE session_id = $3
        `,
        [status, JSON.stringify({ result }), sessionId]
      );

      return true;
    } catch (error: any) {
      console.error('Failed to record agent completion:', error.message);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Record task
   */
  async recordTask(
    sessionId: string,
    taskName: string,
    status: string,
    result?: any
  ): Promise<string> {
    const client = await this.pool.connect();
    const taskId = uuidv4();

    try {
      await client.query(
        `
        INSERT INTO agent_tasks (
          task_id, session_id, task_name, status, created_at, result, metadata
        )
        VALUES ($1, $2, $3, $4, NOW(), $5::jsonb, '{}'::jsonb)
        `,
        [taskId, sessionId, taskName, status, JSON.stringify(result || {})]
      );

      return taskId;
    } catch (error: any) {
      console.error('Failed to record task:', error.message);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Record file operation
   */
  async recordFileOperation(
    sessionId: string,
    filePath: string,
    operationType: string,
    details?: any
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(
        `
        INSERT INTO file_operations (
          operation_id, session_id, file_path, operation_type, timestamp, details
        )
        VALUES ($1, $2, $3, $4, NOW(), $5::jsonb)
        `,
        [
          uuidv4(),
          sessionId,
          filePath,
          operationType,
          JSON.stringify(details || {}),
        ]
      );
    } catch (error: any) {
      console.error('Failed to record file operation:', error.message);
    } finally {
      client.release();
    }
  }

  /**
   * Get session stats
   */
  async getSessionStats(sessionId: string): Promise<any> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(
        `
        SELECT
          (SELECT COUNT(*) FROM agent_events WHERE session_id = $1) as event_count,
          (SELECT COUNT(*) FROM agent_tasks WHERE session_id = $1) as task_count,
          (SELECT COUNT(*) FROM file_operations WHERE session_id = $1) as file_op_count,
          (SELECT COUNT(*) FROM processing_decisions WHERE session_id = $1) as decision_count
        `,
        [sessionId]
      );

      return result.rows[0];
    } catch (error: any) {
      console.error('Failed to get session stats:', error.message);
      return null;
    } finally {
      client.release();
    }
  }
}
