/**
 * Multi-Claude 3.0 - Decision Engine
 * Rule-based decision making system
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AgentEvent,
  Decision,
  DecisionContext,
  DecisionType,
  IntelligenceReport,
  Action,
} from '../types/events.js';
import { BrainConfig } from '../types/config.js';

export interface DecisionRule {
  id: string;
  name: string;
  condition: (context: DecisionContext) => boolean;
  action: (context: DecisionContext) => Omit<Decision, 'decision_id'>;
  priority: number;
}

export class DecisionEngine {
  private rules: DecisionRule[] = [];
  private config: BrainConfig['decisionEngine'];

  constructor(config: BrainConfig['decisionEngine']) {
    this.config = config;
    this.loadDefaultRules();
  }

  /**
   * Make decision based on event and context
   */
  async makeDecision(
    event: AgentEvent,
    context: IntelligenceReport,
    sessionState: any,
    systemState: any
  ): Promise<Decision> {
    const decisionContext: DecisionContext = {
      event,
      context,
      session_state: sessionState,
      system_state: systemState,
      policies: {
        max_concurrent_agents: 20,
        auto_execute_threshold: this.config.autoExecuteThreshold,
        escalate_threshold: this.config.escalateThreshold,
        default_timeout_ms: 60000,
      },
    };

    // Find matching rule
    const matchingRule = this.findMatchingRule(decisionContext);

    if (matchingRule) {
      const decisionData = matchingRule.action(decisionContext);
      return {
        decision_id: uuidv4(),
        ...decisionData,
      };
    }

    // Default decision: no action
    return {
      decision_id: uuidv4(),
      decision_type: 'no_action',
      actions: [],
      rationale: 'No matching rule found, default to no action',
      confidence_score: 1.0,
    };
  }

  /**
   * Find matching rule based on priority
   */
  private findMatchingRule(context: DecisionContext): DecisionRule | undefined {
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);
    return sortedRules.find((rule) => {
      try {
        return rule.condition(context);
      } catch (error) {
        console.error(`Error evaluating rule ${rule.id}:`, error);
        return false;
      }
    });
  }

  /**
   * Add custom rule
   */
  addRule(rule: DecisionRule): void {
    this.rules.push(rule);
  }

  /**
   * Load default rules
   */
  private loadDefaultRules(): void {
    // Rule: Auto-spawn ProjectScaffolder for new projects
    this.addRule({
      id: 'auto-spawn-scaffolder',
      name: 'Auto-spawn ProjectScaffolder for new projects',
      priority: 100,
      condition: (ctx) =>
        ctx.event.event_type === 'user_request' &&
        ctx.event.payload.intent === 'create_project',
      action: (ctx) => ({
        decision_type: 'spawn_agent',
        actions: [
          {
            type: 'spawn_agent',
            agent_type: 'ProjectScaffolder',
            configuration: ctx.event.payload.project_config || {},
            priority: ctx.event.priority || 5,
            timeout_ms: 60000,
          },
        ],
        rationale: 'User requested project creation, spawning ProjectScaffolder',
        confidence_score: 0.95,
      }),
    });

    // Rule: Auto-merge non-conflicting changes
    this.addRule({
      id: 'auto-merge-safe',
      name: 'Auto-merge when no conflicts detected',
      priority: 80,
      condition: (ctx) =>
        ctx.event.event_type === 'agent_completed' &&
        !!ctx.context.findings.concurrent_sessions &&
        ctx.context.findings.concurrent_sessions > 1 &&
        ctx.context.findings.potential_conflicts === 0,
      action: (ctx) => ({
        decision_type: 'merge_changes',
        actions: [
          {
            type: 'merge',
            session_ids: ctx.context.findings.session_ids || [],
            merge_strategy: 'auto',
            conflict_policy: 'minimal_intervention',
          },
        ],
        rationale: 'Multiple sessions completed with no conflicts, auto-merging',
        confidence_score: 0.9,
      }),
    });

    // Rule: Escalate critical failures
    this.addRule({
      id: 'escalate-critical',
      name: 'Escalate critical failures immediately',
      priority: 200,
      condition: (ctx) =>
        ctx.event.event_type === 'task_failed' &&
        ctx.event.payload.severity === 'critical',
      action: (ctx) => ({
        decision_type: 'escalate_conflict',
        actions: [
          {
            type: 'notification',
            channel: 'user',
            urgency: 'high',
            message: `Critical task failure: ${ctx.event.payload.error_message}`,
            metadata: {
              task_id: ctx.event.payload.task_id,
              session_id: ctx.event.session_id,
            },
          },
        ],
        rationale: 'Critical task failure requires immediate user attention',
        confidence_score: 1.0,
      }),
    });

    // Rule: Retry failed tasks with retry budget
    this.addRule({
      id: 'retry-failed-task',
      name: 'Retry failed tasks if retries available',
      priority: 90,
      condition: (ctx) =>
        ctx.event.event_type === 'task_failed' &&
        ctx.event.payload.severity !== 'critical' &&
        (ctx.event.payload.retry_count || 0) < 3,
      action: (ctx) => ({
        decision_type: 'spawn_agent',
        actions: [
          {
            type: 'spawn_agent',
            agent_type: ctx.event.payload.agent_type,
            configuration: {
              ...ctx.event.payload.original_config,
              retry_count: (ctx.event.payload.retry_count || 0) + 1,
            },
            priority: ctx.event.priority || 5,
            timeout_ms: 60000,
          },
        ],
        rationale: `Task failed, retrying (attempt ${
          (ctx.event.payload.retry_count || 0) + 1
        }/3)`,
        confidence_score: 0.7,
      }),
    });

    // Rule: Request merge for concurrent file modifications
    this.addRule({
      id: 'merge-concurrent-modifications',
      name: 'Request merge when concurrent file modifications detected',
      priority: 85,
      condition: (ctx) =>
        ctx.event.event_type === 'file_modified' &&
        !!ctx.context.findings.concurrent_sessions &&
        ctx.context.findings.concurrent_sessions > 1,
      action: (ctx) => ({
        decision_type: 'merge_changes',
        actions: [
          {
            type: 'merge',
            session_ids: ctx.context.findings.session_ids || [],
            merge_strategy: 'intelligent',
            conflict_policy: 'escalate_complex',
          },
        ],
        rationale: 'Concurrent file modifications detected, initiating merge',
        confidence_score: 0.75,
      }),
    });

    // Rule: Persist state for completed agents
    this.addRule({
      id: 'persist-agent-completion',
      name: 'Persist state when agent completes',
      priority: 70,
      condition: (ctx) => ctx.event.event_type === 'agent_completed',
      action: (ctx) => ({
        decision_type: 'persist_state',
        actions: [
          {
            type: 'persist_state',
            data: {
              session_id: ctx.event.session_id,
              status: 'completed',
              completed_at: new Date().toISOString(),
              results: ctx.event.payload,
            },
          },
        ],
        rationale: 'Agent completed successfully, persisting final state',
        confidence_score: 1.0,
      }),
    });

    // Rule: Log agent start
    this.addRule({
      id: 'log-agent-start',
      name: 'Log agent start event',
      priority: 60,
      condition: (ctx) => ctx.event.event_type === 'agent_started',
      action: (ctx) => ({
        decision_type: 'persist_state',
        actions: [
          {
            type: 'persist_state',
            data: {
              session_id: ctx.event.session_id,
              agent_name: ctx.event.payload.agent_name,
              status: 'active',
              started_at: ctx.event.timestamp,
              metadata: ctx.event.payload.metadata,
            },
          },
        ],
        rationale: 'Agent started, logging session initialization',
        confidence_score: 1.0,
      }),
    });

    // Rule: Validate after merge
    this.addRule({
      id: 'validate-after-merge',
      name: 'Run validation after merge completion',
      priority: 75,
      condition: (ctx) => ctx.event.event_type === 'merge_completed',
      action: (ctx) => ({
        decision_type: 'run_validation',
        actions: [
          {
            type: 'validation',
            validation_type: 'full',
            targets: ctx.event.payload.merged_files || [],
          },
        ],
        rationale: 'Merge completed, running validation to ensure integrity',
        confidence_score: 0.95,
      }),
    });

    // Rule: Handle validation failures
    this.addRule({
      id: 'handle-validation-failure',
      name: 'Escalate or fix validation failures',
      priority: 95,
      condition: (ctx) => ctx.event.event_type === 'validation_failed',
      action: (ctx) => {
        if (ctx.event.payload.auto_fixable) {
          return {
            decision_type: 'spawn_agent',
            actions: [
              {
                type: 'spawn_agent',
                agent_type: 'ValidationFixer',
                configuration: {
                  validation_errors: ctx.event.payload.errors,
                  files: ctx.event.payload.files,
                },
                priority: 8,
                timeout_ms: 30000,
              },
            ],
            rationale: 'Validation failed but auto-fixable, spawning fixer agent',
            confidence_score: 0.8,
          };
        } else {
          return {
            decision_type: 'escalate_conflict',
            actions: [
              {
                type: 'notification',
                channel: 'user',
                urgency: 'medium',
                message: `Validation failed: ${ctx.event.payload.error_summary}`,
                metadata: {
                  errors: ctx.event.payload.errors,
                  files: ctx.event.payload.files,
                },
              },
            ],
            rationale: 'Validation failed and requires manual intervention',
            confidence_score: 1.0,
          };
        }
      },
    });
  }

  /**
   * Get all rules
   */
  getRules(): DecisionRule[] {
    return [...this.rules];
  }

  /**
   * Remove rule by ID
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Clear all rules
   */
  clearRules(): void {
    this.rules = [];
  }
}
