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
} from './types/events.js';
import { BrainConfig, defaultConfig } from './types/config.js';
import { EventQueue } from './core/event-queue.js';
import { DecisionEngine } from './core/decision-engine.js';
import { ContextCoordinator } from './core/context-coordinator.js';
import { ActionExecutor } from './core/action-executor.js';
import { EventProcessorWorker } from './workers/event-processor-worker.js';
import { ContextUpdater } from './agents/context-updater.js';

export class BrainEventProcessor extends EventEmitter {
  private config: BrainConfig;
  private eventQueue: EventQueue;
  private decisionEngine: DecisionEngine;
  private contextCoordinator: ContextCoordinator;
  private actionExecutor: ActionExecutor;
  private contextUpdater: ContextUpdater | null = null;
  private worker: EventProcessorWorker;
  private isRunning: boolean = false;
  private startTime: number = Date.now();
  private metrics: {
    eventsProcessed: number;
    decisionsMade: number;
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

    // Initialize Context Updater if database URL is available
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl) {
      this.contextUpdater = new ContextUpdater(databaseUrl);
    }

    this.actionExecutor = new ActionExecutor(this.config, this.contextUpdater || undefined);
    this.worker = new EventProcessorWorker({
      concurrency: 5,
      retryAttempts: 3,
      processingTimeout: 30000,
    });
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

    // Connect Context Updater to database
    if (this.contextUpdater) {
      try {
        await this.contextUpdater.connect();
      } catch (error: any) {
        console.error('Failed to connect Context Updater:', error.message);
        console.warn('Continuing without database persistence');
      }
    } else {
      console.warn('Context Updater not initialized (DATABASE_URL not set)');
    }

    // Start the async worker
    await this.worker.start();

    // Start processing events from queue
    this.eventQueue.on('event:dequeued', (event: AgentEvent) => {
      // Process event asynchronously through worker
      this.worker.processEvent(event).catch((error) => {
        console.error(`Failed to process event ${event.event_id}:`, error);
        this.metrics.errors++;
      });
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

    // Stop the worker
    await this.worker.stop();

    // Disconnect Context Updater from database
    if (this.contextUpdater) {
      try {
        await this.contextUpdater.disconnect();
      } catch (error: any) {
        console.error('Failed to disconnect Context Updater:', error.message);
      }
    }

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
      let actionOutcomes: any[] = [];
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

      // Track metrics first so we can include persistence time
      const metrics: ProcessingMetrics = {
        event_id: event.event_id,
        processing_start: new Date(processingStart).toISOString(),
        processing_end: new Date().toISOString(),
        duration_ms: Date.now() - processingStart,
        context_fetch_ms: contextFetchMs,
        decision_ms: decisionMs,
        action_execution_ms: actionExecutionMs,
        persistence_ms: 0, // Will be updated below
      };

      // Persist using Context Updater
      if (this.contextUpdater) {
        try {
          await this.contextUpdater.persistProcessingResults({
            event_data: event,
            processing_results: decision,
            action_outcomes: actionOutcomes,
            metrics,
          });
          console.log(`✓ Persisted event ${event.event_id} to database`);
        } catch (error: any) {
          console.error(`Failed to persist event ${event.event_id}:`, error.message);
        }
      }

      persistenceMs = Date.now() - persistenceStart;
      metrics.persistence_ms = persistenceMs;

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
   * Setup worker event handlers
   */
  private setupWorkerHandlers(): void {
    // Worker lifecycle events
    this.worker.on('worker:started', () => {
      console.log('✓ Event Processing Worker started');
    });

    this.worker.on('worker:stopped', () => {
      console.log('✓ Event Processing Worker stopped');
    });

    // Job lifecycle events
    this.worker.on('job:started', (data: { event_id: string }) => {
      console.log(`🔄 Job started: ${data.event_id}`);
    });

    this.worker.on('job:completed', (data: { event_id: string; duration: number }) => {
      console.log(`✓ Job completed: ${data.event_id} (${data.duration}ms)`);
      this.metrics.eventsProcessed++;
    });

    this.worker.on('job:failed', (data: { event_id: string; error: string; duration: number }) => {
      console.error(`✗ Job failed: ${data.event_id} - ${data.error}`);
      this.metrics.errors++;
    });

    // Stage events
    this.worker.on('stage:started', (data: { event_id: string; stage: string }) => {
      console.log(`  ▶ Stage started: ${data.stage} (${data.event_id})`);
    });

    this.worker.on('stage:completed', (data: { event_id: string; stage: string; duration?: number }) => {
      console.log(`  ✓ Stage completed: ${data.stage} (${data.duration}ms)`);
    });

    this.worker.on('stage:failed', (data: { event_id: string; stage: string; error: string }) => {
      console.error(`  ✗ Stage failed: ${data.stage} - ${data.error}`);
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
        name: 'context_updater',
        status: this.contextUpdater
          ? (this.contextUpdater.isHealthy() ? 'healthy' : 'unhealthy')
          : 'degraded',
        last_check: new Date().toISOString(),
        details: {
          connected: this.contextUpdater ? this.contextUpdater.isHealthy() : false,
          database_url_set: !!process.env.DATABASE_URL,
          note: this.contextUpdater ? undefined : 'Context Updater not initialized (DATABASE_URL not set)',
        },
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
      {
        name: 'event_processor_worker',
        status: this.worker.isActive() ? 'healthy' : 'unhealthy',
        last_check: new Date().toISOString(),
        details: this.worker.getStats(),
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
    const workerStats = this.worker.getStats();
    return {
      ...this.metrics,
      uptime_seconds: Math.floor((Date.now() - this.startTime) / 1000),
      queue_depth: this.eventQueue.getDepth(),
      active_agents: this.actionExecutor.getActiveAgents().size,
      worker: {
        total_processed: workerStats.totalProcessed,
        successful: workerStats.successful,
        failed: workerStats.failed,
        success_rate: workerStats.successRate,
        average_duration: workerStats.averageDuration,
        active_jobs: workerStats.activeJobs,
      },
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
