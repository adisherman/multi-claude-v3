/**
 * Database Module
 * Central export for all database functionality
 */

export { db, DatabaseClient } from './client';
export { SessionsRepository } from './repositories/sessions.repository';
export { EventsRepository } from './repositories/events.repository';
export { DecisionsRepository } from './repositories/decisions.repository';

// Export types
export type {
  AgentSession,
  CreateSessionInput,
} from './repositories/sessions.repository';

export type {
  AgentEventRecord,
  CreateEventInput,
} from './repositories/events.repository';

export type {
  ProcessingDecision,
  CreateDecisionInput,
} from './repositories/decisions.repository';
