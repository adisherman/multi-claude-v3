/**
 * EventQueue Unit Tests
 * Tests priority-based event queue with backpressure handling
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EventQueue } from '../../core/event-queue.js';
import { AgentEvent } from '../../types/events.js';
import { BrainConfig } from '../../types/config.js';

describe('EventQueue', () => {
  let queue: EventQueue;
  let mockConfig: BrainConfig['eventQueue'];
  let mockEvent: AgentEvent;

  beforeEach(() => {
    mockConfig = {
      maxSize: 100,
      batchSize: 10,
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

    queue = new EventQueue(mockConfig);
    jest.clearAllMocks();
  });

  // Helper to add events without triggering processing
  const addEventDirectly = async (event: AgentEvent) => {
    // Use dequeue to prevent processing, then manually manage queue
    const enqueueSpy = jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});
    await queue.enqueue(event);
    enqueueSpy.mockRestore();
  };

  describe('Initialization', () => {
    it('should initialize with config', () => {
      expect(queue).toBeDefined();
      expect(queue.getDepth()).toBe(0);
    });

    it('should start with empty queue', () => {
      const status = queue.getStatus();
      expect(status.depth).toBe(0);
      expect(status.maxSize).toBe(100);
      expect(status.utilization).toBe(0);
      expect(status.processing).toBe(false);
    });
  });

  describe('Enqueue Operations', () => {
    it('should enqueue event and process automatically', async () => {
      const processingSpy = jest.fn();
      queue.on('event:processing', processingSpy);

      await queue.enqueue(mockEvent);

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(processingSpy).toHaveBeenCalledWith(mockEvent);
      expect(queue.getDepth()).toBe(0);
    });

    it('should emit event:enqueued when adding event', async () => {
      const enqueuedSpy = jest.fn();
      queue.on('event:enqueued', enqueuedSpy);

      await queue.enqueue(mockEvent);

      expect(enqueuedSpy).toHaveBeenCalledWith(mockEvent);
    });

    it('should add default priority if not specified', async () => {
      const processQueueSpy = jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});

      const eventNoPriority = { ...mockEvent };
      delete eventNoPriority.priority;

      await queue.enqueue(eventNoPriority);

      const found = queue.findById(mockEvent.event_id);
      expect(found?.priority).toBe(5);

      processQueueSpy.mockRestore();
    });

    it('should throw error when queue is full', async () => {
      const smallQueue = new EventQueue({ maxSize: 2, batchSize: 1 });
      const processQueueSpy = jest.spyOn(smallQueue as any, 'processQueue').mockImplementation(() => {});

      await smallQueue.enqueue({ ...mockEvent, event_id: 'event-1' });
      await smallQueue.enqueue({ ...mockEvent, event_id: 'event-2' });

      await expect(
        smallQueue.enqueue({ ...mockEvent, event_id: 'event-3' })
      ).rejects.toThrow('Queue full: 2/2');

      processQueueSpy.mockRestore();
    });

    it('should handle multiple enqueue operations', async () => {
      const processQueueSpy = jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});

      await queue.enqueue({ ...mockEvent, event_id: 'event-1' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-3' });

      expect(queue.getDepth()).toBe(3);

      processQueueSpy.mockRestore();
    });
  });

  describe('Priority Handling', () => {
    beforeEach(() => {
      // Disable auto-processing for priority tests
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});
    });

    it('should order events by priority (highest first)', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'low', priority: 3 });
      await queue.enqueue({ ...mockEvent, event_id: 'high', priority: 9 });
      await queue.enqueue({ ...mockEvent, event_id: 'medium', priority: 5 });

      const first = queue.dequeue();
      const second = queue.dequeue();
      const third = queue.dequeue();

      expect(first?.event_id).toBe('high');
      expect(second?.event_id).toBe('medium');
      expect(third?.event_id).toBe('low');
    });

    it('should insert high priority events at the front', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'normal-1', priority: 5 });
      await queue.enqueue({ ...mockEvent, event_id: 'normal-2', priority: 5 });
      await queue.enqueue({ ...mockEvent, event_id: 'urgent', priority: 10 });

      const first = queue.dequeue();
      expect(first?.event_id).toBe('urgent');
    });

    it('should maintain FIFO order for same priority', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'first', priority: 5 });
      await queue.enqueue({ ...mockEvent, event_id: 'second', priority: 5 });
      await queue.enqueue({ ...mockEvent, event_id: 'third', priority: 5 });

      const first = queue.dequeue();
      const second = queue.dequeue();
      const third = queue.dequeue();

      expect(first?.event_id).toBe('first');
      expect(second?.event_id).toBe('second');
      expect(third?.event_id).toBe('third');
    });

    it('should handle priority edge cases', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'min', priority: 1 });
      await queue.enqueue({ ...mockEvent, event_id: 'max', priority: 10 });
      await queue.enqueue({ ...mockEvent, event_id: 'default', priority: 5 });

      const first = queue.dequeue();
      expect(first?.event_id).toBe('max');
    });
  });

  describe('Dequeue Operations', () => {
    beforeEach(() => {
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});
    });

    it('should dequeue event successfully', async () => {
      await queue.enqueue(mockEvent);
      const event = queue.dequeue();

      expect(event).toBeDefined();
      expect(event?.event_id).toBe(mockEvent.event_id);
      expect(queue.getDepth()).toBe(0);
    });

    it('should return undefined when dequeuing from empty queue', () => {
      const event = queue.dequeue();
      expect(event).toBeUndefined();
    });

    it('should emit event:dequeued when removing event', async () => {
      const dequeuedSpy = jest.fn();
      queue.on('event:dequeued', dequeuedSpy);

      await queue.enqueue(mockEvent);
      queue.dequeue();

      expect(dequeuedSpy).toHaveBeenCalledWith(mockEvent);
    });

    it('should not emit event:dequeued when queue is empty', () => {
      const dequeuedSpy = jest.fn();
      queue.on('event:dequeued', dequeuedSpy);

      queue.dequeue();

      expect(dequeuedSpy).not.toHaveBeenCalled();
    });
  });

  describe('Batch Dequeue Operations', () => {
    beforeEach(async () => {
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});

      // Add 20 events to queue
      for (let i = 0; i < 20; i++) {
        await queue.enqueue({ ...mockEvent, event_id: `event-${i}` });
      }
    });

    it('should dequeue batch of events', () => {
      const batch = queue.dequeueBatch(5);

      expect(batch).toHaveLength(5);
      expect(queue.getDepth()).toBe(15);
    });

    it('should use configured batch size if not specified', () => {
      const batch = queue.dequeueBatch();

      expect(batch).toHaveLength(mockConfig.batchSize);
      expect(queue.getDepth()).toBe(10);
    });

    it('should not exceed queue size when dequeuing batch', async () => {
      const smallQueue = new EventQueue({ maxSize: 100, batchSize: 10 });
      jest.spyOn(smallQueue as any, 'processQueue').mockImplementation(() => {});

      await smallQueue.enqueue({ ...mockEvent, event_id: 'event-1' });
      await smallQueue.enqueue({ ...mockEvent, event_id: 'event-2' });
      await smallQueue.enqueue({ ...mockEvent, event_id: 'event-3' });

      const batch = smallQueue.dequeueBatch(10);

      expect(batch).toHaveLength(3);
      expect(smallQueue.getDepth()).toBe(0);
    });

    it('should emit event:dequeued for each batch item', () => {
      const dequeuedSpy = jest.fn();
      queue.on('event:dequeued', dequeuedSpy);

      queue.dequeueBatch(5);

      expect(dequeuedSpy).toHaveBeenCalledTimes(5);
    });

    it('should return empty array when queue is empty', () => {
      queue.clear();
      const batch = queue.dequeueBatch(10);

      expect(batch).toEqual([]);
      expect(batch).toHaveLength(0);
    });
  });

  describe('Queue Status and Depth', () => {
    beforeEach(() => {
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});
    });

    it('should return accurate queue depth', async () => {
      expect(queue.getDepth()).toBe(0);

      await queue.enqueue({ ...mockEvent, event_id: 'event-1' });
      expect(queue.getDepth()).toBe(1);

      await queue.enqueue({ ...mockEvent, event_id: 'event-2' });
      expect(queue.getDepth()).toBe(2);

      queue.dequeue();
      expect(queue.getDepth()).toBe(1);
    });

    it('should return complete queue status', async () => {
      await queue.enqueue(mockEvent);

      const status = queue.getStatus();

      expect(status.depth).toBe(1);
      expect(status.maxSize).toBe(100);
      expect(status.utilization).toBe(1);
      expect(status.processing).toBe(false);
    });

    it('should calculate utilization percentage correctly', async () => {
      const smallQueue = new EventQueue({ maxSize: 10, batchSize: 5 });
      jest.spyOn(smallQueue as any, 'processQueue').mockImplementation(() => {});

      await smallQueue.enqueue({ ...mockEvent, event_id: 'event-1' });
      await smallQueue.enqueue({ ...mockEvent, event_id: 'event-2' });
      await smallQueue.enqueue({ ...mockEvent, event_id: 'event-3' });

      const status = smallQueue.getStatus();
      expect(status.utilization).toBe(30); // 3/10 * 100
    });
  });

  describe('Clear Queue', () => {
    beforeEach(() => {
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});
    });

    it('should clear all events from queue', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'event-1' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-3' });

      expect(queue.getDepth()).toBe(3);

      queue.clear();

      expect(queue.getDepth()).toBe(0);
    });

    it('should emit queue:cleared event', async () => {
      const clearedSpy = jest.fn();
      queue.on('queue:cleared', clearedSpy);

      await queue.enqueue(mockEvent);
      queue.clear();

      expect(clearedSpy).toHaveBeenCalled();
    });
  });

  describe('Queue Processing', () => {
    it('should start processing when events are enqueued', async () => {
      const processStartSpy = jest.fn();
      const processEndSpy = jest.fn();

      queue.on('queue:processing:start', processStartSpy);
      queue.on('queue:processing:end', processEndSpy);

      await queue.enqueue(mockEvent);

      // Wait for processing to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(processStartSpy).toHaveBeenCalled();
      expect(processEndSpy).toHaveBeenCalled();
    });

    it('should emit event:processing for each event', async () => {
      const processingSpy = jest.fn();
      queue.on('event:processing', processingSpy);

      await queue.enqueue({ ...mockEvent, event_id: 'event-1' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2' });

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(processingSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Find Event', () => {
    beforeEach(() => {
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});
    });

    it('should find event by ID', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'event-1' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-3' });

      const found = queue.findById('event-2');

      expect(found).toBeDefined();
      expect(found?.event_id).toBe('event-2');
    });

    it('should return undefined if event not found', () => {
      const found = queue.findById('non-existent');
      expect(found).toBeUndefined();
    });

    it('should find events from same session', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'event-1', session_id: 'session-1' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2', session_id: 'session-2' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-3', session_id: 'session-1' });

      const events = queue.getBySession('session-1');

      expect(events).toHaveLength(2);
      expect(events[0].event_id).toBe('event-1');
      expect(events[1].event_id).toBe('event-3');
    });

    it('should return empty array for session with no events', () => {
      const events = queue.getBySession('non-existent-session');
      expect(events).toEqual([]);
    });
  });

  describe('Remove Event', () => {
    beforeEach(() => {
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});
    });

    it('should remove event by ID', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'event-1' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-3' });

      const removed = queue.remove('event-2');

      expect(removed).toBe(true);
      expect(queue.getDepth()).toBe(2);
      expect(queue.findById('event-2')).toBeUndefined();
    });

    it('should return false when removing non-existent event', () => {
      const removed = queue.remove('non-existent');
      expect(removed).toBe(false);
    });

    it('should emit event:removed when event is removed', async () => {
      const removedSpy = jest.fn();
      queue.on('event:removed', removedSpy);

      await queue.enqueue(mockEvent);
      queue.remove(mockEvent.event_id);

      expect(removedSpy).toHaveBeenCalledWith(mockEvent.event_id);
    });

    it('should not emit event:removed when event not found', () => {
      const removedSpy = jest.fn();
      queue.on('event:removed', removedSpy);

      queue.remove('non-existent');

      expect(removedSpy).not.toHaveBeenCalled();
    });
  });

  describe('Deduplication', () => {
    beforeEach(() => {
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});
    });

    it('should deduplicate identical events', async () => {
      const event1 = { ...mockEvent, event_id: 'event-1' };
      const event2 = { ...mockEvent, event_id: 'event-2' }; // Same session, type, payload
      const event3 = { ...mockEvent, event_id: 'event-3' };

      await queue.enqueue(event1);
      await queue.enqueue(event2);
      await queue.enqueue(event3);

      const removed = queue.deduplicate();

      expect(removed).toBe(2); // 2 duplicates removed
      expect(queue.getDepth()).toBe(1);
    });

    it('should keep events with different payloads', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'event-1', payload: { a: 1 } });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2', payload: { a: 2 } });
      await queue.enqueue({ ...mockEvent, event_id: 'event-3', payload: { a: 3 } });

      const removed = queue.deduplicate();

      expect(removed).toBe(0);
      expect(queue.getDepth()).toBe(3);
    });

    it('should keep events with different event types', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'event-1', event_type: 'type-1' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2', event_type: 'type-2' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-3', event_type: 'type-3' });

      const removed = queue.deduplicate();

      expect(removed).toBe(0);
      expect(queue.getDepth()).toBe(3);
    });

    it('should keep events with different sessions', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'event-1', session_id: 'session-1' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2', session_id: 'session-2' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-3', session_id: 'session-3' });

      const removed = queue.deduplicate();

      expect(removed).toBe(0);
      expect(queue.getDepth()).toBe(3);
    });

    it('should emit queue:deduplicated when duplicates are removed', async () => {
      const deduplicatedSpy = jest.fn();
      queue.on('queue:deduplicated', deduplicatedSpy);

      await queue.enqueue({ ...mockEvent, event_id: 'event-1' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2' });

      queue.deduplicate();

      expect(deduplicatedSpy).toHaveBeenCalledWith(1);
    });

    it('should not emit queue:deduplicated when no duplicates', async () => {
      const deduplicatedSpy = jest.fn();
      queue.on('queue:deduplicated', deduplicatedSpy);

      await queue.enqueue({ ...mockEvent, event_id: 'event-1', payload: { a: 1 } });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2', payload: { a: 2 } });

      queue.deduplicate();

      expect(deduplicatedSpy).not.toHaveBeenCalled();
    });

    it('should return 0 when no duplicates found', () => {
      const removed = queue.deduplicate();
      expect(removed).toBe(0);
    });
  });

  describe('Complex Scenarios', () => {
    beforeEach(() => {
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});
    });

    it('should handle mixed priority and deduplication', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'high-1', priority: 9, payload: { type: 'high' } });
      await queue.enqueue({ ...mockEvent, event_id: 'low-1', priority: 3, payload: { type: 'low' } });
      await queue.enqueue({ ...mockEvent, event_id: 'high-2', priority: 9, payload: { type: 'high' } }); // Duplicate
      await queue.enqueue({ ...mockEvent, event_id: 'medium-1', priority: 5, payload: { type: 'medium' } });

      queue.deduplicate();

      expect(queue.getDepth()).toBe(3);

      const first = queue.dequeue();
      expect(first?.priority).toBe(9);
    });

    it('should maintain priority order after removing events', async () => {
      await queue.enqueue({ ...mockEvent, event_id: 'high', priority: 9 });
      await queue.enqueue({ ...mockEvent, event_id: 'medium', priority: 5 });
      await queue.enqueue({ ...mockEvent, event_id: 'low', priority: 3 });

      queue.remove('medium');

      const first = queue.dequeue();
      const second = queue.dequeue();

      expect(first?.event_id).toBe('high');
      expect(second?.event_id).toBe('low');
    });

    it('should handle finding events by session with priority', async () => {
      await queue.enqueue({
        ...mockEvent,
        event_id: 'event-1',
        session_id: 'session-1',
        priority: 9,
      });
      await queue.enqueue({
        ...mockEvent,
        event_id: 'event-2',
        session_id: 'session-2',
        priority: 5,
      });
      await queue.enqueue({
        ...mockEvent,
        event_id: 'event-3',
        session_id: 'session-1',
        priority: 3,
      });

      const events = queue.getBySession('session-1');

      expect(events).toHaveLength(2);
      // Should maintain priority order
      expect(events[0].priority).toBe(9);
      expect(events[1].priority).toBe(3);
    });

    it('should handle burst of events efficiently', async () => {
      const events = Array.from({ length: 50 }, (_, i) => ({
        ...mockEvent,
        event_id: `event-${i}`,
        priority: Math.floor(Math.random() * 10) + 1,
      }));

      for (const event of events) {
        await queue.enqueue(event);
      }

      expect(queue.getDepth()).toBe(50);

      const batch = queue.dequeueBatch(20);
      expect(batch).toHaveLength(20);
      expect(queue.getDepth()).toBe(30);
    });
  });

  describe('Edge Cases', () => {
    it('should handle events with no event_id during find', async () => {
      const found = queue.findById('');
      expect(found).toBeUndefined();
    });

    it('should handle empty session ID in getBySession', () => {
      const events = queue.getBySession('');
      expect(events).toEqual([]);
    });

    it('should handle queue at max capacity', async () => {
      const tinyQueue = new EventQueue({ maxSize: 1, batchSize: 1 });
      jest.spyOn(tinyQueue as any, 'processQueue').mockImplementation(() => {});

      await tinyQueue.enqueue({ ...mockEvent, event_id: 'event-1' });

      const status = tinyQueue.getStatus();
      expect(status.utilization).toBe(100);

      await expect(
        tinyQueue.enqueue({ ...mockEvent, event_id: 'event-2' })
      ).rejects.toThrow();
    });

    it('should handle events with nested payloads in deduplication', async () => {
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});

      await queue.enqueue({
        ...mockEvent,
        event_id: 'event-1',
        payload: { nested: { data: { value: 1 } } },
      });
      await queue.enqueue({
        ...mockEvent,
        event_id: 'event-2',
        payload: { nested: { data: { value: 1 } } },
      });

      const removed = queue.deduplicate();
      expect(removed).toBe(1);
    });
  });

  describe('Event Emitter Behavior', () => {
    it('should support multiple listeners for same event', async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      queue.on('event:enqueued', listener1);
      queue.on('event:enqueued', listener2);

      await queue.enqueue(mockEvent);

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should support removing listeners', async () => {
      const listener = jest.fn();
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});

      queue.on('event:enqueued', listener);
      await queue.enqueue({ ...mockEvent, event_id: 'event-1' });

      queue.off('event:enqueued', listener);
      await queue.enqueue({ ...mockEvent, event_id: 'event-2' });

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should support once listeners', async () => {
      const listener = jest.fn();
      jest.spyOn(queue as any, 'processQueue').mockImplementation(() => {});

      queue.once('event:enqueued', listener);
      await queue.enqueue({ ...mockEvent, event_id: 'event-1' });
      await queue.enqueue({ ...mockEvent, event_id: 'event-2' });

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
