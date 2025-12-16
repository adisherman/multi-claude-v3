/**
 * Processing Decisions Repository
 * Handles database operations for processing_decisions table
 */

import { db } from '../client';
import { v4 as uuidv4 } from 'uuid';

export interface ProcessingDecision {
  decision_id: string;
  event_id?: string | null;
  session_id?: string | null;
  decision_type: 'spawn_agent' | 'merge_changes' | 'escalate_conflict' | 'run_validation' | 'persist_state' | 'user_interaction';
  timestamp: Date;
  context: any;
  rationale?: string | null;
  actions: any[];
  outcomes?: any | null;
  confidence_score?: number | null;
  executed: boolean;
  executed_at?: Date | null;
  metadata?: any;
  created_at: Date;
}

export interface CreateDecisionInput {
  event_id?: string;
  session_id?: string;
  decision_type: ProcessingDecision['decision_type'];
  context: any;
  rationale?: string;
  actions: any[];
  confidence_score?: number;
  metadata?: any;
}

export class DecisionsRepository {
  /**
   * Create a new decision record
   */
  async create(input: CreateDecisionInput): Promise<ProcessingDecision> {
    const query = `
      INSERT INTO processing_decisions (
        decision_id,
        event_id,
        session_id,
        decision_type,
        context,
        rationale,
        actions,
        confidence_score,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const decisionId = uuidv4();
    const values = [
      decisionId,
      input.event_id || null,
      input.session_id || null,
      input.decision_type,
      JSON.stringify(input.context),
      input.rationale || null,
      JSON.stringify(input.actions),
      input.confidence_score || null,
      JSON.stringify(input.metadata || {}),
    ];

    const result = await db.query<ProcessingDecision>(query, values);
    return result.rows[0];
  }

  /**
   * Mark decision as executed
   */
  async markExecuted(
    decisionId: string,
    outcomes: any
  ): Promise<ProcessingDecision> {
    const query = `
      UPDATE processing_decisions
      SET
        executed = true,
        executed_at = NOW(),
        outcomes = $2
      WHERE decision_id = $1
      RETURNING *
    `;

    const result = await db.query<ProcessingDecision>(query, [
      decisionId,
      JSON.stringify(outcomes),
    ]);

    if (!result.rows[0]) {
      throw new Error(`Decision not found: ${decisionId}`);
    }

    return result.rows[0];
  }

  /**
   * Get decision by ID
   */
  async findById(decisionId: string): Promise<ProcessingDecision | null> {
    const query = `
      SELECT * FROM processing_decisions
      WHERE decision_id = $1
    `;

    const result = await db.query<ProcessingDecision>(query, [decisionId]);
    return result.rows[0] || null;
  }

  /**
   * Get decisions by event
   */
  async findByEvent(eventId: string): Promise<ProcessingDecision[]> {
    const query = `
      SELECT * FROM processing_decisions
      WHERE event_id = $1
      ORDER BY timestamp DESC
    `;

    const result = await db.query<ProcessingDecision>(query, [eventId]);
    return result.rows;
  }

  /**
   * Get decisions by session
   */
  async findBySession(
    sessionId: string,
    limit: number = 100
  ): Promise<ProcessingDecision[]> {
    const query = `
      SELECT * FROM processing_decisions
      WHERE session_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;

    const result = await db.query<ProcessingDecision>(query, [sessionId, limit]);
    return result.rows;
  }

  /**
   * Get recent decisions
   */
  async getRecent(limit: number = 50): Promise<ProcessingDecision[]> {
    const query = `
      SELECT * FROM processing_decisions
      ORDER BY timestamp DESC
      LIMIT $1
    `;

    const result = await db.query<ProcessingDecision>(query, [limit]);
    return result.rows;
  }

  /**
   * Get decision statistics
   */
  async getStats(timeWindow: string = '24 hours'): Promise<any> {
    const query = `
      SELECT
        decision_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE executed = true) as executed,
        AVG(confidence_score) as avg_confidence,
        AVG(
          EXTRACT(EPOCH FROM (executed_at - timestamp)) * 1000
        ) FILTER (WHERE executed = true) as avg_execution_time_ms
      FROM processing_decisions
      WHERE timestamp > NOW() - INTERVAL '${timeWindow}'
      GROUP BY decision_type
      ORDER BY total DESC
    `;

    const result = await db.query(query);
    return result.rows;
  }
}
