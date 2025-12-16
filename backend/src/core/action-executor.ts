/**
 * Multi-Claude 3.0 - Action Executor
 * Executes actions decided by the decision engine
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Action,
  ActionOutcome,
  Decision,
  SpawnAgentAction,
  MergeAction,
  PersistStateAction,
  NotificationAction,
  ValidationAction,
  AgentSpawnResponse,
  MergeReport,
  PersistenceConfirmation,
  PersistenceRequest,
} from '../types/events.js';
import { BrainConfig } from '../types/config.js';
import { ContextUpdater } from '../agents/context-updater.js';

export class ActionExecutor {
  private config: BrainConfig;
  private activeAgents: Map<string, any> = new Map();
  private contextUpdater: ContextUpdater | null = null;

  constructor(config: BrainConfig, contextUpdater?: ContextUpdater) {
    this.config = config;
    this.contextUpdater = contextUpdater || null;
  }

  /**
   * Set Context Updater
   */
  setContextUpdater(contextUpdater: ContextUpdater): void {
    this.contextUpdater = contextUpdater;
  }

  /**
   * Execute all actions in a decision
   */
  async executeActions(decision: Decision): Promise<ActionOutcome[]> {
    const outcomes: ActionOutcome[] = [];

    for (const action of decision.actions) {
      const outcome = await this.executeAction(action);
      outcomes.push(outcome);

      // Stop execution if action failed and has dependencies
      if (outcome.status === 'failed' && decision.dependencies) {
        break;
      }
    }

    return outcomes;
  }

  /**
   * Execute single action
   */
  private async executeAction(action: Action): Promise<ActionOutcome> {
    const startTime = Date.now();

    try {
      let result: any;

      switch (action.type) {
        case 'spawn_agent':
          result = await this.spawnAgent(action as SpawnAgentAction);
          break;

        case 'merge':
          result = await this.executeMerge(action as MergeAction);
          break;

        case 'persist_state':
          result = await this.persistState(action as PersistStateAction);
          break;

        case 'notification':
          result = await this.sendNotification(action as NotificationAction);
          break;

        case 'validation':
          result = await this.runValidation(action as ValidationAction);
          break;

        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      return {
        action,
        status: 'success',
        result,
        duration_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        action,
        status: 'failed',
        error: error.message,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  /**
   * Spawn agent
   */
  private async spawnAgent(
    action: SpawnAgentAction
  ): Promise<AgentSpawnResponse> {
    // TODO: Replace with actual agent spawning logic
    // For now, simulate agent spawn

    return new Promise((resolve) => {
      setTimeout(() => {
        const sessionId = uuidv4();

        this.activeAgents.set(sessionId, {
          agent_type: action.agent_type,
          started_at: new Date().toISOString(),
        });

        const response: AgentSpawnResponse = {
          session_id: sessionId,
          agent_name: action.agent_type,
          status: 'spawned',
        };

        resolve(response);
      }, 50); // Simulate spawn delay
    });
  }

  /**
   * Execute merge
   */
  private async executeMerge(action: MergeAction): Promise<MergeReport> {
    // TODO: Replace with actual merge agent coordination
    // For now, simulate merge

    return new Promise((resolve) => {
      setTimeout(() => {
        const report: MergeReport = {
          merge_id: uuidv4(),
          timestamp: new Date().toISOString(),
          status: 'success',
          conflicts_detected: 0,
          conflicts_resolved: 0,
          conflicts_escalated: 0,
          merged_files: [],
          validation_results: {
            syntax_check: 'passed',
            type_check: 'passed',
          },
        };

        resolve(report);
      }, 100); // Simulate merge delay
    });
  }

  /**
   * Persist state
   */
  private async persistState(
    action: PersistStateAction
  ): Promise<PersistenceConfirmation> {
    // Check if Context Updater is available
    if (!this.contextUpdater) {
      console.warn('Context Updater not available, using mock persistence');
      // Fall back to mock implementation
      return new Promise((resolve) => {
        setTimeout(() => {
          const confirmation: PersistenceConfirmation = {
            update_id: uuidv4(),
            timestamp: new Date().toISOString(),
            operations: [
              {
                operation: 'update',
                table: 'agent_sessions',
                record_id: action.data.session_id || uuidv4(),
                success: true,
              },
            ],
            summary: {
              total_operations: 1,
              successful: 1,
              failed: 0,
            },
          };

          resolve(confirmation);
        }, 50); // Simulate persistence delay
      });
    }

    // Use real Context Updater
    const request: PersistenceRequest = {
      event_data: action.data.event,
      processing_results: action.data.decision,
      action_outcomes: action.data.outcomes || [],
      metrics: action.data.metrics,
    };

    return await this.contextUpdater.persistProcessingResults(request);
  }

  /**
   * Send notification
   */
  private async sendNotification(
    action: NotificationAction
  ): Promise<{ sent: boolean; timestamp: string }> {
    // TODO: Replace with actual notification system
    // For now, just log and return success

    console.log(
      `[${action.urgency.toUpperCase()}] Notification to ${action.channel}: ${
        action.message
      }`
    );

    return {
      sent: true,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Run validation
   */
  private async runValidation(action: ValidationAction): Promise<{
    validation_type: string;
    status: string;
    results: any;
  }> {
    // TODO: Replace with actual validation logic
    // For now, simulate validation

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          validation_type: action.validation_type,
          status: 'passed',
          results: {
            targets: action.targets,
            checks_performed: ['syntax', 'types', 'linting'],
            all_passed: true,
          },
        });
      }, 75); // Simulate validation delay
    });
  }

  /**
   * Get active agents
   */
  getActiveAgents(): Map<string, any> {
    return new Map(this.activeAgents);
  }

  /**
   * Check if at max concurrent agents
   */
  isAtMaxConcurrentAgents(): boolean {
    return (
      this.activeAgents.size >= this.config.agentSpawning.maxConcurrent
    );
  }

  /**
   * Remove completed agent
   */
  removeAgent(sessionId: string): boolean {
    return this.activeAgents.delete(sessionId);
  }
}
