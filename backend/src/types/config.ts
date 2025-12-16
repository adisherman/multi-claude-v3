/**
 * Multi-Claude 3.0 - Configuration Types
 */

export interface BrainConfig {
  eventQueue: {
    maxSize: number;
    batchSize: number;
    processingThreads: number;
  };
  contextFetcher: {
    timeoutMs: number;
    cacheTtlMs: number;
    maxConcurrent: number;
  };
  contextUpdater: {
    retryCount: number;
    timeoutMs: number;
    batchSize: number;
  };
  agentSpawning: {
    maxConcurrent: number;
    defaultTimeoutMs: number;
    priorityLevels: number;
  };
  decisionEngine: {
    defaultConfidenceThreshold: number;
    autoExecuteThreshold: number;
    escalateThreshold: number;
  };
  database: {
    url: string;
    maxConnections: number;
    idleTimeoutMs: number;
  };
  monitoring: {
    metricsPort: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    traceSamplingRate: number;
  };
}

export const defaultConfig: BrainConfig = {
  eventQueue: {
    maxSize: parseInt(process.env.MAX_QUEUE_SIZE || '10000'),
    batchSize: parseInt(process.env.EVENT_BATCH_SIZE || '10'),
    processingThreads: parseInt(process.env.PROCESSING_THREADS || '4'),
  },
  contextFetcher: {
    timeoutMs: parseInt(process.env.CONTEXT_FETCHER_TIMEOUT_MS || '30000'),
    cacheTtlMs: parseInt(process.env.CONTEXT_CACHE_TTL_MS || '300000'),
    maxConcurrent: parseInt(process.env.CONTEXT_FETCHER_MAX_CONCURRENT || '10'),
  },
  contextUpdater: {
    retryCount: parseInt(process.env.PERSISTENCE_RETRY_COUNT || '3'),
    timeoutMs: parseInt(process.env.PERSISTENCE_TIMEOUT_MS || '5000'),
    batchSize: parseInt(process.env.PERSISTENCE_BATCH_SIZE || '50'),
  },
  agentSpawning: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_AGENTS || '20'),
    defaultTimeoutMs: parseInt(process.env.AGENT_SPAWN_TIMEOUT_MS || '60000'),
    priorityLevels: parseInt(process.env.AGENT_PRIORITY_LEVELS || '5'),
  },
  decisionEngine: {
    defaultConfidenceThreshold: parseFloat(
      process.env.DEFAULT_CONFIDENCE_THRESHOLD || '0.7'
    ),
    autoExecuteThreshold: parseFloat(process.env.AUTO_EXECUTE_THRESHOLD || '0.8'),
    escalateThreshold: parseFloat(process.env.ESCALATE_THRESHOLD || '0.5'),
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/multi_claude_system',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeoutMs: parseInt(process.env.DB_IDLE_TIMEOUT_MS || '10000'),
  },
  monitoring: {
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),
    logLevel: (process.env.LOG_LEVEL as any) || 'info',
    traceSamplingRate: parseFloat(process.env.TRACE_SAMPLING_RATE || '0.1'),
  },
};
