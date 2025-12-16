# Multi-Claude 3.0 Brain Event Processor

Central orchestration engine for the Multi-Claude 3.0 Autonomous Coding System.

## Overview

The Brain Event Processor is the central nervous system that:
- Receives events from all agents
- Coordinates context gathering
- Makes intelligent processing decisions
- Orchestrates agent spawning and merging
- Ensures proper state persistence

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+ (for production)
- TypeScript

### Installation

```bash
cd backend
npm install
```

### Development

```bash
# Start in development mode with hot reload
npm run dev
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

## Configuration

Create a `.env` file in the backend directory:

```bash
# Server
PORT=8080

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/multi_claude_system

# Event Queue
MAX_QUEUE_SIZE=10000
EVENT_BATCH_SIZE=10
PROCESSING_THREADS=4

# Context Fetcher
CONTEXT_FETCHER_TIMEOUT_MS=30000
CONTEXT_CACHE_TTL_MS=300000
CONTEXT_FETCHER_MAX_CONCURRENT=10

# Context Updater
PERSISTENCE_RETRY_COUNT=3
PERSISTENCE_TIMEOUT_MS=5000
PERSISTENCE_BATCH_SIZE=50

# Agent Spawning
MAX_CONCURRENT_AGENTS=20
AGENT_SPAWN_TIMEOUT_MS=60000
AGENT_PRIORITY_LEVELS=5

# Decision Engine
DEFAULT_CONFIDENCE_THRESHOLD=0.7
AUTO_EXECUTE_THRESHOLD=0.8
ESCALATE_THRESHOLD=0.5

# Monitoring
METRICS_PORT=9090
LOG_LEVEL=info
TRACE_SAMPLING_RATE=0.1
```

## API Endpoints

### POST /events
Submit new event for processing

**Request:**
```json
{
  "event_id": "uuid",
  "session_id": "uuid",
  "event_type": "agent_started",
  "timestamp": "2025-12-16T10:00:00Z",
  "payload": {
    "agent_name": "ProjectScaffolder",
    "metadata": {}
  },
  "priority": 5
}
```

**Response:**
```json
{
  "event_id": "uuid",
  "status": "queued"
}
```

### GET /health
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-16T10:00:00Z",
  "components": [
    {
      "name": "event_queue",
      "status": "healthy",
      "last_check": "2025-12-16T10:00:00Z",
      "details": {}
    }
  ],
  "metrics": {
    "uptime_seconds": 3600,
    "events_processed": 150,
    "queue_depth": 5,
    "active_sessions": 3
  }
}
```

### GET /metrics
Get processing metrics

**Response:**
```json
{
  "eventsProcessed": 150,
  "decisionsMade": 150,
  "actionsExecuted": 200,
  "errors": 2,
  "uptime_seconds": 3600,
  "queue_depth": 5,
  "active_agents": 3
}
```

### GET /queue/status
Get event queue status

**Response:**
```json
{
  "depth": 5,
  "maxSize": 10000,
  "utilization": 0.05,
  "processing": true
}
```

### GET /decisions/rules
Get decision rules

**Response:**
```json
{
  "rules": [
    {
      "id": "auto-spawn-scaffolder",
      "name": "Auto-spawn ProjectScaffolder for new projects",
      "priority": 100
    }
  ]
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│      Brain Event Processor              │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   Event Queue Manager            │  │
│  │   - Priority-based queue         │  │
│  │   - Backpressure handling        │  │
│  └──────────────────────────────────┘  │
│                 │                       │
│                 ▼                       │
│  ┌──────────────────────────────────┐  │
│  │   Context Coordinator            │  │
│  │   - Gathers intelligence         │  │
│  │   - Caching layer                │  │
│  └──────────────────────────────────┘  │
│                 │                       │
│                 ▼                       │
│  ┌──────────────────────────────────┐  │
│  │   Decision Engine                │  │
│  │   - Rule-based decisions         │  │
│  │   - Confidence scoring           │  │
│  └──────────────────────────────────┘  │
│                 │                       │
│                 ▼                       │
│  ┌──────────────────────────────────┐  │
│  │   Action Executor                │  │
│  │   - Spawns agents                │  │
│  │   - Coordinates merges           │  │
│  │   - Persists state               │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Processing Pipeline

1. **Event Reception**
   - Validate event structure
   - Assign priority if needed
   - Add to processing queue

2. **Context Gathering**
   - Determine investigation scope
   - Query Context Fetcher
   - Aggregate intelligence

3. **Decision Making**
   - Evaluate decision rules
   - Calculate confidence score
   - Determine actions

4. **Action Execution**
   - Execute if confidence > threshold
   - Spawn agents, merge, validate, etc.
   - Collect outcomes

5. **State Persistence**
   - Persist to database
   - Update metrics
   - Emit events

## Event Types

### agent_started
Agent session initialization

### agent_completed
Agent finished execution

### task_created
New task assigned

### task_completed
Task successfully completed

### task_failed
Task execution failed

### file_modified
File system modification

### merge_conflict
Merge conflict detected

### validation_failed
Validation check failed

### user_request
User initiated request

## Decision Rules

Rules are evaluated in priority order. First matching rule wins.

### Default Rules

1. **escalate-critical** (priority: 200)
   - Escalates critical task failures immediately

2. **auto-spawn-scaffolder** (priority: 100)
   - Spawns ProjectScaffolder for new projects

3. **handle-validation-failure** (priority: 95)
   - Fixes or escalates validation failures

4. **retry-failed-task** (priority: 90)
   - Retries failed tasks with retry budget

5. **merge-concurrent-modifications** (priority: 85)
   - Merges concurrent file modifications

6. **auto-merge-safe** (priority: 80)
   - Auto-merges non-conflicting changes

7. **validate-after-merge** (priority: 75)
   - Runs validation after merges

8. **persist-agent-completion** (priority: 70)
   - Persists state on agent completion

9. **log-agent-start** (priority: 60)
   - Logs agent session start

### Custom Rules

Add custom rules programmatically:

```typescript
import { BrainEventProcessor } from './brain-event-processor';

const brain = new BrainEventProcessor();
const engine = brain.getDecisionEngine();

engine.addRule({
  id: 'custom-rule',
  name: 'My custom rule',
  priority: 150,
  condition: (ctx) => {
    return ctx.event.event_type === 'my_event';
  },
  action: (ctx) => ({
    decision_type: 'spawn_agent',
    actions: [
      {
        type: 'spawn_agent',
        agent_type: 'MyAgent',
        configuration: {},
        priority: 5,
        timeout_ms: 60000,
      },
    ],
    rationale: 'My custom rule triggered',
    confidence_score: 0.9,
  }),
});
```

## Testing

```bash
# Run tests (not implemented yet)
npm test

# Lint
npm run lint
```

## Example Usage

### Submit Event via cURL

```bash
curl -X POST http://localhost:8080/events \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "550e8400-e29b-41d4-a716-446655440000",
    "event_type": "agent_started",
    "payload": {
      "agent_name": "ProjectScaffolder",
      "metadata": {
        "project_name": "my-app"
      }
    },
    "priority": 5
  }'
```

### Check Health

```bash
curl http://localhost:8080/health
```

### Get Metrics

```bash
curl http://localhost:8080/metrics
```

## Monitoring

### Logs

Logs are output to stdout with the following format:

```
[timestamp] [level] [component] message
```

### Metrics

Available metrics:
- `eventsProcessed`: Total events processed
- `decisionsMade`: Total decisions made
- `actionsExecuted`: Total actions executed
- `errors`: Total errors encountered
- `uptime_seconds`: Process uptime
- `queue_depth`: Current queue depth
- `active_agents`: Currently active agents

## Troubleshooting

### Queue Full

If events are being rejected with "Queue full":
1. Increase `MAX_QUEUE_SIZE`
2. Scale horizontally with more instances
3. Optimize event processing

### High Latency

If event processing is slow:
1. Check Context Fetcher performance
2. Review decision engine rules
3. Optimize database queries
4. Consider caching

### Low Confidence Decisions

If many decisions are escalated:
1. Review and tune decision rules
2. Adjust confidence thresholds
3. Add more specific rules

## Development

### Project Structure

```
backend/
├── src/
│   ├── core/
│   │   ├── event-queue.ts
│   │   ├── decision-engine.ts
│   │   ├── context-coordinator.ts
│   │   └── action-executor.ts
│   ├── types/
│   │   ├── events.ts
│   │   └── config.ts
│   ├── brain-event-processor.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Adding New Event Types

1. Update event type handling in `decision-engine.ts`
2. Add appropriate decision rules
3. Update documentation

### Adding New Actions

1. Add action type to `types/events.ts`
2. Implement execution in `action-executor.ts`
3. Add decision rules that produce the action

## License

Part of the Multi-Claude 3.0 Autonomous Coding System.

---

**Last Updated:** 2025-12-16
**Version:** 1.0.0
