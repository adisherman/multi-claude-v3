/**
 * Agent Sessions Repository
 * Handles database operations for agent_sessions table
 */

import { db } from '../client';
import { v4 as uuidv4 } from 'uuid';

export interface AgentSession {
  session_id: string;
  agent_name: string;
  agent_type: string;
  parent_session_id?: string | null;
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'failed' | 'cancelled';
  started_at: Date;
  completed_at?: Date | null;
  duration_ms?: number | null;
  metadata?: any;
  configuration?: any;
  error_details?: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSessionInput {
  agent_name: string;
  agent_type: string;
  parent_session_id?: string;
  metadata?: any;
  configuration?: any;
}

export class SessionsRepository {
  /**
   * Create a new agent session
   */
  async create(input: CreateSessionInput): Promise<AgentSession> {
    const query = `
      INSERT INTO agent_sessions (
        session_id,
        agent_name,
        agent_type,
        parent_session_id,
        status,
        metadata,
        configuration
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const sessionId = uuidv4();
    const values = [
      sessionId,
      input.agent_name,
      input.agent_type,
      input.parent_session_id || null,
      'initializing',
      JSON.stringify(input.metadata || {}),
      JSON.stringify(input.configuration || {}),
    ];

    const result = await db.query<AgentSession>(query, values);
    return result.rows[0];
  }

  /**
   * Get session by ID
   */
  async findById(sessionId: string): Promise<AgentSession | null> {
    const query = `
      SELECT * FROM agent_sessions
      WHERE session_id = $1
    `;

    const result = await db.query<AgentSession>(query, [sessionId]);
    return result.rows[0] || null;
  }

  /**
   * Update session status
   */
  async updateStatus(
    sessionId: string,
    status: AgentSession['status'],
    errorDetails?: any
  ): Promise<AgentSession> {
    const query = `
      UPDATE agent_sessions
      SET
        status = $2,
        error_details = $3,
        updated_at = NOW()
      WHERE session_id = $1
      RETURNING *
    `;

    const result = await db.query<AgentSession>(query, [
      sessionId,
      status,
      errorDetails ? JSON.stringify(errorDetails) : null,
    ]);

    if (!result.rows[0]) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return result.rows[0];
  }

  /**
   * Update session metadata
   */
  async updateMetadata(
    sessionId: string,
    metadata: any
  ): Promise<AgentSession> {
    const query = `
      UPDATE agent_sessions
      SET
        metadata = metadata || $2::jsonb,
        updated_at = NOW()
      WHERE session_id = $1
      RETURNING *
    `;

    const result = await db.query<AgentSession>(query, [
      sessionId,
      JSON.stringify(metadata),
    ]);

    if (!result.rows[0]) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return result.rows[0];
  }

  /**
   * Get all active sessions
   */
  async getActiveSessions(): Promise<AgentSession[]> {
    const query = `
      SELECT * FROM active_sessions
      ORDER BY started_at DESC
    `;

    const result = await db.query<AgentSession>(query);
    return result.rows;
  }

  /**
   * Get session hierarchy
   */
  async getHierarchy(rootSessionId: string): Promise<any[]> {
    const query = `
      SELECT * FROM get_session_hierarchy($1)
    `;

    const result = await db.query(query, [rootSessionId]);
    return result.rows;
  }

  /**
   * Get session metrics
   */
  async getMetrics(sessionId: string): Promise<any> {
    const query = `
      SELECT calculate_session_metrics($1) as metrics
    `;

    const result = await db.query(query, [sessionId]);
    return result.rows[0]?.metrics || null;
  }

  /**
   * Get session summary
   */
  async getSummary(sessionId: string): Promise<any> {
    const query = `
      SELECT * FROM session_summary
      WHERE session_id = $1
    `;

    const result = await db.query(query, [sessionId]);
    return result.rows[0] || null;
  }
}
