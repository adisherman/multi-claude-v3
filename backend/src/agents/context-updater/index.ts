/**
 * Context Updater Agent
 * Database Persistence Specialist for Multi-Claude 3.0
 *
 * Executes write operations to persist event processing results,
 * agent outputs, and system state changes.
 */

import { transaction, query, getClient } from '../../database/index.js';
import type { PoolClient } from 'pg';

/**
 * Persistence request interface
 */
export interface PersistenceRequest {
  requestType: 'persist_event' | 'batch_persist';
  sessionId: string;
  data?: any;
  operations?: PersistenceOperation[];
  options?: {
    validate?: boolean;
    returnRecord?: boolean;
  };
}

/**
 * Persistence operation interface
 */
export interface PersistenceOperation {
  type: 'insert' | 'update';
  table: string;
  data: any;
  where?: any;
}

/**
 * Persistence response interface
 */
export interface PersistenceResponse {
  persistenceId: string;
  timestamp: string;
  status: 'success' | 'partial' | 'failed';
  sessionId: string;
  operationsRequested: number;
  operationsCompleted: number;
  recordsWritten: {
    [table: string]: number;
  };
  recordIds?: {
    [table: string]: string[];
  };
  transactionId?: string;
  durationMs: number;
  errors: any[];
  warnings: string[];
  summary: string;
}

/**
 * Context Updater Agent
 */
export class ContextUpdater {
  /**
   * Persist event data
   */
  async persistEvent(request: PersistenceRequest): Promise<PersistenceResponse> {
    const startTime = Date.now();
    const persistenceId = `persist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log(`[ContextUpdater] Starting persistence ${persistenceId} for session ${request.sessionId}`);

    try {
      if (request.requestType === 'batch_persist' && request.operations) {
        return await this.batchPersist(request, persistenceId, startTime);
      } else {
        return await this.singlePersist(request, persistenceId, startTime);
      }
    } catch (error) {
      console.error(`[ContextUpdater] Persistence failed:`, error);

      return {
        persistenceId,
        timestamp: new Date().toISOString(),
        status: 'failed',
        sessionId: request.sessionId,
        operationsRequested: request.operations?.length || 1,
        operationsCompleted: 0,
        recordsWritten: {},
        durationMs: Date.now() - startTime,
        errors: [
          {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          },
        ],
        warnings: [],
        summary: 'Persistence operation failed',
      };
    }
  }

  /**
   * Persist single event
   */
  private async singlePersist(
    request: PersistenceRequest,
    persistenceId: string,
    startTime: number
  ): Promise<PersistenceResponse> {
    const recordsWritten: { [table: string]: number } = {};
    const recordIds: { [table: string]: string[] } = {};
    const errors: any[] = [];

    try {
      // Insert event
      const eventResult = await query(
        `INSERT INTO agent_events (session_id, event_type, event_category, payload, status)
         VALUES ($1, $2, $3, $4, 'processed')
         RETURNING event_id`,
        [
          request.sessionId,
          request.data.eventType || 'unknown',
          request.data.eventCategory || null,
          JSON.stringify(request.data.payload || {}),
        ]
      );

      recordsWritten['events'] = 1;
      recordIds['events'] = [eventResult.rows[0].event_id];

      return {
        persistenceId,
        timestamp: new Date().toISOString(),
        status: 'success',
        sessionId: request.sessionId,
        operationsRequested: 1,
        operationsCompleted: 1,
        recordsWritten,
        recordIds,
        durationMs: Date.now() - startTime,
        errors,
        warnings: [],
        summary: `Successfully persisted 1 record in ${Date.now() - startTime}ms`,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Batch persist multiple operations in a transaction
   */
  private async batchPersist(
    request: PersistenceRequest,
    persistenceId: string,
    startTime: number
  ): Promise<PersistenceResponse> {
    const operations = request.operations || [];
    let operationsCompleted = 0;
    const recordsWritten: { [table: string]: number } = {};
    const recordIds: { [table: string]: string[] } = {};
    const errors: any[] = [];
    const warnings: string[] = [];

    try {
      await transaction(async (client: PoolClient) => {
        for (const operation of operations) {
          try {
            if (operation.type === 'insert') {
              await this.executeInsert(client, operation, recordsWritten, recordIds);
            } else if (operation.type === 'update') {
              await this.executeUpdate(client, operation, recordsWritten);
            }
            operationsCompleted++;
          } catch (error) {
            errors.push({
              operation,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error; // Rollback transaction
          }
        }
      });

      return {
        persistenceId,
        timestamp: new Date().toISOString(),
        status: errors.length === 0 ? 'success' : 'partial',
        sessionId: request.sessionId,
        operationsRequested: operations.length,
        operationsCompleted,
        recordsWritten,
        recordIds,
        durationMs: Date.now() - startTime,
        errors,
        warnings,
        summary: `Successfully persisted ${operationsCompleted}/${operations.length} operations in ${Date.now() - startTime}ms`,
      };
    } catch (error) {
      console.error('[ContextUpdater] Transaction failed, rolled back');
      throw error;
    }
  }

  /**
   * Execute INSERT operation
   */
  private async executeInsert(
    client: PoolClient,
    operation: PersistenceOperation,
    recordsWritten: { [table: string]: number },
    recordIds: { [table: string]: string[] }
  ): Promise<void> {
    const { table, data } = operation;

    let queryText: string;
    let values: any[];

    // Generate INSERT query based on table
    switch (table) {
      case 'events':
        queryText = `INSERT INTO agent_events (session_id, event_type, event_category, payload, status)
                     VALUES ($1, $2, $3, $4, $5) RETURNING event_id`;
        values = [
          data.sessionId,
          data.eventType,
          data.eventCategory || null,
          JSON.stringify(data.payload || {}),
          data.status || 'pending',
        ];
        break;

      case 'tasks':
        queryText = `INSERT INTO agent_tasks (session_id, task_name, task_type, description, status, priority, metadata)
                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING task_id`;
        values = [
          data.sessionId,
          data.taskName,
          data.taskType || null,
          data.description || null,
          data.status || 'pending',
          data.priority || 5,
          JSON.stringify(data.metadata || {}),
        ];
        break;

      case 'contexts':
        queryText = `INSERT INTO context_storage (session_id, context_key, context_type, context_data)
                     VALUES ($1, $2, $3, $4) RETURNING context_id`;
        values = [
          data.sessionId,
          data.contextKey,
          data.contextType,
          JSON.stringify(data.contextData || {}),
        ];
        break;

      case 'file_operations':
        queryText = `INSERT INTO file_operations (session_id, file_path, operation_type, success, details)
                     VALUES ($1, $2, $3, $4, $5) RETURNING operation_id`;
        values = [
          data.sessionId,
          data.filePath,
          data.operationType,
          data.success !== false,
          JSON.stringify(data.details || {}),
        ];
        break;

      default:
        throw new Error(`Unsupported table for insert: ${table}`);
    }

    const result = await client.query(queryText, values);

    // Update counters
    recordsWritten[table] = (recordsWritten[table] || 0) + 1;
    if (!recordIds[table]) recordIds[table] = [];
    recordIds[table].push(result.rows[0][Object.keys(result.rows[0])[0]]);
  }

  /**
   * Execute UPDATE operation
   */
  private async executeUpdate(
    client: PoolClient,
    operation: PersistenceOperation,
    recordsWritten: { [table: string]: number }
  ): Promise<void> {
    const { table, data, where } = operation;

    let queryText: string;
    let values: any[];

    // Generate UPDATE query based on table
    switch (table) {
      case 'agents':
        queryText = `UPDATE agent_sessions SET status = $1, updated_at = NOW(), metadata = metadata || $2
                     WHERE session_id = $3`;
        values = [data.status, JSON.stringify(data.metadata || {}), where.sessionId];
        break;

      case 'events':
        queryText = `UPDATE agent_events SET status = $1, processed_at = NOW()
                     WHERE event_id = $2`;
        values = [data.status, where.eventId];
        break;

      case 'tasks':
        queryText = `UPDATE agent_tasks SET status = $1, result = $2, updated_at = NOW()
                     WHERE task_id = $3`;
        values = [data.status, JSON.stringify(data.result || {}), where.taskId];
        break;

      default:
        throw new Error(`Unsupported table for update: ${table}`);
    }

    await client.query(queryText, values);

    // Update counters
    recordsWritten[table] = (recordsWritten[table] || 0) + 1;
  }

  /**
   * Update session metadata
   */
  async updateSessionMetadata(
    sessionId: string,
    metadata: any
  ): Promise<any> {
    const result = await query(
      `UPDATE agent_sessions
       SET metadata = metadata || $1, updated_at = NOW()
       WHERE session_id = $2
       RETURNING *`,
      [JSON.stringify(metadata), sessionId]
    );

    return result.rows[0];
  }

  /**
   * Record task completion
   */
  async recordTaskCompletion(
    taskId: string,
    result: any,
    status: 'completed' | 'failed' = 'completed'
  ): Promise<any> {
    const queryResult = await query(
      `UPDATE agent_tasks
       SET status = $1, result = $2, completed_at = NOW(), updated_at = NOW()
       WHERE task_id = $3
       RETURNING *`,
      [status, JSON.stringify(result), taskId]
    );

    return queryResult.rows[0];
  }
}

/**
 * Create and export singleton instance
 */
export const contextUpdater = new ContextUpdater();
