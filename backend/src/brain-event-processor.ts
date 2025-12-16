/**
 * Multi-Claude 3.0 - Brain Event Processor
 * Central orchestration engine for the autonomous coding system
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentEvent,
  Decision,
  ProcessingMetrics,
  ValidationResult,
  HealthCheck,
  ComponentHealth,
} from './types/events';
import { BrainConfig, defaultConfig } from './types/config';
import { EventQueue } from './core/event-queue';
import { DecisionEngine } from './core/decision-engine';
import { ContextCoordinator } from './core/context-coordinator';
import { ActionExecutor } from './core/action-executor';

export class BrainEventProcessor extends EventEmitter {
  private config: BrainConfig;
  private eventQueue: EventQueue;
  private decisionEngine: DecisionEngine;
  private contextCoordinator: ContextCoordinator;
  private actionExecutor: ActionExecutor;
  private isRunning: boolean = false;
  private startTime: number = Date.now();
  private metrics: {
    eventsProcessed: number;
    decisionsM ade: number;
    actionsExecuted: number;
    errors: number;
  };

  constructor(config: Partial<BrainConfig> = {}) {
    super();
    this.config = { ...defaultConfig, ...config };
    this.eventQueue = new EventQueue(this.config.eventQueue);
    this.decisionEngine = new DecisionEngine(this.config.decisionEngine);
    this.contextCoordinator = new ContextCoordinator(
      this.config.contextFetcher
    );
    this.actionExecutor = new ActionExecutor(this.config);
    this.metrics = {
      eventsProcessed: 0,
      decisionsMade: 0,
      actionsExecuted: 0,
      errors: 0,
    };

    this.setupEventHandlers();
  }

  /**
   * Start the brain event processor
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('Brain Event Processor is already running');
      return;
    }

    console.log('🧠 Brain Event Processor starting...');
    this.isRunning = true;
    this.startTime = Date.now();

    // Start processing events
    this.eventQueue.on('event:dequeued', (event: AgentEvent) => {
      this.processEvent(event);
    });

    console.log('✅ Brain Event Processor started');
    this.emit('brain:started');
  }

  /**
   * Stop the brain event processor
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.warn('Brain Event Processor is not running');
      return;
    }

    console.log('🧠 Brain Event Processor stopping...');
    this.isRunning = false;
    this.eventQueue.removeAllListeners();

    console.log('✅ Brain Event Processor stopped');
    this.emit('brain:stopped');
  }

  /**
   * Submit event for processing
   */
  async submitEvent(event: AgentEvent): Promise<{ event_id: string; status: string }> {
    // Validate event
    const validation = this.validateEvent(event);
    if (!validation.valid) {
      throw new Error(`Invalid event: ${validation.errors?.join(', ')}`);
    }

    // Ensure event has ID and timestamp
    if (!event.event_id) {
      event.event_id = uuidv4();
    }
    if (!event.timestamp) {
      event.timestamp = new Date().toISOString();
    }

    // Enqueue event
    await this.eventQueue.enqueue(event);

    this.emit('event:submitted', event);

    return {
      event_id: event.event_id,
      status: 'queued',
    };
  }

  /**
   * Validate event structure
   */
  private validateEvent(event: AgentEvent): ValidationResult {
    const errors: string[] = [];

    if (!event.session_id) {
      errors.push('Missing session_id');
    }
    if (!event.event_type) {
      errors.push('Missing event_type');
    }
    if (!event.payload) {
      errors.push('Missing payload');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Process single event
   */
  private async processEvent(event: AgentEvent): Promise<void> {
    const processingStart = Date.now();
    let contextFetchMs = 0;
    let decisionMs = 0;
    let actionExecutionMs = 0;
    let persistenceMs = 0;

    try {
      console.log(`Processing event: ${event.event_id} (${event.event_type})`);

      // Phase 1: Gather context
      const contextStart = Date.now();
      const context = await this.contextCoordinator.gatherContext(event);
      contextFetchMs = Date.now() - contextStart;

      // Phase 2: Make decision
      const decisionStart = Date.now();
      const sessionState = this.getSessionState(event.session_id);
      const systemState = this.getSystemState();
      const decision = await this.decisionEngine.makeDecision(
        event,
        context,
        sessionState,
        systemState
      );
      decisionMs = Date.now() - decisionStart;

      this.metrics.decisionsMade++;
      this.emit('decision:made', decision);

      console.log(
        `Decision: ${decision.decision_type} (confidence: ${decision.confidence_score})`
      );

      // Phase 3: Execute actions if confidence meets threshold
      let actionOutcomes = [];
      if (
        decision.confidence_score >=
        this.config.decisionEngine.autoExecuteThreshold
      ) {
        const actionStart = Date.now();
        actionOutcomes = await this.actionExecutor.executeActions(decision);
        actionExecutionMs = Date.now() - actionStart;

        this.metrics.actionsExecuted += actionOutcomes.length;
        this.emit('actions:executed', actionOutcomes);

        console.log(`Executed ${actionOutcomes.length} actions`);
      } else if (
        decision.confidence_score <
        this.config.decisionEngine.escalateThreshold
      ) {
        console.log(
          `Low confidence (${decision.confidence_score}), escalating...`
        );
        this.emit('decision:escalated', decision);
      }

      // Phase 4: Persist state (always)
      const persistenceStart = Date.now();
      // TODO: Coordinate with Context Updater to persist
      persistenceMs = Date.now() - persistenceStart;

      // Track metrics
      const metrics: ProcessingMetrics = {
        event_id: event.event_id,
        processing_start: new Date(processingStart).toISOString(),
        processing_end: new Date().toISOString(),
        duration_ms: Date.now() - processingStart,
        context_fetch_ms: contextFetchMs,
        decision_ms: decisionMs,
        action_execution_ms: actionExecutionMs,
        persistence_ms: persistenceMs,
      };

      this.metrics.eventsProcessed++;
      this.emit('event:processed', { event, decision, metrics });

      console.log(
        `Event processed: ${event.event_id} (${metrics.duration_ms}ms)`
      );
    } catch (error: any) {
      this.metrics.errors++;
      console.error(`Error processing event ${event.event_id}:`, error);
      this.emit('event:error', { event, error });
    }
  }

  /**
   * Get session state (mock implementation)
   */
  private getSessionState(sessionId: string): any {
    // TODO: Fetch from database or cache
    return {
      session_id: sessionId,
      agent_name: 'Unknown',
      status: 'active',
      started_at: new Date().toISOString(),
      metadata: {},
    };
  }

  /**
   * Get system state
   */
  private getSystemState(): any {
    return {
      active_sessions: this.actionExecutor.getActiveAgents().size,
      queue_depth: this.eventQueue.getDepth(),
      system_load: 0.5, // TODO: Calculate actual load
      available_resources: {
        cpu: 1.0,
        memory: 1.0,
      },
    };
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.eventQueue.on('event:enqueued', (event) => {
      console.log(`Event enqueued: ${event.event_id}`);
    });

    this.eventQueue.on('queue:processing:start', () => {
      console.log('Queue processing started');
    });

    this.eventQueue.on('queue:processing:end', () => {
      console.log('Queue processing ended');
    });
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<HealthCheck> {
    const components: ComponentHealth[] = [
      {
        name: 'event_queue',
        status: this.eventQueue.getDepth() < this.config.eventQueue.maxSize * 0.9
          ? 'healthy'
          : 'degraded',
        last_check: new Date().toISOString(),
        details: this.eventQueue.getStatus(),
      },
      {
        name: 'decision_engine',
        status: 'healthy',
        last_check: new Date().toISOString(),
        details: {
          rules_count: this.decisionEngine.getRules().length,
        },
      },
      {
        name: 'context_coordinator',
        status: 'healthy',
        last_check: new Date().toISOString(),
        details: this.contextCoordinator.getCacheStats(),
      },
      {
        name: 'action_executor',
        status: this.actionExecutor.isAtMaxConcurrentAgents()
          ? 'degraded'
          : 'healthy',
        last_check: new Date().toISOString(),
        details: {
          active_agents: this.actionExecutor.getActiveAgents().size,
          max_concurrent: this.config.agentSpawning.maxConcurrent,
        },
      },
    ];

    const unhealthyComponents = components.filter(
      (c) => c.status === 'unhealthy'
    );
    const degradedComponents = components.filter(
      (c) => c.status === 'degraded'
    );

    const overallStatus =
      unhealthyComponents.length > 0
        ? 'unhealthy'
        : degradedComponents.length > 0
        ? 'degraded'
        : 'healthy';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      components,
      metrics: {
        uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
        events_processed: this.metrics.eventsProcessed,
        queue_depth: this.eventQueue.getDepth(),
        active_sessions: this.actionExecutor.getActiveAgents().size,
      },
    };
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      queue_depth: this.eventQueue.getDepth(),
      active_agents: this.actionExecutor.getActiveAgents().size,
    };
  }

  /**
   * Get event queue
   */
  getEventQueue(): EventQueue {
    return this.eventQueue;
  }

  /**
   * Get decision engine
   */
  getDecisionEngine(): DecisionEngine {
    return this.decisionEngine;
  }
}
