/**
 * Database Module
 * Central export for all database functionality
 */

import { db as dbInstance } from './client.js';

export { db, DatabaseClient } from './client.js';
export { SessionsRepository } from './repositories/sessions.repository.js';
export { EventsRepository } from './repositories/events.repository.js';
export { DecisionsRepository } from './repositories/decisions.repository.js';

// Export convenience functions for direct use
export const query = dbInstance.query.bind(dbInstance);
export const transaction = dbInstance.transaction.bind(dbInstance);
export const getClient = dbInstance.getClient.bind(dbInstance);

// Export types
export type {
  AgentSession,
  CreateSessionInput,
} from './repositories/sessions.repository.js';

export type {
  AgentEventRecord,
  CreateEventInput,
} from './repositories/events.repository.js';

export type {
  ProcessingDecision,
  CreateDecisionInput,
} from './repositories/decisions.repository.js';
