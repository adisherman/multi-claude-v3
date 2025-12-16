/**
 * Multi-Claude 3.0 - Context Coordinator
 * Coordinates context gathering from Context Fetcher agent
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AgentEvent,
  ContextRequest,
  IntelligenceReport,
} from '../types/events';
import { BrainConfig } from '../types/config';

export class ContextCoordinator {
  private config: BrainConfig['contextFetcher'];
  private cache: Map<string, { report: IntelligenceReport; timestamp: number }>;

  constructor(config: BrainConfig['contextFetcher']) {
    this.config = config;
    this.cache = new Map();
  }

  /**
   * Gather context for an event
   */
  async gatherContext(event: AgentEvent): Promise<IntelligenceReport> {
    // Check cache first
    const cached = this.getFromCache(event.session_id);
    if (cached) {
      return cached;
    }

    // Build context request
    const contextRequest = this.buildContextRequest(event);

    // Fetch context
    const report = await this.fetchContext(contextRequest);

    // Cache the report
    this.cacheReport(event.session_id, report);

    return report;
  }

  /**
   * Build context request from event
   */
  private buildContextRequest(event: AgentEvent): ContextRequest {
    // Determine investigation scope based on event type
    const scope = this.determineInvestigationScope(event);

    return {
      request_type: 'context_fetch',
      session_id: event.session_id,
      event_details: {
        event_type: event.event_type,
        timestamp: event.timestamp,
        payload: event.payload,
      },
      investigation_scope: scope,
    };
  }

  /**
   * Determine investigation scope based on event type
   */
  private determineInvestigationScope(event: AgentEvent): string[] {
    const scopes: string[] = ['session', 'events'];

    switch (event.event_type) {
      case 'agent_started':
      case 'agent_completed':
        scopes.push('tasks', 'files');
        break;

      case 'task_failed':
        scopes.push('tasks', 'related_sessions');
        break;

      case 'file_modified':
        scopes.push('files', 'related_sessions');
        break;

      case 'merge_conflict':
        scopes.push('files', 'related_sessions', 'merge_history');
        break;

      case 'validation_failed':
        scopes.push('files', 'tasks');
        break;

      default:
        // Include basic scopes for unknown event types
        break;
    }

    return scopes;
  }

  /**
   * Fetch context from Context Fetcher agent
   * In real implementation, this would communicate with the actual agent
   */
  private async fetchContext(
    request: ContextRequest
  ): Promise<IntelligenceReport> {
    // TODO: Replace with actual Context Fetcher agent communication
    // For now, return a mock intelligence report

    return new Promise((resolve) => {
      setTimeout(() => {
        const report: IntelligenceReport = {
          investigation_id: uuidv4(),
          timestamp: new Date().toISOString(),
          session_id: request.session_id,
          query_count: request.investigation_scope.length,
          findings: {
            session_info: {
              session_id: request.session_id,
              status: 'active',
            },
            recent_events: [],
            patterns_identified: [],
            concurrent_sessions: 1,
            potential_conflicts: 0,
          },
          summary: 'Context gathered successfully',
          confidence: 'high',
        };
        resolve(report);
      }, 100); // Simulate network delay
    });
  }

  /**
   * Get cached report if valid
   */
  private getFromCache(sessionId: string): IntelligenceReport | null {
    const cached = this.cache.get(sessionId);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.config.cacheTtlMs) {
      this.cache.delete(sessionId);
      return null;
    }

    return cached.report;
  }

  /**
   * Cache intelligence report
   */
  private cacheReport(sessionId: string, report: IntelligenceReport): void {
    this.cache.set(sessionId, {
      report,
      timestamp: Date.now(),
    });

    // Cleanup old cache entries
    this.cleanupCache();
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    this.cache.forEach((value, key) => {
      if (now - value.timestamp > this.config.cacheTtlMs) {
        toDelete.push(key);
      }
    });

    toDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      entries: this.cache.size,
      ttl_ms: this.config.cacheTtlMs,
    };
  }
}
