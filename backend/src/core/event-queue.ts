/**
 * Multi-Claude 3.0 - Event Queue Manager
 * Priority-based event queue with backpressure handling
 */

import { AgentEvent } from '../types/events';
import { BrainConfig } from '../types/config';
import { EventEmitter } from 'events';

export class EventQueue extends EventEmitter {
  private queue: AgentEvent[] = [];
  private processing = false;
  private config: BrainConfig['eventQueue'];

  constructor(config: BrainConfig['eventQueue']) {
    super();
    this.config = config;
  }

  /**
   * Add event to queue
   */
  async enqueue(event: AgentEvent): Promise<void> {
    if (this.queue.length >= this.config.maxSize) {
      throw new Error(`Queue full: ${this.queue.length}/${this.config.maxSize}`);
    }

    // Ensure event has priority (default to 5)
    if (!event.priority) {
      event.priority = 5;
    }

    // Insert event in priority order (higher priority first)
    const insertIndex = this.queue.findIndex(
      (e) => (e.priority || 5) < event.priority!
    );

    if (insertIndex === -1) {
      this.queue.push(event);
    } else {
      this.queue.splice(insertIndex, 0, event);
    }

    this.emit('event:enqueued', event);

    // Start processing if not already processing
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Dequeue next event
   */
  dequeue(): AgentEvent | undefined {
    const event = this.queue.shift();
    if (event) {
      this.emit('event:dequeued', event);
    }
    return event;
  }

  /**
   * Dequeue batch of events
   */
  dequeueBatch(size?: number): AgentEvent[] {
    const batchSize = size || this.config.batchSize;
    const batch = this.queue.splice(0, Math.min(batchSize, this.queue.length));
    batch.forEach((event) => this.emit('event:dequeued', event));
    return batch;
  }

  /**
   * Get queue depth
   */
  getDepth(): number {
    return this.queue.length;
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      depth: this.queue.length,
      maxSize: this.config.maxSize,
      utilization: (this.queue.length / this.config.maxSize) * 100,
      processing: this.processing,
    };
  }

  /**
   * Clear queue
   */
  clear(): void {
    this.queue = [];
    this.emit('queue:cleared');
  }

  /**
   * Process queue
   */
  private async processQueue(): Promise<void> {
    this.processing = true;
    this.emit('queue:processing:start');

    while (this.queue.length > 0) {
      const event = this.dequeue();
      if (event) {
        this.emit('event:processing', event);
      }
    }

    this.processing = false;
    this.emit('queue:processing:end');
  }

  /**
   * Find event by ID
   */
  findById(eventId: string): AgentEvent | undefined {
    return this.queue.find((e) => e.event_id === eventId);
  }

  /**
   * Remove event from queue
   */
  remove(eventId: string): boolean {
    const index = this.queue.findIndex((e) => e.event_id === eventId);
    if (index !== -1) {
      this.queue.splice(index, 1);
      this.emit('event:removed', eventId);
      return true;
    }
    return false;
  }

  /**
   * Get events by session
   */
  getBySession(sessionId: string): AgentEvent[] {
    return this.queue.filter((e) => e.session_id === sessionId);
  }

  /**
   * Deduplicate events
   */
  deduplicate(): number {
    const seen = new Set<string>();
    const originalLength = this.queue.length;

    this.queue = this.queue.filter((event) => {
      const key = `${event.session_id}:${event.event_type}:${JSON.stringify(
        event.payload
      )}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });

    const removed = originalLength - this.queue.length;
    if (removed > 0) {
      this.emit('queue:deduplicated', removed);
    }
    return removed;
  }
}
