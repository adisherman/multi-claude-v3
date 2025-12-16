/**
 * ActionExecutor Unit Tests
 * Tests the action execution engine for all action types
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionExecutor } from '../../core/action-executor.js';
import {
  Decision,
  Action,
  SpawnAgentAction,
  MergeAction,
  PersistStateAction,
  NotificationAction,
  ValidationAction,
  AgentEvent,
} from '../../types/events.js';
import { BrainConfig } from '../../types/config.js';

// Mock the Context Updater
jest.mock('../../agents/context-updater.js', () => ({
  ContextUpdater: jest.fn().mockImplementation(() => ({
    persistProcessingResults: jest.fn().mockResolvedValue({
      update_id: 'test-update-id',
      timestamp: new Date().toISOString(),
      operations: [
        {
          operation: 'update',
          table: 'agent_sessions',
          record_id: 'test-record-id',
          success: true,
        },
      ],
      summary: {
        total_operations: 1,
        successful: 1,
        failed: 0,
      },
    }),
  })),
}));

describe('ActionExecutor', () => {
  let executor: ActionExecutor;
  let mockConfig: BrainConfig;
  let mockEvent: AgentEvent;

  beforeEach(() => {
    mockConfig = {
      eventQueue: {
        maxSize: 1000,
      },
      decisionEngine: {
        autoExecuteThreshold: 0.7,
        escalateThreshold: 0.3,
      },
      agentSpawning: {
        maxConcurrent: 5,
        spawnTimeout: 30000,
      },
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

    executor = new ActionExecutor(mockConfig);
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with config', () => {
      expect(executor).toBeDefined();
      expect(executor.getActiveAgents().size).toBe(0);
    });

    it('should initialize with context updater', () => {
      const mockContextUpdater: any = {
        persistProcessingResults: jest.fn().mockResolvedValue({}),
      };
      const executorWithUpdater = new ActionExecutor(mockConfig, mockContextUpdater);
      expect(executorWithUpdater).toBeDefined();
    });

    it('should allow setting context updater after initialization', () => {
      const mockContextUpdater: any = {
        persistProcessingResults: jest.fn().mockResolvedValue({}),
      };
      executor.setContextUpdater(mockContextUpdater);
      expect(executor).toBeDefined();
    });
  });

  describe('Spawn Agent Action', () => {
    it('should spawn agent successfully', async () => {
      const action: SpawnAgentAction = {
        type: 'spawn_agent',
        agent_type: 'ProjectScaffolder',
        configuration: {
          project_name: 'test-project',
          framework: 'react',
        },
      };

      const decision: Decision = {
        decision_id: 'test-decision-1',
        event_id: mockEvent.event_id,
        decision_type: 'spawn_agent',
        confidence_score: 0.95,
        actions: [action],
        reasoning: 'Test spawn',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].status).toBe('success');
      expect(outcomes[0].result).toHaveProperty('session_id');
      expect(outcomes[0].result).toHaveProperty('agent_name', 'ProjectScaffolder');
      expect(outcomes[0].result).toHaveProperty('status', 'spawned');
      expect(outcomes[0].duration_ms).toBeGreaterThan(0);
    });

    it('should track spawned agents', async () => {
      const action: SpawnAgentAction = {
        type: 'spawn_agent',
        agent_type: 'ProjectScaffolder',
        configuration: {},
      };

      const decision: Decision = {
        decision_id: 'test-decision-2',
        event_id: mockEvent.event_id,
        decision_type: 'spawn_agent',
        confidence_score: 0.9,
        actions: [action],
        reasoning: 'Test tracking',
        timestamp: new Date().toISOString(),
      };

      const initialAgents = executor.getActiveAgents().size;
      await executor.executeActions(decision);
      const afterAgents = executor.getActiveAgents().size;

      expect(afterAgents).toBe(initialAgents + 1);
    });

    it('should check max concurrent agents', async () => {
      const action: SpawnAgentAction = {
        type: 'spawn_agent',
        agent_type: 'TestAgent',
        configuration: {},
      };

      const decision: Decision = {
        decision_id: 'test-decision-3',
        event_id: mockEvent.event_id,
        decision_type: 'spawn_agent',
        confidence_score: 0.9,
        actions: [action],
        reasoning: 'Test max concurrent',
        timestamp: new Date().toISOString(),
      };

      // Spawn agents up to max
      for (let i = 0; i < mockConfig.agentSpawning.maxConcurrent; i++) {
        await executor.executeActions(decision);
      }

      expect(executor.isAtMaxConcurrentAgents()).toBe(true);
    });

    it('should remove agent from tracking', async () => {
      const action: SpawnAgentAction = {
        type: 'spawn_agent',
        agent_type: 'TestAgent',
        configuration: {},
      };

      const decision: Decision = {
        decision_id: 'test-decision-4',
        event_id: mockEvent.event_id,
        decision_type: 'spawn_agent',
        confidence_score: 0.9,
        actions: [action],
        reasoning: 'Test removal',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);
      const sessionId = outcomes[0].result.session_id;

      expect(executor.getActiveAgents().has(sessionId)).toBe(true);

      const removed = executor.removeAgent(sessionId);
      expect(removed).toBe(true);
      expect(executor.getActiveAgents().has(sessionId)).toBe(false);
    });

    it('should return false when removing non-existent agent', () => {
      const removed = executor.removeAgent('non-existent-session-id');
      expect(removed).toBe(false);
    });
  });

  describe('Merge Action', () => {
    it('should execute merge successfully', async () => {
      const action: MergeAction = {
        type: 'merge',
        source_session: 'session-1',
        target_session: 'session-2',
        strategy: 'auto',
      };

      const decision: Decision = {
        decision_id: 'test-decision-5',
        event_id: mockEvent.event_id,
        decision_type: 'merge',
        confidence_score: 0.85,
        actions: [action],
        reasoning: 'Test merge',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].status).toBe('success');
      expect(outcomes[0].result).toHaveProperty('merge_id');
      expect(outcomes[0].result).toHaveProperty('status', 'success');
      expect(outcomes[0].result).toHaveProperty('conflicts_detected', 0);
      expect(outcomes[0].result).toHaveProperty('validation_results');
    });

    it('should include merge report details', async () => {
      const action: MergeAction = {
        type: 'merge',
        source_session: 'session-1',
        target_session: 'session-2',
        strategy: 'manual',
      };

      const decision: Decision = {
        decision_id: 'test-decision-6',
        event_id: mockEvent.event_id,
        decision_type: 'merge',
        confidence_score: 0.8,
        actions: [action],
        reasoning: 'Test merge report',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);
      const report = outcomes[0].result;

      expect(report.timestamp).toBeDefined();
      expect(report.merged_files).toEqual([]);
      expect(report.validation_results.syntax_check).toBe('passed');
      expect(report.validation_results.type_check).toBe('passed');
    });
  });

  describe('Persist State Action', () => {
    it('should persist state without context updater (mock)', async () => {
      const action: PersistStateAction = {
        type: 'persist_state',
        data: {
          session_id: mockEvent.session_id,
          event: mockEvent,
          decision: {
            decision_id: 'test-decision',
            event_id: mockEvent.event_id,
            decision_type: 'persist_state',
            confidence_score: 0.9,
            actions: [],
            reasoning: 'Test persist',
            timestamp: new Date().toISOString(),
          },
          metrics: { total: 100, context: 50, decision: 30, execution: 20 },
        },
      };

      const decision: Decision = {
        decision_id: 'test-decision-7',
        event_id: mockEvent.event_id,
        decision_type: 'persist_state',
        confidence_score: 0.9,
        actions: [action],
        reasoning: 'Test persist without updater',
        timestamp: new Date().toISOString(),
      };

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const outcomes = await executor.executeActions(decision);

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].status).toBe('success');
      expect(outcomes[0].result).toHaveProperty('update_id');
      expect(outcomes[0].result).toHaveProperty('operations');
      expect(outcomes[0].result.summary.successful).toBe(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Context Updater not available, using mock persistence'
      );

      consoleSpy.mockRestore();
    });

    it('should persist state with context updater', async () => {
      const mockContextUpdater: any = {
        persistProcessingResults: jest.fn().mockResolvedValue({
          update_id: 'real-update-id',
          timestamp: new Date().toISOString(),
          operations: [
            {
              operation: 'update',
              table: 'agent_sessions',
              record_id: mockEvent.session_id,
              success: true,
            },
          ],
          summary: {
            total_operations: 1,
            successful: 1,
            failed: 0,
          },
        }),
      };

      executor.setContextUpdater(mockContextUpdater);

      const action: PersistStateAction = {
        type: 'persist_state',
        data: {
          session_id: mockEvent.session_id,
          event: mockEvent,
          decision: {
            decision_id: 'test-decision',
            event_id: mockEvent.event_id,
            decision_type: 'persist_state',
            confidence_score: 0.9,
            actions: [],
            reasoning: 'Test persist',
            timestamp: new Date().toISOString(),
          },
          metrics: { total: 100, context: 50, decision: 30, execution: 20 },
        },
      };

      const decision: Decision = {
        decision_id: 'test-decision-8',
        event_id: mockEvent.event_id,
        decision_type: 'persist_state',
        confidence_score: 0.9,
        actions: [action],
        reasoning: 'Test persist with updater',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].status).toBe('success');
      expect(mockContextUpdater.persistProcessingResults).toHaveBeenCalled();
    });
  });

  describe('Notification Action', () => {
    it('should send notification successfully', async () => {
      const action: NotificationAction = {
        type: 'notification',
        channel: 'slack',
        message: 'Test notification message',
        urgency: 'high',
      };

      const decision: Decision = {
        decision_id: 'test-decision-9',
        event_id: mockEvent.event_id,
        decision_type: 'notification',
        confidence_score: 0.95,
        actions: [action],
        reasoning: 'Test notification',
        timestamp: new Date().toISOString(),
      };

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const outcomes = await executor.executeActions(decision);

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].status).toBe('success');
      expect(outcomes[0].result).toHaveProperty('sent', true);
      expect(outcomes[0].result).toHaveProperty('timestamp');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('HIGH')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test notification message')
      );

      consoleSpy.mockRestore();
    });

    it('should handle different urgency levels', async () => {
      const urgencies: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

      for (const urgency of urgencies) {
        const action: NotificationAction = {
          type: 'notification',
          channel: 'email',
          message: `Test ${urgency} urgency`,
          urgency,
        };

        const decision: Decision = {
          decision_id: `test-decision-urgency-${urgency}`,
          event_id: mockEvent.event_id,
          decision_type: 'notification',
          confidence_score: 0.9,
          actions: [action],
          reasoning: `Test ${urgency} notification`,
          timestamp: new Date().toISOString(),
        };

        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const outcomes = await executor.executeActions(decision);

        expect(outcomes[0].status).toBe('success');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining(urgency.toUpperCase())
        );

        consoleSpy.mockRestore();
      }
    });
  });

  describe('Validation Action', () => {
    it('should run validation successfully', async () => {
      const action: ValidationAction = {
        type: 'validation',
        validation_type: 'merge_result',
        targets: ['file1.ts', 'file2.ts'],
      };

      const decision: Decision = {
        decision_id: 'test-decision-10',
        event_id: mockEvent.event_id,
        decision_type: 'validation',
        confidence_score: 0.9,
        actions: [action],
        reasoning: 'Test validation',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].status).toBe('success');
      expect(outcomes[0].result).toHaveProperty('validation_type', 'merge_result');
      expect(outcomes[0].result).toHaveProperty('status', 'passed');
      expect(outcomes[0].result.results.all_passed).toBe(true);
    });

    it('should include validation targets', async () => {
      const targets = ['component.tsx', 'utils.ts', 'types.ts'];
      const action: ValidationAction = {
        type: 'validation',
        validation_type: 'project_structure',
        targets,
      };

      const decision: Decision = {
        decision_id: 'test-decision-11',
        event_id: mockEvent.event_id,
        decision_type: 'validation',
        confidence_score: 0.85,
        actions: [action],
        reasoning: 'Test validation targets',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes[0].result.results.targets).toEqual(targets);
      expect(outcomes[0].result.results.checks_performed).toContain('syntax');
      expect(outcomes[0].result.results.checks_performed).toContain('types');
      expect(outcomes[0].result.results.checks_performed).toContain('linting');
    });
  });

  describe('Multiple Actions', () => {
    it('should execute multiple actions sequentially', async () => {
      const actions: Action[] = [
        {
          type: 'spawn_agent',
          agent_type: 'Agent1',
          configuration: {},
        } as SpawnAgentAction,
        {
          type: 'notification',
          channel: 'slack',
          message: 'Agent spawned',
          urgency: 'low',
        } as NotificationAction,
        {
          type: 'validation',
          validation_type: 'spawn_success',
          targets: [],
        } as ValidationAction,
      ];

      const decision: Decision = {
        decision_id: 'test-decision-12',
        event_id: mockEvent.event_id,
        decision_type: 'spawn_agent',
        confidence_score: 0.9,
        actions,
        reasoning: 'Test multiple actions',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes).toHaveLength(3);
      expect(outcomes[0].action.type).toBe('spawn_agent');
      expect(outcomes[1].action.type).toBe('notification');
      expect(outcomes[2].action.type).toBe('validation');
      outcomes.forEach((outcome) => {
        expect(outcome.status).toBe('success');
      });
    });

    it('should stop on failed action with dependencies', async () => {
      const actions: Action[] = [
        {
          type: 'unknown_action' as any,
        } as Action,
        {
          type: 'notification',
          channel: 'slack',
          message: 'Should not execute',
          urgency: 'low',
        } as NotificationAction,
      ];

      const decision: Decision = {
        decision_id: 'test-decision-13',
        event_id: mockEvent.event_id,
        decision_type: 'spawn_agent',
        confidence_score: 0.9,
        actions,
        reasoning: 'Test failure with dependencies',
        dependencies: ['action1', 'action2'],
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].status).toBe('failed');
    });

    it('should continue on failed action without dependencies', async () => {
      const actions: Action[] = [
        {
          type: 'unknown_action' as any,
        } as Action,
        {
          type: 'notification',
          channel: 'slack',
          message: 'Should execute',
          urgency: 'low',
        } as NotificationAction,
      ];

      const decision: Decision = {
        decision_id: 'test-decision-14',
        event_id: mockEvent.event_id,
        decision_type: 'notification',
        confidence_score: 0.9,
        actions,
        reasoning: 'Test failure without dependencies',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes).toHaveLength(2);
      expect(outcomes[0].status).toBe('failed');
      expect(outcomes[1].status).toBe('success');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown action type', async () => {
      const action = {
        type: 'unknown_action',
      } as Action;

      const decision: Decision = {
        decision_id: 'test-decision-15',
        event_id: mockEvent.event_id,
        decision_type: 'unknown',
        confidence_score: 0.5,
        actions: [action],
        reasoning: 'Test unknown action',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes).toHaveLength(1);
      expect(outcomes[0].status).toBe('failed');
      expect(outcomes[0].error).toContain('Unknown action type');
    });

    it('should capture error details', async () => {
      const action = {
        type: 'invalid_action',
        invalid_field: true,
      } as Action;

      const decision: Decision = {
        decision_id: 'test-decision-16',
        event_id: mockEvent.event_id,
        decision_type: 'invalid',
        confidence_score: 0.5,
        actions: [action],
        reasoning: 'Test error capture',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes[0].status).toBe('failed');
      expect(outcomes[0]).toHaveProperty('error');
      expect(outcomes[0]).toHaveProperty('duration_ms');
      expect(outcomes[0]).toHaveProperty('action');
    });
  });

  describe('Agent Management', () => {
    it('should get copy of active agents', () => {
      const agents = executor.getActiveAgents();
      agents.set('test-id', { test: 'data' });

      const agentsAgain = executor.getActiveAgents();
      expect(agentsAgain.has('test-id')).toBe(false);
    });

    it('should track multiple agents independently', async () => {
      const action: SpawnAgentAction = {
        type: 'spawn_agent',
        agent_type: 'TestAgent',
        configuration: {},
      };

      const decision: Decision = {
        decision_id: 'test-decision-17',
        event_id: mockEvent.event_id,
        decision_type: 'spawn_agent',
        confidence_score: 0.9,
        actions: [action],
        reasoning: 'Test multiple tracking',
        timestamp: new Date().toISOString(),
      };

      await executor.executeActions(decision);
      await executor.executeActions(decision);
      await executor.executeActions(decision);

      expect(executor.getActiveAgents().size).toBe(3);
    });

    it('should not exceed max concurrent agents check', async () => {
      const action: SpawnAgentAction = {
        type: 'spawn_agent',
        agent_type: 'TestAgent',
        configuration: {},
      };

      const decision: Decision = {
        decision_id: 'test-decision-18',
        event_id: mockEvent.event_id,
        decision_type: 'spawn_agent',
        confidence_score: 0.9,
        actions: [action],
        reasoning: 'Test max concurrent',
        timestamp: new Date().toISOString(),
      };

      // Should not be at max initially
      expect(executor.isAtMaxConcurrentAgents()).toBe(false);

      // Spawn up to max
      for (let i = 0; i < mockConfig.agentSpawning.maxConcurrent; i++) {
        await executor.executeActions(decision);
      }

      // Should be at max now
      expect(executor.isAtMaxConcurrentAgents()).toBe(true);

      // Remove one agent
      const sessionId = Array.from(executor.getActiveAgents().keys())[0];
      executor.removeAgent(sessionId);

      // Should no longer be at max
      expect(executor.isAtMaxConcurrentAgents()).toBe(false);
    });
  });

  describe('Action Duration Tracking', () => {
    it('should track duration for successful actions', async () => {
      const action: NotificationAction = {
        type: 'notification',
        channel: 'email',
        message: 'Test duration',
        urgency: 'medium',
      };

      const decision: Decision = {
        decision_id: 'test-decision-19',
        event_id: mockEvent.event_id,
        decision_type: 'notification',
        confidence_score: 0.9,
        actions: [action],
        reasoning: 'Test duration tracking',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes[0].duration_ms).toBeGreaterThan(0);
      expect(typeof outcomes[0].duration_ms).toBe('number');
    });

    it('should track duration for failed actions', async () => {
      const action = {
        type: 'unknown_type',
      } as Action;

      const decision: Decision = {
        decision_id: 'test-decision-20',
        event_id: mockEvent.event_id,
        decision_type: 'unknown',
        confidence_score: 0.5,
        actions: [action],
        reasoning: 'Test failed duration',
        timestamp: new Date().toISOString(),
      };

      const outcomes = await executor.executeActions(decision);

      expect(outcomes[0].duration_ms).toBeGreaterThanOrEqual(0);
      expect(typeof outcomes[0].duration_ms).toBe('number');
    });
  });
});
