/**
 * Multi-Claude 3.0 - Brain Event Processor Server
 * Main entry point for the central orchestration engine
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { BrainEventProcessor } from './brain-event-processor';
import { AgentEvent } from './types/events';
import { db } from './database';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Brain Event Processor
const brain = new BrainEventProcessor();

// Event listeners for logging
brain.on('brain:started', () => {
  console.log('🧠 Brain Event Processor has started');
});

brain.on('event:submitted', (event: AgentEvent) => {
  console.log(`📥 Event submitted: ${event.event_id}`);
});

brain.on('decision:made', (decision) => {
  console.log(`💡 Decision made: ${decision.decision_type} (${decision.confidence_score})`);
});

brain.on('actions:executed', (outcomes) => {
  const successful = outcomes.filter((o: any) => o.status === 'success').length;
  console.log(`✅ Actions executed: ${successful}/${outcomes.length} successful`);
});

brain.on('event:processed', ({ event, metrics }) => {
  console.log(`✓ Event processed: ${event.event_id} in ${metrics.duration_ms}ms`);
});

brain.on('event:error', ({ event, error }) => {
  console.error(`❌ Error processing event ${event.event_id}:`, error.message);
});

// Routes

/**
 * POST /events
 * Submit new event for processing
 */
app.post('/events', async (req, res) => {
  try {
    const event: AgentEvent = req.body;
    const result = await brain.submitEvent(event);
    res.status(202).json(result);
  } catch (error: any) {
    res.status(400).json({
      error: error.message,
    });
  }
});

/**
 * GET /events/:event_id
 * Get event processing status (not implemented yet)
 */
app.get('/events/:event_id', async (req, res) => {
  res.status(501).json({
    error: 'Not implemented yet',
    message: 'Event tracking coming soon',
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  try {
    const health = await brain.getHealth();
    const dbHealthy = db.isHealthy();
    const dbStats = db.getStats();

    const statusCode = health.status === 'healthy' && dbHealthy ? 200 : 503;
    res.status(statusCode).json({
      ...health,
      database: {
        connected: dbHealthy,
        stats: dbStats,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

/**
 * GET /metrics
 * Get processing metrics
 */
app.get('/metrics', (req, res) => {
  const metrics = brain.getMetrics();
  res.json(metrics);
});

/**
 * GET /queue/status
 * Get event queue status
 */
app.get('/queue/status', (req, res) => {
  const queue = brain.getEventQueue();
  const status = queue.getStatus();
  res.json(status);
});

/**
 * GET /decisions/rules
 * Get decision rules
 */
app.get('/decisions/rules', (req, res) => {
  const engine = brain.getDecisionEngine();
  const rules = engine.getRules().map((rule) => ({
    id: rule.id,
    name: rule.name,
    priority: rule.priority,
  }));
  res.json({ rules });
});

/**
 * GET /
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Multi-Claude 3.0 Brain Event Processor',
    version: '1.0.0',
    status: 'operational',
    endpoints: {
      'POST /events': 'Submit new event',
      'GET /events/:event_id': 'Get event status',
      'GET /health': 'Health check',
      'GET /metrics': 'Processing metrics',
      'GET /queue/status': 'Queue status',
      'GET /decisions/rules': 'Decision rules',
    },
  });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  }
);

// Start server
async function startServer() {
  try {
    console.log('🚀 Starting Multi-Claude 3.0 Brain Event Processor...');

    // Connect to database
    console.log('📊 Connecting to database...');
    await db.connect();
    console.log('✓ Database connection established');

    // Start Brain Event Processor
    console.log('🧠 Initializing Brain Event Processor...');
    await brain.start();

    // Start HTTP server
    app.listen(PORT, () => {
      console.log('');
      console.log('✨ Multi-Claude 3.0 Brain Event Processor is ready!');
      console.log('');
      console.log(`🌐 Server: http://localhost:${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/health`);
      console.log(`📈 Metrics: http://localhost:${PORT}/metrics`);
      console.log(`📋 Queue: http://localhost:${PORT}/queue/status`);
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await brain.stop();
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await brain.stop();
  await db.close();
  process.exit(0);
});

// Start the server
startServer();
