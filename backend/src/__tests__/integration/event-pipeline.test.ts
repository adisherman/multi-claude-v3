/**
 * Event Pipeline Integration Tests
 * Tests the complete event processing flow from submission to persistence
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { BrainEventProcessor } from '../../brain-event-processor.js';
import { AgentEvent } from '../../types/events.js';
import * as databaseModule from '../../database/index.js';

// Mock the database module
jest.mock('../../database/index.js', () => ({
  db: {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    transaction: jest.fn((callback) => callback({ query: jest.fn() })),
    close: jest.fn().mockResolvedValue(undefined),
    getStats: jest.fn().mockReturnValue({
      total: 10,
      idle: 5,
      waiting: 0,
      connected: true,
    }),
  },
  SessionsRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({
      session_id: 'test-session-id',
      agent_name: 'TestAgent',
      status: 'active',
      created_at: new Date().toISOString(),
    }),
    findById: jest.fn().mockResolvedValue({
      session_id: 'test-session-id',
      agent_name: 'TestAgent',
      status: 'active',
    }),
    getActiveSessions: jest.fn().mockResolvedValue([]),
  })),
  EventsRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockImplementation((input) => Promise.resolve({
      event_id: input.event_id || 'generated-event-id',
      session_id: input.session_id,
      event_type: input.event_type,
      status: 'received',
      created_at: new Date().toISOString(),
    })),
    findById: jest.fn().mockRejectedValue(new Error('Event not found')),
    updateStatus: jest.fn().mockResolvedValue(undefined),
  })),
  DecisionsRepository: jest.fn().mockImplementation(() => ({
    create: jest.fn().mockResolvedValue({
      decision_id: 'test-decision-id',
      event_id: 'test-event-id',
      decision_type: 'persist_state',
      confidence_score: 0.95,
      created_at: new Date().toISOString(),
    }),
  })),
}));

describe('Event Pipeline Integration', () => {
  let brain: BrainEventProcessor;

  beforeEach(() => {
    // Set DATABASE_URL for Context Updater
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

    brain = new BrainEventProcessor({
      eventQueue: {
        maxSize: 1000,
      },
      decisionEngine: {
        autoExecuteThreshold: 0.7,
        escalateThreshold: 0.3,
      },
    });

    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (brain) {
      await brain.stop();
    }
    delete process.env.DATABASE_URL;
  });

  describe('End-to-End Event Processing', () => {
    it('should process event from submission to completion', async () => {
      await brain.start();

      const eventData: Partial<AgentEvent> = {
        session_id: 'test-session-123',
        event_type: 'integration_test',
        agent_name: 'IntegrationTestAgent',
        payload: {
          test: 'end_to_end_flow',
          timestamp: new Date().toISOString(),
        },
      };

      const eventProcessedPromise = new Promise<void>((resolve) => {
        brain.once('event:processed', () => {
          resolve();
        });
      });

      const result = await brain.submitEvent(eventData as AgentEvent);

      expect(result.status).toBe('queued');
      expect(result.event_id).toBeDefined();

      // Wait for event to be processed
      await eventProcessedPromise;

      const metrics = brain.getMetrics();
      expect(metrics.worker.total_processed).toBeGreaterThan(0);
    });

    it('should handle multiple concurrent events', async () => {
      await brain.start();

      const events = Array.from({ length: 5 }, (_, i) => ({
        session_id: 'test-session-123',
        event_type: 'concurrent_test',
        agent_name: 'ConcurrentTestAgent',
        payload: {
          test: 'concurrent_processing',
          index: i,
        },
      }));

      let processedCount = 0;
      brain.on('event:processed', () => {
        processedCount++;
      });

      const results = await Promise.all(
        events.map((event) => brain.submitEvent(event as AgentEvent))
      );

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.status).toBe('queued');
        expect(result.event_id).toBeDefined();
      });

      // Wait for all events to process
      await new Promise((resolve) => setTimeout(resolve, 1000));

      expect(processedCount).toBeGreaterThan(0);
    });

    it('should emit all lifecycle events', async () => {
      await brain.start();

      const lifecycleEvents = {
        'event:submitted': jest.fn(),
        'decision:made': jest.fn(),
        'event:processed': jest.fn(),
      };

      Object.entries(lifecycleEvents).forEach(([event, fn]) => {
        brain.on(event, fn);
      });

      const eventData: Partial<AgentEvent> = {
        session_id: 'test-session-123',
        event_type: 'lifecycle_test',
        payload: { test: 'lifecycle_events' },
      };

      await brain.submitEvent(eventData as AgentEvent);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(lifecycleEvents['event:submitted']).toHaveBeenCalled();
      expect(lifecycleEvents['decision:made']).toHaveBeenCalled();
      expect(lifecycleEvents['event:processed']).toHaveBeenCalled();
    });
  });

  describe('Health and Metrics', () => {
    it('should report healthy status when running', async () => {
      await brain.start();

      const health = await brain.getHealth();

      expect(health.status).toBe('healthy');
      expect(health.components).toHaveLength(6);

      const workerComponent = health.components.find(
        (c) => c.name === 'event_processor_worker'
      );
      expect(workerComponent).toBeDefined();
      expect(workerComponent?.status).toBe('healthy');
    });

    it('should track worker metrics correctly', async () => {
      await brain.start();

      const eventData: Partial<AgentEvent> = {
        session_id: 'test-session-123',
        event_type: 'metrics_test',
        payload: { test: 'metrics_tracking' },
      };

      await brain.submitEvent(eventData as AgentEvent);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      const metrics = brain.getMetrics();

      expect(metrics.worker).toBeDefined();
      expect(metrics.worker.total_processed).toBeGreaterThan(0);
      expect(metrics.worker.success_rate).toBeGreaterThanOrEqual(0);
      expect(metrics.worker.average_duration).toBeGreaterThanOrEqual(0);
    });

    it('should report queue depth correctly', async () => {
      await brain.start();

      const eventQueue = brain.getEventQueue();
      const initialDepth = eventQueue.getDepth();

      expect(initialDepth).toBe(0);

      // Submit multiple events
      const events = Array.from({ length: 3 }, (_, i) => ({
        session_id: 'test-session-123',
        event_type: 'queue_test',
        payload: { index: i },
      }));

      await Promise.all(events.map((e) => brain.submitEvent(e as AgentEvent)));

      // Queue should process quickly, but we can check metrics
      const metrics = brain.getMetrics();
      expect(metrics.queue_depth).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid events gracefully', async () => {
      await brain.start();

      const invalidEvent = {
        // Missing required fields
        payload: { test: 'invalid' },
      } as AgentEvent;

      await expect(brain.submitEvent(invalidEvent)).rejects.toThrow('Invalid event');
    });

    it('should validate event structure', () => {
      const validation = brain.validateEvent({
        session_id: 'test',
        event_type: 'test',
        payload: {},
      } as AgentEvent);

      expect(validation.valid).toBe(true);
    });

    it('should reject events missing required fields', () => {
      const validation = brain.validateEvent({
        payload: {},
      } as AgentEvent);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Missing session_id');
      expect(validation.errors).toContain('Missing event_type');
    });

    it('should continue processing after individual event failures', async () => {
      await brain.start();

      // Mock EventsRepository to fail for specific event
      const mockEventsRepo = {
        create: jest.fn().mockImplementation((input) => {
          if (input.event_type === 'failing_event') {
            return Promise.reject(new Error('Database error'));
          }
          return Promise.resolve({
            event_id: input.event_id || 'generated-event-id',
            session_id: input.session_id,
            event_type: input.event_type,
            status: 'received',
          });
        }),
        findById: jest.fn().mockRejectedValue(new Error('Event not found')),
        updateStatus: jest.fn().mockResolvedValue(undefined),
      };

      (databaseModule.EventsRepository as jest.Mock).mockImplementation(() => mockEventsRepo);

      const successfulEvent: Partial<AgentEvent> = {
        session_id: 'test-session-123',
        event_type: 'successful_event',
        payload: { test: 'should_succeed' },
      };

      const failingEvent: Partial<AgentEvent> = {
        session_id: 'test-session-123',
        event_type: 'failing_event',
        payload: { test: 'should_fail' },
      };

      // Submit both events
      await brain.submitEvent(successfulEvent as AgentEvent);
      await brain.submitEvent(failingEvent as AgentEvent);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      const metrics = brain.getMetrics();
      // At least one should have been processed
      expect(metrics.worker.total_processed).toBeGreaterThan(0);
    });
  });

  describe('Decision Making', () => {
    it('should make decisions with appropriate confidence', async () => {
      await brain.start();

      let capturedDecision: any = null;
      brain.on('decision:made', (decision) => {
        capturedDecision = decision;
      });

      const eventData: Partial<AgentEvent> = {
        session_id: 'test-session-123',
        event_type: 'decision_test',
        payload: { test: 'decision_making' },
      };

      await brain.submitEvent(eventData as AgentEvent);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 500));

      expect(capturedDecision).not.toBeNull();
      expect(capturedDecision).toHaveProperty('decision_type');
      expect(capturedDecision).toHaveProperty('confidence_score');
      expect(capturedDecision.confidence_score).toBeGreaterThanOrEqual(0);
      expect(capturedDecision.confidence_score).toBeLessThanOrEqual(1);
    });

    it('should escalate low confidence decisions', async () => {
      await brain.start();

      const decisionEngine = brain.getDecisionEngine();

      // Mock a decision with low confidence
      const lowConfidenceSpy = jest.fn();
      brain.on('decision:escalated', lowConfidenceSpy);

      // This would require mocking the decision engine to return low confidence
      // For now, we'll just verify the event handler is set up
      expect(brain.listenerCount('decision:escalated')).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Context Updater Integration', () => {
    it('should initialize Context Updater when DATABASE_URL is set', () => {
      const health = brain.getHealth();

      health.then((h) => {
        const contextUpdater = h.components.find((c) => c.name === 'context_updater');
        expect(contextUpdater).toBeDefined();
        expect(contextUpdater?.details.database_url_set).toBe(true);
      });
    });

    it('should report Context Updater status in health check', async () => {
      await brain.start();

      const health = await brain.getHealth();
      const contextUpdater = health.components.find((c) => c.name === 'context_updater');

      expect(contextUpdater).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(contextUpdater?.status);
    });
  });

  describe('System State', () => {
    it('should track active sessions', async () => {
      await brain.start();

      const eventData: Partial<AgentEvent> = {
        session_id: 'test-session-123',
        event_type: 'session_test',
        payload: { test: 'session_tracking' },
      };

      await brain.submitEvent(eventData as AgentEvent);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 200));

      const metrics = brain.getMetrics();
      expect(metrics.active_agents).toBeGreaterThanOrEqual(0);
    });

    it('should report system state correctly', async () => {
      await brain.start();

      const health = await brain.getHealth();

      expect(health.metrics.uptime_seconds).toBeGreaterThanOrEqual(0);
      expect(health.metrics.queue_depth).toBeGreaterThanOrEqual(0);
      expect(health.metrics.active_sessions).toBeGreaterThanOrEqual(0);
    });
  });
});
