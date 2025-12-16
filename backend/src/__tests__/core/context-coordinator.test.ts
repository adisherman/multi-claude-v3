/**
 * ContextCoordinator Unit Tests
 * Tests context gathering, caching, and scope determination
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ContextCoordinator } from '../../core/context-coordinator.js';
import { AgentEvent } from '../../types/events.js';
import { BrainConfig } from '../../types/config.js';

describe('ContextCoordinator', () => {
  let coordinator: ContextCoordinator;
  let mockConfig: BrainConfig['contextFetcher'];
  let mockEvent: AgentEvent;

  beforeEach(() => {
    mockConfig = {
      enabled: true,
      cacheTtlMs: 5000, // 5 seconds for testing
    };

    mockEvent = {
      event_id: '550e8400-e29b-41d4-a716-446655440001',
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      event_type: 'test_event',
      agent_name: 'TestAgent',
      payload: { test: 'data' },
      timestamp: new Date().toISOString(),
      status: 'queued',
    };

    coordinator = new ContextCoordinator(mockConfig);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with config', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator.getCacheStats().entries).toBe(0);
      expect(coordinator.getCacheStats().ttl_ms).toBe(5000);
    });

    it('should start with empty cache', () => {
      const stats = coordinator.getCacheStats();
      expect(stats.entries).toBe(0);
    });
  });

  describe('Context Gathering', () => {
    it('should gather context for an event', async () => {
      const report = await coordinator.gatherContext(mockEvent);

      expect(report).toBeDefined();
      expect(report.investigation_id).toBeDefined();
      expect(report.session_id).toBe(mockEvent.session_id);
      expect(report.timestamp).toBeDefined();
      expect(report.query_count).toBeGreaterThan(0);
      expect(report.findings).toBeDefined();
      expect(report.summary).toBe('Context gathered successfully');
      expect(report.confidence).toBe('high');
    });

    it('should include session info in findings', async () => {
      const report = await coordinator.gatherContext(mockEvent);

      expect(report.findings.session_info).toBeDefined();
      expect(report.findings.session_info.session_id).toBe(mockEvent.session_id);
      expect(report.findings.session_info.status).toBe('active');
    });

    it('should include all required finding fields', async () => {
      const report = await coordinator.gatherContext(mockEvent);

      expect(report.findings).toHaveProperty('session_info');
      expect(report.findings).toHaveProperty('recent_events');
      expect(report.findings).toHaveProperty('patterns_identified');
      expect(report.findings).toHaveProperty('concurrent_sessions');
      expect(report.findings).toHaveProperty('potential_conflicts');
    });
  });

  describe('Caching', () => {
    it('should cache intelligence reports', async () => {
      const initialStats = coordinator.getCacheStats();
      expect(initialStats.entries).toBe(0);

      await coordinator.gatherContext(mockEvent);

      const afterStats = coordinator.getCacheStats();
      expect(afterStats.entries).toBe(1);
    });

    it('should return cached report on subsequent calls', async () => {
      const report1 = await coordinator.gatherContext(mockEvent);
      const report2 = await coordinator.gatherContext(mockEvent);

      // Should be the same cached report
      expect(report2.investigation_id).toBe(report1.investigation_id);
      expect(report2.timestamp).toBe(report1.timestamp);
    });

    it('should not fetch context again if cached', async () => {
      const report1 = await coordinator.gatherContext(mockEvent);

      // Get it again immediately - should be from cache
      const startTime = Date.now();
      const report2 = await coordinator.gatherContext(mockEvent);
      const duration = Date.now() - startTime;

      // Cache hit should be instant (< 10ms), fetch would be ~100ms
      expect(duration).toBeLessThan(10);
      expect(report2.investigation_id).toBe(report1.investigation_id);
    });

    it('should cache different sessions separately', async () => {
      const event1 = { ...mockEvent, session_id: 'session-1' };
      const event2 = { ...mockEvent, session_id: 'session-2' };

      await coordinator.gatherContext(event1);
      await coordinator.gatherContext(event2);

      const stats = coordinator.getCacheStats();
      expect(stats.entries).toBe(2);
    });

    it('should respect cache TTL', async () => {
      // Use a very short TTL
      const shortTtlCoordinator = new ContextCoordinator({
        enabled: true,
        cacheTtlMs: 100, // 100ms
      });

      const report1 = await shortTtlCoordinator.gatherContext(mockEvent);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 150));

      const report2 = await shortTtlCoordinator.gatherContext(mockEvent);

      // Should be different reports since cache expired
      expect(report2.investigation_id).not.toBe(report1.investigation_id);
    });

    it('should clear cache', async () => {
      await coordinator.gatherContext(mockEvent);

      const beforeClear = coordinator.getCacheStats();
      expect(beforeClear.entries).toBe(1);

      coordinator.clearCache();

      const afterClear = coordinator.getCacheStats();
      expect(afterClear.entries).toBe(0);
    });

    it('should cleanup expired cache entries automatically', async () => {
      const shortTtlCoordinator = new ContextCoordinator({
        enabled: true,
        cacheTtlMs: 200,
      });

      // Add multiple cache entries
      await shortTtlCoordinator.gatherContext({ ...mockEvent, session_id: 'session-1' });
      await shortTtlCoordinator.gatherContext({ ...mockEvent, session_id: 'session-2' });
      await shortTtlCoordinator.gatherContext({ ...mockEvent, session_id: 'session-3' });

      const initialStats = shortTtlCoordinator.getCacheStats();
      expect(initialStats.entries).toBeGreaterThanOrEqual(1);

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Trigger cleanup by adding a new entry
      await shortTtlCoordinator.gatherContext({ ...mockEvent, session_id: 'session-4' });

      // Old entries should be cleaned up, only new entry should remain
      const stats = shortTtlCoordinator.getCacheStats();
      expect(stats.entries).toBeLessThanOrEqual(initialStats.entries);
    });
  });

  describe('Investigation Scope Determination', () => {
    it('should include base scopes for all events', async () => {
      const report = await coordinator.gatherContext(mockEvent);

      // Base scopes: session, events
      expect(report.query_count).toBeGreaterThanOrEqual(2);
    });

    it('should include tasks and files for agent_started', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'agent_started',
      };

      const report = await coordinator.gatherContext(event);

      // Base (2) + tasks + files = 4
      expect(report.query_count).toBe(4);
    });

    it('should include tasks and files for agent_completed', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'agent_completed',
      };

      const report = await coordinator.gatherContext(event);

      // Base (2) + tasks + files = 4
      expect(report.query_count).toBe(4);
    });

    it('should include tasks and related_sessions for task_failed', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'task_failed',
      };

      const report = await coordinator.gatherContext(event);

      // Base (2) + tasks + related_sessions = 4
      expect(report.query_count).toBe(4);
    });

    it('should include files and related_sessions for file_modified', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'file_modified',
      };

      const report = await coordinator.gatherContext(event);

      // Base (2) + files + related_sessions = 4
      expect(report.query_count).toBe(4);
    });

    it('should include files, related_sessions, and merge_history for merge_conflict', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'merge_conflict',
      };

      const report = await coordinator.gatherContext(event);

      // Base (2) + files + related_sessions + merge_history = 5
      expect(report.query_count).toBe(5);
    });

    it('should include files and tasks for validation_failed', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'validation_failed',
      };

      const report = await coordinator.gatherContext(event);

      // Base (2) + files + tasks = 4
      expect(report.query_count).toBe(4);
    });

    it('should use base scopes for unknown event types', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'unknown_event_type',
      };

      const report = await coordinator.gatherContext(event);

      // Only base scopes: session + events = 2
      expect(report.query_count).toBe(2);
    });
  });

  describe('Context Request Building', () => {
    it('should build context request with event details', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'agent_started',
        payload: { task: 'build_project' },
      };

      const report = await coordinator.gatherContext(event);

      expect(report.session_id).toBe(event.session_id);
      expect(report.timestamp).toBeDefined();
    });

    it('should include appropriate scope for complex events', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'merge_conflict',
        payload: {
          conflicting_files: ['file1.ts', 'file2.ts'],
        },
      };

      const report = await coordinator.gatherContext(event);

      // merge_conflict should have extensive scope (5 items)
      expect(report.query_count).toBe(5);
    });
  });

  describe('Cache Statistics', () => {
    it('should return accurate cache statistics', async () => {
      const stats1 = coordinator.getCacheStats();
      expect(stats1.entries).toBe(0);
      expect(stats1.ttl_ms).toBe(5000);

      await coordinator.gatherContext({ ...mockEvent, session_id: 'session-1' });
      await coordinator.gatherContext({ ...mockEvent, session_id: 'session-2' });

      const stats2 = coordinator.getCacheStats();
      expect(stats2.entries).toBe(2);
      expect(stats2.ttl_ms).toBe(5000);
    });

    it('should update entry count after clearing', async () => {
      await coordinator.gatherContext(mockEvent);
      expect(coordinator.getCacheStats().entries).toBe(1);

      coordinator.clearCache();
      expect(coordinator.getCacheStats().entries).toBe(0);
    });
  });

  describe('Concurrent Context Gathering', () => {
    it('should handle multiple concurrent requests for same session', async () => {
      const promises = [
        coordinator.gatherContext(mockEvent),
        coordinator.gatherContext(mockEvent),
        coordinator.gatherContext(mockEvent),
      ];

      const reports = await Promise.all(promises);

      // First one fetches, others wait for cache
      expect(reports).toHaveLength(3);

      // After all complete, cache should have 1 entry
      const stats = coordinator.getCacheStats();
      expect(stats.entries).toBe(1);
    });

    it('should handle concurrent requests for different sessions', async () => {
      const event1 = { ...mockEvent, session_id: 'session-1' };
      const event2 = { ...mockEvent, session_id: 'session-2' };
      const event3 = { ...mockEvent, session_id: 'session-3' };

      const promises = [
        coordinator.gatherContext(event1),
        coordinator.gatherContext(event2),
        coordinator.gatherContext(event3),
      ];

      const reports = await Promise.all(promises);

      expect(reports).toHaveLength(3);
      expect(coordinator.getCacheStats().entries).toBe(3);

      // Each should have unique investigation_id
      const ids = reports.map((r) => r.investigation_id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('Edge Cases', () => {
    it('should handle event with missing optional fields', async () => {
      const minimalEvent: AgentEvent = {
        event_id: '550e8400-e29b-41d4-a716-446655440001',
        session_id: '550e8400-e29b-41d4-a716-446655440000',
        event_type: 'test_event',
        payload: {},
        timestamp: new Date().toISOString(),
        status: 'queued',
      };

      const report = await coordinator.gatherContext(minimalEvent);
      expect(report).toBeDefined();
      expect(report.session_id).toBe(minimalEvent.session_id);
    });

    it('should handle very long TTL', async () => {
      const longTtlCoordinator = new ContextCoordinator({
        enabled: true,
        cacheTtlMs: 1000000, // Very long TTL
      });

      await longTtlCoordinator.gatherContext(mockEvent);
      const report1 = await longTtlCoordinator.gatherContext(mockEvent);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const report2 = await longTtlCoordinator.gatherContext(mockEvent);

      // Should still be cached
      expect(report2.investigation_id).toBe(report1.investigation_id);
    });

    it('should handle very short TTL', async () => {
      const shortTtlCoordinator = new ContextCoordinator({
        enabled: true,
        cacheTtlMs: 1, // 1ms TTL
      });

      const report1 = await shortTtlCoordinator.gatherContext(mockEvent);

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      const report2 = await shortTtlCoordinator.gatherContext(mockEvent);

      // With very short TTL, second request should fetch new data
      expect(report2.investigation_id).not.toBe(report1.investigation_id);
    });

    it('should handle events with same session but different event types', async () => {
      const event1 = { ...mockEvent, event_type: 'agent_started' };
      const event2 = { ...mockEvent, event_type: 'task_failed' };

      const report1 = await coordinator.gatherContext(event1);
      const report2 = await coordinator.gatherContext(event2);

      // Same session, so should be cached
      expect(report2.investigation_id).toBe(report1.investigation_id);

      // Cache should have 1 entry (same session)
      expect(coordinator.getCacheStats().entries).toBe(1);
    });
  });

  describe('Report Structure Validation', () => {
    it('should return report with all required fields', async () => {
      const report = await coordinator.gatherContext(mockEvent);

      expect(report).toHaveProperty('investigation_id');
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('session_id');
      expect(report).toHaveProperty('query_count');
      expect(report).toHaveProperty('findings');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('confidence');
    });

    it('should return findings with correct structure', async () => {
      const report = await coordinator.gatherContext(mockEvent);

      expect(report.findings).toHaveProperty('session_info');
      expect(report.findings).toHaveProperty('recent_events');
      expect(report.findings).toHaveProperty('patterns_identified');
      expect(report.findings).toHaveProperty('concurrent_sessions');
      expect(report.findings).toHaveProperty('potential_conflicts');

      expect(Array.isArray(report.findings.recent_events)).toBe(true);
      expect(Array.isArray(report.findings.patterns_identified)).toBe(true);
      expect(typeof report.findings.concurrent_sessions).toBe('number');
      expect(typeof report.findings.potential_conflicts).toBe('number');
    });

    it('should generate unique investigation IDs', async () => {
      coordinator.clearCache();

      const report1 = await coordinator.gatherContext({ ...mockEvent, session_id: 'session-1' });
      const report2 = await coordinator.gatherContext({ ...mockEvent, session_id: 'session-2' });
      const report3 = await coordinator.gatherContext({ ...mockEvent, session_id: 'session-3' });

      expect(report1.investigation_id).not.toBe(report2.investigation_id);
      expect(report2.investigation_id).not.toBe(report3.investigation_id);
      expect(report1.investigation_id).not.toBe(report3.investigation_id);
    });
  });

  describe('Performance', () => {
    it('should complete context gathering within reasonable time', async () => {
      const startTime = Date.now();
      await coordinator.gatherContext(mockEvent);
      const duration = Date.now() - startTime;

      // Should complete within 200ms (simulated delay is 100ms)
      expect(duration).toBeLessThan(200);
    });

    it('should cache lookups be faster than fetches', async () => {
      // First call - fetch (slow)
      const fetchStart = Date.now();
      await coordinator.gatherContext(mockEvent);
      const fetchDuration = Date.now() - fetchStart;

      // Second call - cached (fast)
      const cacheStart = Date.now();
      await coordinator.gatherContext(mockEvent);
      const cacheDuration = Date.now() - cacheStart;

      // Cache should be much faster
      expect(cacheDuration).toBeLessThan(fetchDuration / 5);
    });

    it('should handle burst of context requests efficiently', async () => {
      const startTime = Date.now();

      const events = Array.from({ length: 20 }, (_, i) => ({
        ...mockEvent,
        session_id: `session-${i}`,
      }));

      await Promise.all(events.map((event) => coordinator.gatherContext(event)));

      const duration = Date.now() - startTime;

      // All 20 concurrent requests should complete within reasonable time
      // With 100ms simulated delay, concurrent execution should be ~100-200ms
      expect(duration).toBeLessThan(500);
      expect(coordinator.getCacheStats().entries).toBe(20);
    });
  });
});
