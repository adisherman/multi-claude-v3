/**
 * Agent Events Repository
 * Handles database operations for agent_events table
 */

import { db } from '../client';
import { v4 as uuidv4 } from 'uuid';

export interface AgentEventRecord {
  event_id: string;
  session_id: string;
  event_type: string;
  event_category?: string;
  timestamp: Date;
  status: 'pending' | 'processing' | 'processed' | 'failed' | 'skipped';
  payload: any;
  context?: any;
  processed_at?: Date | null;
  processing_duration_ms?: number | null;
  error_message?: string | null;
  created_at: Date;
}

export interface CreateEventInput {
  session_id: string;
  event_type: string;
  event_category?: string;
  payload: any;
  context?: any;
}

export class EventsRepository {
  /**
   * Create a new event
   */
  async create(input: CreateEventInput): Promise<AgentEventRecord> {
    const query = `
      INSERT INTO agent_events (
        event_id,
        session_id,
        event_type,
        event_category,
        payload,
        context,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const eventId = uuidv4();
    const values = [
      eventId,
      input.session_id,
      input.event_type,
      input.event_category || null,
      JSON.stringify(input.payload),
      JSON.stringify(input.context || {}),
      'pending',
    ];

    const result = await db.query<AgentEventRecord>(query, values);

    if (!result.rows[0]) {
      throw new Error('Failed to create event');
    }

    return result.rows[0];
  }

  /**
   * Get event by ID
   */
  async findById(eventId: string): Promise<AgentEventRecord | null> {
    const query = `
      SELECT * FROM agent_events
      WHERE event_id = $1
    `;

    const result = await db.query<AgentEventRecord>(query, [eventId]);
    return result.rows[0] || null;
  }

  /**
   * Update event status
   */
  async updateStatus(
    eventId: string,
    status: AgentEventRecord['status'],
    errorMessage?: string
  ): Promise<AgentEventRecord> {
    const query = `
      UPDATE agent_events
      SET
        status = $2,
        processed_at = CASE WHEN $2 = 'processed' THEN NOW() ELSE processed_at END,
        processing_duration_ms = CASE
          WHEN $2 = 'processed' THEN EXTRACT(EPOCH FROM (NOW() - timestamp)) * 1000
          ELSE processing_duration_ms
        END,
        error_message = $3
      WHERE event_id = $1
      RETURNING *
    `;

    const result = await db.query<AgentEventRecord>(query, [
      eventId,
      status,
      errorMessage || null,
    ]);

    if (!result.rows[0]) {
      throw new Error(`Event not found: ${eventId}`);
    }

    return result.rows[0];
  }

  /**
   * Get events by session
   */
  async findBySession(
    sessionId: string,
    limit: number = 100
  ): Promise<AgentEventRecord[]> {
    const query = `
      SELECT * FROM agent_events
      WHERE session_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;

    const result = await db.query<AgentEventRecord>(query, [sessionId, limit]);
    return result.rows;
  }

  /**
   * Get recent events
   */
  async getRecent(limit: number = 100): Promise<any[]> {
    const query = `
      SELECT * FROM recent_events
      LIMIT $1
    `;

    const result = await db.query(query, [limit]);
    return result.rows;
  }

  /**
   * Get events by type
   */
  async findByType(
    eventType: string,
    limit: number = 50
  ): Promise<AgentEventRecord[]> {
    const query = `
      SELECT * FROM agent_events
      WHERE event_type = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;

    const result = await db.query<AgentEventRecord>(query, [eventType, limit]);
    return result.rows;
  }

  /**
   * Get pending events
   */
  async getPending(limit: number = 50): Promise<AgentEventRecord[]> {
    const query = `
      SELECT * FROM agent_events
      WHERE status = 'pending'
      ORDER BY timestamp ASC
      LIMIT $1
    `;

    const result = await db.query<AgentEventRecord>(query, [limit]);
    return result.rows;
  }

  /**
   * Get event statistics
   */
  async getStats(timeWindow: string = '24 hours'): Promise<any> {
    const query = `
      SELECT
        event_type,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'processed') as processed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        AVG(processing_duration_ms) as avg_duration_ms
      FROM agent_events
      WHERE timestamp > NOW() - INTERVAL '${timeWindow}'
      GROUP BY event_type
      ORDER BY total DESC
    `;

    const result = await db.query(query);
    return result.rows;
  }
}
