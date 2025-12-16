/**
 * Async Event Processing Worker
 * Processes events through the complete 5-stage pipeline
 */

import { EventEmitter } from 'events';
import { AgentEvent, ProcessingMetrics } from '../types/events.js';
import {
  db,
  SessionsRepository,
  EventsRepository,
  DecisionsRepository,
} from '../database/index.js';

interface ProcessingStage {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: Error;
}

interface ProcessingJob {
  event: AgentEvent;
  stages: {
    reception: ProcessingStage;
    contextFetch: ProcessingStage;
    decision: ProcessingStage;
    execution: ProcessingStage;
    persistence: ProcessingStage;
  };
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  status: 'processing' | 'completed' | 'failed';
  error?: Error;
}

export interface WorkerConfig {
  concurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
  processingTimeout?: number;
}

export class EventProcessorWorker extends EventEmitter {
  private isRunning: boolean = false;
  private activeJobs: Map<string, ProcessingJob> = new Map();
  private config: Required<WorkerConfig>;
  private sessionsRepo: SessionsRepository;
  private eventsRepo: EventsRepository;
  private decisionsRepo: DecisionsRepository;

  // Statistics
  private stats = {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    averageDuration: 0,
  };

  constructor(config: WorkerConfig = {}) {
    super();
    this.config = {
      concurrency: config.concurrency || 5,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      processingTimeout: config.processingTimeout || 30000,
    };

    this.sessionsRepo = new SessionsRepository();
    this.eventsRepo = new EventsRepository();
    this.decisionsRepo = new DecisionsRepository();
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Worker already running');
      return;
    }

    this.isRunning = true;
    console.log('🔄 Event Processing Worker started');
    console.log(`   Concurrency: ${this.config.concurrency}`);
    console.log(`   Retry attempts: ${this.config.retryAttempts}`);
    console.log(`   Processing timeout: ${this.config.processingTimeout}ms`);

    this.emit('worker:started');
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🛑 Event Processing Worker stopping...');
    this.isRunning = false;

    // Wait for active jobs to complete
    const activeJobIds = Array.from(this.activeJobs.keys());
    if (activeJobIds.length > 0) {
      console.log(`   Waiting for ${activeJobIds.length} active jobs to complete...`);
      await this.waitForActiveJobs();
    }

    console.log('✓ Event Processing Worker stopped');
    this.emit('worker:stopped');
  }

  /**
   * Process an event through the complete pipeline
   */
  async processEvent(event: AgentEvent): Promise<void> {
    // Check concurrency limit
    while (this.activeJobs.size >= this.config.concurrency) {
      await this.sleep(100);
    }

    if (!this.isRunning) {
      throw new Error('Worker is not running');
    }

    // Create processing job
    const job: ProcessingJob = {
      event,
      stages: {
        reception: { name: 'Reception', startTime: Date.now(), status: 'completed' },
        contextFetch: { name: 'Context Fetch', startTime: 0, status: 'pending' },
        decision: { name: 'Decision', startTime: 0, status: 'pending' },
        execution: { name: 'Execution', startTime: 0, status: 'pending' },
        persistence: { name: 'Persistence', startTime: 0, status: 'pending' },
      },
      startTime: Date.now(),
      status: 'processing',
    };

    this.activeJobs.set(event.event_id, job);
    this.emit('job:started', { event_id: event.event_id });

    try {
      // Process through pipeline
      await this.runPipeline(job);

      // Mark as completed
      job.endTime = Date.now();
      job.totalDuration = job.endTime - job.startTime;
      job.status = 'completed';

      // Update statistics
      this.updateStats(true, job.totalDuration);

      this.emit('job:completed', {
        event_id: event.event_id,
        duration: job.totalDuration,
      });

      console.log(`✓ Event ${event.event_id} processed in ${job.totalDuration}ms`);
    } catch (error: any) {
      job.endTime = Date.now();
      job.totalDuration = job.endTime - job.startTime;
      job.status = 'failed';
      job.error = error;

      // Update statistics
      this.updateStats(false, job.totalDuration);

      this.emit('job:failed', {
        event_id: event.event_id,
        error: error.message,
        duration: job.totalDuration,
      });

      console.error(`✗ Event ${event.event_id} failed:`, error.message);
    } finally {
      this.activeJobs.delete(event.event_id);
    }
  }

  /**
   * Run the complete processing pipeline
   */
  private async runPipeline(job: ProcessingJob): Promise<void> {
    const { event } = job;

    try {
      // Stage 1: Already completed (reception)
      this.emit('stage:completed', { event_id: event.event_id, stage: 'reception' });

      // Stage 2: Context Fetching
      await this.runStage(job, 'contextFetch', async () => {
        return await this.fetchContext(event);
      });

      // Stage 3: Decision Making
      const decision = await this.runStage(job, 'decision', async () => {
        return await this.makeDecision(event, job.stages.contextFetch);
      });

      // Stage 4: Action Execution
      const outcomes = await this.runStage(job, 'execution', async () => {
        return await this.executeActions(event, decision);
      });

      // Stage 5: Context Updating (Persistence)
      await this.runStage(job, 'persistence', async () => {
        return await this.persistResults(event, decision, outcomes, job);
      });
    } catch (error: any) {
      // Update event status to failed
      try {
        await this.eventsRepo.updateStatus(event.event_id, 'failed', error.message);
      } catch (dbError) {
        console.error('Failed to update event status:', dbError);
      }
      throw error;
    }
  }

  /**
   * Run a single pipeline stage
   */
  private async runStage<T>(
    job: ProcessingJob,
    stageName: keyof ProcessingJob['stages'],
    handler: () => Promise<T>
  ): Promise<T> {
    const stage = job.stages[stageName];
    stage.startTime = Date.now();
    stage.status = 'in_progress';

    this.emit('stage:started', {
      event_id: job.event.event_id,
      stage: stageName,
    });

    try {
      const result = await handler();

      stage.endTime = Date.now();
      stage.duration = stage.endTime - stage.startTime;
      stage.status = 'completed';

      this.emit('stage:completed', {
        event_id: job.event.event_id,
        stage: stageName,
        duration: stage.duration,
      });

      return result;
    } catch (error: any) {
      stage.endTime = Date.now();
      stage.duration = stage.endTime - stage.startTime;
      stage.status = 'failed';
      stage.error = error;

      this.emit('stage:failed', {
        event_id: job.event.event_id,
        stage: stageName,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Stage 2: Fetch Context
   */
  private async fetchContext(event: AgentEvent): Promise<any> {
    // Create event record in database first (required for foreign key constraints)
    try {
      const existingEvent = await this.eventsRepo.findById(event.event_id);
      if (!existingEvent) {
        await this.eventsRepo.create({
          session_id: event.session_id,
          event_type: event.event_type,
          event_category: event.event_category,
          payload: event.payload,
          context: event.context,
        });
      }
    } catch (error) {
      console.warn('Failed to create event record:', error);
    }

    // For now, return mock context
    // In full implementation, this would call the Context Fetcher agent
    return {
      session: {
        session_id: event.session_id,
        status: 'active',
      },
      recentEvents: [],
      agentHistory: [],
      systemState: {
        active_sessions: this.activeJobs.size,
        queue_depth: 0,
      },
    };
  }

  /**
   * Stage 3: Make Decision
   */
  private async makeDecision(event: AgentEvent, contextStage: ProcessingStage): Promise<any> {
    // Simple decision based on event type
    const decision: any = {
      decision_id: `decision-${Date.now()}`,
      decision_type: 'persist_state',
      confidence_score: 0.95,
      actions: [
        {
          type: 'log',
          message: `Processing event: ${event.event_type}`,
        },
      ],
      rationale: `Event ${event.event_type} requires state persistence`,
    };

    // Persist decision to database
    try {
      await this.decisionsRepo.create({
        event_id: event.event_id,
        session_id: event.session_id,
        decision_type: decision.decision_type,
        context: { event_type: event.event_type },
        rationale: decision.rationale,
        actions: decision.actions,
        confidence_score: decision.confidence_score,
      });
    } catch (error) {
      console.warn('Failed to persist decision:', error);
    }

    return decision;
  }

  /**
   * Stage 4: Execute Actions
   */
  private async executeActions(event: AgentEvent, decision: any): Promise<any[]> {
    const outcomes: any[] = [];

    for (const action of decision.actions) {
      const startTime = Date.now();

      try {
        let result: any = null;

        switch (action.type) {
          case 'log':
            console.log(`📝 Action: ${action.message}`);
            result = { logged: true };
            break;

          case 'spawn_agent':
            console.log(`🚀 Action: Spawn agent ${action.agent_type}`);
            result = { spawned: true, agent_type: action.agent_type };
            break;

          case 'persist_state':
            console.log('💾 Action: Persist state');
            result = { persisted: true };
            break;

          default:
            console.log(`❓ Unknown action type: ${action.type}`);
            result = { unknown: true };
        }

        outcomes.push({
          action,
          status: 'success',
          result,
          duration_ms: Date.now() - startTime,
        });
      } catch (error: any) {
        outcomes.push({
          action,
          status: 'failed',
          error: error.message,
          duration_ms: Date.now() - startTime,
        });
      }
    }

    return outcomes;
  }

  /**
   * Stage 5: Persist Results
   */
  private async persistResults(
    event: AgentEvent,
    decision: any,
    outcomes: any[],
    job: ProcessingJob
  ): Promise<void> {
    try {
      // Create event record if it doesn't exist
      const existingEvent = await this.eventsRepo.findById(event.event_id);

      if (!existingEvent) {
        await this.eventsRepo.create({
          session_id: event.session_id,
          event_type: event.event_type,
          event_category: event.event_category,
          payload: event.payload,
          context: event.context,
        });
      }

      // Update event status to processed
      await this.eventsRepo.updateStatus(event.event_id, 'processed');

      // Calculate metrics
      const metrics: ProcessingMetrics = {
        event_id: event.event_id,
        processing_start: new Date(job.startTime).toISOString(),
        processing_end: new Date().toISOString(),
        duration_ms: Date.now() - job.startTime,
        context_fetch_ms: job.stages.contextFetch.duration || 0,
        decision_ms: job.stages.decision.duration || 0,
        action_execution_ms: job.stages.execution.duration || 0,
        persistence_ms: job.stages.persistence.duration || 0,
      };

      console.log(`💾 Persisted event ${event.event_id} with metrics:`, {
        total: metrics.duration_ms,
        context: metrics.context_fetch_ms,
        decision: metrics.decision_ms,
        execution: metrics.action_execution_ms,
      });
    } catch (error: any) {
      console.error('Failed to persist results:', error.message);
      throw error;
    }
  }

  /**
   * Update statistics
   */
  private updateStats(success: boolean, duration: number): void {
    this.stats.totalProcessed++;
    if (success) {
      this.stats.successful++;
    } else {
      this.stats.failed++;
    }

    // Update average duration
    this.stats.averageDuration =
      (this.stats.averageDuration * (this.stats.totalProcessed - 1) + duration) /
      this.stats.totalProcessed;
  }

  /**
   * Get worker statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeJobs: this.activeJobs.size,
      successRate:
        this.stats.totalProcessed > 0
          ? (this.stats.successful / this.stats.totalProcessed) * 100
          : 0,
    };
  }

  /**
   * Get active jobs
   */
  getActiveJobs(): ProcessingJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Wait for active jobs to complete
   */
  private async waitForActiveJobs(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (this.activeJobs.size > 0) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for active jobs to complete');
      }
      await this.sleep(100);
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if worker is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}
