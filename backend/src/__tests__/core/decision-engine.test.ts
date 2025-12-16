/**
 * DecisionEngine Unit Tests
 * Tests the rule-based decision making system
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { DecisionEngine, DecisionRule } from '../../core/decision-engine.js';
import { AgentEvent, DecisionContext, IntelligenceReport } from '../../types/events.js';

describe('DecisionEngine', () => {
  let engine: DecisionEngine;
  let mockEvent: AgentEvent;
  let mockContext: IntelligenceReport;
  let mockSessionState: any;
  let mockSystemState: any;

  beforeEach(() => {
    engine = new DecisionEngine({
      autoExecuteThreshold: 0.7,
      escalateThreshold: 0.3,
    });

    mockEvent = {
      event_id: '550e8400-e29b-41d4-a716-446655440001',
      session_id: '550e8400-e29b-41d4-a716-446655440000',
      event_type: 'test_event',
      agent_name: 'TestAgent',
      payload: {},
      timestamp: new Date().toISOString(),
      status: 'queued',
    };

    mockContext = {
      event_id: mockEvent.event_id,
      timestamp: new Date().toISOString(),
      findings: {},
      metadata: {},
    };

    mockSessionState = {
      session_id: mockEvent.session_id,
      agent_name: 'TestAgent',
      status: 'active',
      started_at: new Date().toISOString(),
      metadata: {},
    };

    mockSystemState = {
      active_sessions: 1,
      queue_depth: 0,
      system_load: 0.5,
      available_resources: {
        cpu: 1.0,
        memory: 1.0,
      },
    };
  });

  describe('Initialization', () => {
    it('should initialize with default rules', () => {
      const rules = engine.getRules();
      expect(rules.length).toBe(9);
    });

    it('should initialize with correct configuration', async () => {
      const decision = await engine.makeDecision(
        mockEvent,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision).toBeDefined();
      expect(decision.decision_id).toBeDefined();
    });

    it('should load all 9 default rules', () => {
      const rules = engine.getRules();
      const ruleIds = rules.map((r) => r.id);

      expect(ruleIds).toContain('auto-spawn-scaffolder');
      expect(ruleIds).toContain('auto-merge-safe');
      expect(ruleIds).toContain('escalate-critical');
      expect(ruleIds).toContain('retry-failed-task');
      expect(ruleIds).toContain('merge-concurrent-modifications');
      expect(ruleIds).toContain('persist-agent-completion');
      expect(ruleIds).toContain('log-agent-start');
      expect(ruleIds).toContain('validate-after-merge');
      expect(ruleIds).toContain('handle-validation-failure');
    });
  });

  describe('Rule Priority', () => {
    it('should execute highest priority rule first', async () => {
      // Critical failure (priority 200) should override agent_completed (priority 70)
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'task_failed',
        payload: {
          severity: 'critical',
          error_message: 'System failure',
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('escalate_conflict');
      expect(decision.confidence_score).toBe(1.0);
    });

    it('should respect rule priority ordering', () => {
      const rules = engine.getRules();
      const priorities = rules.map((r) => r.priority);

      expect(Math.max(...priorities)).toBe(200); // escalate-critical
      expect(Math.min(...priorities)).toBe(60); // log-agent-start
    });
  });

  describe('Default Rules - Project Creation', () => {
    it('should spawn ProjectScaffolder for new project requests', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'user_request',
        payload: {
          intent: 'create_project',
          project_config: {
            name: 'new-project',
            framework: 'react',
          },
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('spawn_agent');
      expect(decision.actions).toHaveLength(1);
      expect(decision.actions[0].type).toBe('spawn_agent');
      expect(decision.actions[0].agent_type).toBe('ProjectScaffolder');
      expect(decision.confidence_score).toBe(0.95);
      expect(decision.rationale).toContain('ProjectScaffolder');
    });
  });

  describe('Default Rules - Auto-Merge', () => {
    it('should auto-merge when no conflicts detected', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'agent_completed',
        payload: {},
      };

      const context: IntelligenceReport = {
        ...mockContext,
        findings: {
          concurrent_sessions: 2,
          potential_conflicts: 0,
          session_ids: ['session-1', 'session-2'],
        },
      };

      const decision = await engine.makeDecision(
        event,
        context,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('merge_changes');
      expect(decision.actions[0].type).toBe('merge');
      expect(decision.actions[0].merge_strategy).toBe('auto');
      expect(decision.confidence_score).toBe(0.9);
    });

    it('should not auto-merge when conflicts exist', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'agent_completed',
        payload: {},
      };

      const context: IntelligenceReport = {
        ...mockContext,
        findings: {
          concurrent_sessions: 2,
          potential_conflicts: 3, // Has conflicts
          session_ids: ['session-1', 'session-2'],
        },
      };

      const decision = await engine.makeDecision(
        event,
        context,
        mockSessionState,
        mockSystemState
      );

      // Should match persist-agent-completion rule instead
      expect(decision.decision_type).toBe('persist_state');
    });
  });

  describe('Default Rules - Critical Failures', () => {
    it('should escalate critical task failures immediately', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'task_failed',
        payload: {
          severity: 'critical',
          error_message: 'Database connection lost',
          task_id: 'task-123',
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('escalate_conflict');
      expect(decision.actions[0].type).toBe('notification');
      expect(decision.actions[0].urgency).toBe('high');
      expect(decision.actions[0].message).toContain('Critical task failure');
      expect(decision.confidence_score).toBe(1.0);
    });
  });

  describe('Default Rules - Task Retry', () => {
    it('should retry failed tasks with retry budget', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'task_failed',
        payload: {
          severity: 'medium',
          agent_type: 'TestAgent',
          retry_count: 1,
          original_config: { test: true },
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('spawn_agent');
      expect(decision.actions[0].configuration.retry_count).toBe(2);
      expect(decision.rationale).toContain('retrying');
      expect(decision.rationale).toContain('2/3');
      expect(decision.confidence_score).toBe(0.7);
    });

    it('should not retry after 3 attempts', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'task_failed',
        payload: {
          severity: 'medium',
          agent_type: 'TestAgent',
          retry_count: 3, // Already at max
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      // Should not match retry rule
      expect(decision.decision_type).not.toBe('spawn_agent');
    });

    it('should not retry critical failures', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'task_failed',
        payload: {
          severity: 'critical',
          agent_type: 'TestAgent',
          retry_count: 0,
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      // Critical failures should escalate, not retry
      expect(decision.decision_type).toBe('escalate_conflict');
    });
  });

  describe('Default Rules - Concurrent Modifications', () => {
    it('should request merge for concurrent file modifications', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'file_modified',
        payload: {
          file_path: '/src/app.ts',
        },
      };

      const context: IntelligenceReport = {
        ...mockContext,
        findings: {
          concurrent_sessions: 3,
          session_ids: ['s1', 's2', 's3'],
        },
      };

      const decision = await engine.makeDecision(
        event,
        context,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('merge_changes');
      expect(decision.actions[0].merge_strategy).toBe('intelligent');
      expect(decision.actions[0].conflict_policy).toBe('escalate_complex');
      expect(decision.confidence_score).toBe(0.75);
    });
  });

  describe('Default Rules - State Persistence', () => {
    it('should persist state when agent completes', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'agent_completed',
        payload: {
          results: { success: true, data: 'test' },
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('persist_state');
      expect(decision.actions[0].type).toBe('persist_state');
      expect(decision.actions[0].data.status).toBe('completed');
      expect(decision.confidence_score).toBe(1.0);
    });

    it('should log agent start events', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'agent_started',
        payload: {
          agent_name: 'NewAgent',
          metadata: { version: '1.0' },
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('persist_state');
      expect(decision.actions[0].data.status).toBe('active');
      expect(decision.actions[0].data.agent_name).toBe('NewAgent');
      expect(decision.confidence_score).toBe(1.0);
    });
  });

  describe('Default Rules - Validation', () => {
    it('should run validation after merge completion', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'merge_completed',
        payload: {
          merged_files: ['file1.ts', 'file2.ts'],
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('run_validation');
      expect(decision.actions[0].type).toBe('validation');
      expect(decision.actions[0].validation_type).toBe('full');
      expect(decision.actions[0].targets).toEqual(['file1.ts', 'file2.ts']);
      expect(decision.confidence_score).toBe(0.95);
    });

    it('should auto-fix validation failures when possible', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'validation_failed',
        payload: {
          auto_fixable: true,
          errors: ['missing semicolon', 'unused import'],
          files: ['app.ts'],
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('spawn_agent');
      expect(decision.actions[0].agent_type).toBe('ValidationFixer');
      expect(decision.actions[0].configuration.validation_errors).toEqual([
        'missing semicolon',
        'unused import',
      ]);
      expect(decision.confidence_score).toBe(0.8);
    });

    it('should escalate non-fixable validation failures', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'validation_failed',
        payload: {
          auto_fixable: false,
          error_summary: 'Type errors in core modules',
          errors: ['Type mismatch in function'],
          files: ['core.ts'],
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('escalate_conflict');
      expect(decision.actions[0].type).toBe('notification');
      expect(decision.actions[0].urgency).toBe('medium');
      expect(decision.actions[0].message).toContain('Validation failed');
      expect(decision.confidence_score).toBe(1.0);
    });
  });

  describe('Default Decision', () => {
    it('should return no_action when no rules match', async () => {
      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'unknown_event_type',
        payload: {},
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('no_action');
      expect(decision.actions).toEqual([]);
      expect(decision.rationale).toContain('No matching rule');
      expect(decision.confidence_score).toBe(1.0);
    });
  });

  describe('Custom Rules', () => {
    it('should allow adding custom rules', async () => {
      const customRule: DecisionRule = {
        id: 'custom-test-rule',
        name: 'Custom test rule',
        priority: 150,
        condition: (ctx) => ctx.event.event_type === 'custom_event',
        action: (ctx) => ({
          decision_type: 'spawn_agent',
          actions: [
            {
              type: 'spawn_agent',
              agent_type: 'CustomAgent',
              configuration: {},
              priority: 5,
              timeout_ms: 30000,
            },
          ],
          rationale: 'Custom rule triggered',
          confidence_score: 0.85,
        }),
      };

      engine.addRule(customRule);

      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'custom_event',
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.decision_type).toBe('spawn_agent');
      expect(decision.rationale).toBe('Custom rule triggered');
      expect(decision.confidence_score).toBe(0.85);
    });

    it('should respect custom rule priority', async () => {
      const highPriorityRule: DecisionRule = {
        id: 'high-priority-rule',
        name: 'High priority rule',
        priority: 250, // Higher than escalate-critical (200)
        condition: (ctx) => ctx.event.event_type === 'task_failed',
        action: (ctx) => ({
          decision_type: 'no_action',
          actions: [],
          rationale: 'High priority rule overrides default',
          confidence_score: 1.0,
        }),
      };

      engine.addRule(highPriorityRule);

      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'task_failed',
        payload: {
          severity: 'critical',
        },
      };

      const decision = await engine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      // High priority rule should override escalate-critical
      expect(decision.rationale).toBe('High priority rule overrides default');
    });
  });

  describe('Rule Management', () => {
    it('should get all rules', () => {
      const rules = engine.getRules();
      expect(rules).toBeInstanceOf(Array);
      expect(rules.length).toBeGreaterThan(0);
    });

    it('should return a copy of rules array', () => {
      const rules1 = engine.getRules();
      const rules2 = engine.getRules();

      expect(rules1).not.toBe(rules2); // Different references
      expect(rules1).toEqual(rules2); // Same content
    });

    it('should remove rule by ID', () => {
      const initialCount = engine.getRules().length;
      const removed = engine.removeRule('escalate-critical');

      expect(removed).toBe(true);
      expect(engine.getRules().length).toBe(initialCount - 1);
      expect(engine.getRules().find((r) => r.id === 'escalate-critical')).toBeUndefined();
    });

    it('should return false when removing non-existent rule', () => {
      const removed = engine.removeRule('non-existent-rule');
      expect(removed).toBe(false);
    });

    it('should clear all rules', () => {
      engine.clearRules();
      expect(engine.getRules().length).toBe(0);
    });

    it('should allow rebuilding rules after clearing', async () => {
      engine.clearRules();

      const customRule: DecisionRule = {
        id: 'only-rule',
        name: 'Only rule',
        priority: 100,
        condition: (ctx) => true,
        action: (ctx) => ({
          decision_type: 'no_action',
          actions: [],
          rationale: 'Only rule active',
          confidence_score: 1.0,
        }),
      };

      engine.addRule(customRule);

      const decision = await engine.makeDecision(
        mockEvent,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      expect(decision.rationale).toBe('Only rule active');
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in rule conditions gracefully', async () => {
      const faultyRule: DecisionRule = {
        id: 'faulty-rule',
        name: 'Faulty rule',
        priority: 300,
        condition: (ctx) => {
          throw new Error('Rule condition error');
        },
        action: (ctx) => ({
          decision_type: 'no_action',
          actions: [],
          rationale: 'Should not reach here',
          confidence_score: 1.0,
        }),
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      engine.addRule(faultyRule);

      const decision = await engine.makeDecision(
        mockEvent,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      // Should skip faulty rule and fall through to default or other rules
      expect(decision).toBeDefined();
      expect(decision.rationale).not.toBe('Should not reach here');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error evaluating rule'),
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Configuration Integration', () => {
    it('should use auto execute threshold from config', async () => {
      const customEngine = new DecisionEngine({
        autoExecuteThreshold: 0.9,
        escalateThreshold: 0.2,
      });

      const event: AgentEvent = {
        ...mockEvent,
        event_type: 'agent_started',
        payload: {},
      };

      const decision = await customEngine.makeDecision(
        event,
        mockContext,
        mockSessionState,
        mockSystemState
      );

      // Decision should be made, verifying engine initialization
      expect(decision).toBeDefined();
      expect(decision.decision_id).toBeDefined();
    });
  });
});
