import { EventProcessorWorker } from './src/workers/event-processor-worker.js';

async function test() {
  console.log('Testing EventProcessorWorker...\n');
  
  const worker = new EventProcessorWorker({
    concurrency: 1,
    retryAttempts: 1,
    processingTimeout: 10000,
  });

  // Setup event listeners
  worker.on('worker:started', () => console.log('✓ Worker started'));
  worker.on('job:started', (data) => console.log(`🔄 Job started: ${data.event_id}`));
  worker.on('job:completed', (data) => console.log(`✓ Job completed: ${data.event_id} (${data.duration}ms)`));
  worker.on('job:failed', (data) => console.log(`✗ Job failed: ${data.event_id} - ${data.error}`));
  worker.on('stage:started', (data) => console.log(`  ▶ Stage started: ${data.stage}`));
  worker.on('stage:completed', (data) => console.log(`  ✓ Stage completed: ${data.stage} (${data.duration}ms)`));
  worker.on('stage:failed', (data) => console.log(`  ✗ Stage failed: ${data.stage} - ${data.error}`));

  await worker.start();

  // Test event
  const testEvent = {
    event_id: 'test-direct-001',
    session_id: 'session-direct-001',
    event_type: 'test_event',
    timestamp: new Date().toISOString(),
    payload: { test: true },
  };

  console.log('\nProcessing test event...\n');
  await worker.processEvent(testEvent);

  console.log('\nWorker stats:', worker.getStats());

  await worker.stop();
  process.exit(0);
}

test().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
