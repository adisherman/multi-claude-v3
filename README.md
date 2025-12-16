# Multi-Claude 3.0 Autonomous Coding System

> An intelligent multi-agent system for autonomous software development, powered by Claude AI agents working in concert.

[![CI Pipeline](https://github.com/adisherman/multi-claude-v3/actions/workflows/ci.yml/badge.svg)](https://github.com/adisherman/multi-claude-v3/actions/workflows/ci.yml)
[![Docker Build](https://github.com/adisherman/multi-claude-v3/actions/workflows/docker-build.yml/badge.svg)](https://github.com/adisherman/multi-claude-v3/actions/workflows/docker-build.yml)
[![Code Quality](https://github.com/adisherman/multi-claude-v3/actions/workflows/code-quality.yml/badge.svg)](https://github.com/adisherman/multi-claude-v3/actions/workflows/code-quality.yml)
[![Deploy](https://github.com/adisherman/multi-claude-v3/actions/workflows/deploy.yml/badge.svg)](https://github.com/adisherman/multi-claude-v3/actions/workflows/deploy.yml)

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Core Components](#core-components)
- [Agent Ecosystem](#agent-ecosystem)
- [Event Processing Pipeline](#event-processing-pipeline)
- [Database Schema](#database-schema)
- [Workflows](#workflows)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Multi-Claude 3.0 is an autonomous coding company system that orchestrates multiple specialized Claude AI agents to collaboratively develop software projects. The system treats software development as a distributed, event-driven process where intelligent agents handle specific responsibilities while maintaining coordination through a central brain processor and shared database.

### Key Capabilities

- **Autonomous Project Scaffolding**: Create production-ready project structures with zero errors
- **Intelligent Context Management**: Fetch and update project context from centralized database
- **Event-Driven Architecture**: Process development events through a 5-stage pipeline
- **Merge Coordination**: Intelligently merge agent contributions with conflict resolution
- **Learning & Adaptation**: Capture patterns and learnings to improve over time

### Design Philosophy

1. **Specialization**: Each agent excels at a specific domain
2. **Coordination**: Agents communicate through events and shared context
3. **Intelligence**: Agents make autonomous decisions within their domain
4. **Reliability**: Zero-error delivery and data integrity are paramount
5. **Learning**: System continuously improves from experience

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User / External Input                     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BrainEventProcessor                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Event → Understanding → Context → Plan → Execution      │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────┬────────────────────┬───────────────────────┬─────────────┘
       │                    │                       │
       │ Request Context    │ Execute Plans         │ Persist Results
       ▼                    ▼                       ▼
┌──────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   Context    │   │ Implementation   │   │    Context       │
│   Fetcher    │   │    Agents        │   │    Updater       │
│              │   │                  │   │                  │
│ • Query DB   │   │ • Project        │   │ • Write Events   │
│ • Analyze    │   │   Scaffolder     │   │ • Update State   │
│ • Report     │   │ • Feature Dev    │   │ • Store Results  │
└──────┬───────┘   │ • Merge Agent    │   └────────┬─────────┘
       │           │ • Test Writer    │            │
       │           └────────┬─────────┘            │
       │                    │                      │
       └────────────────────┼──────────────────────┘
                            │
                            ▼
                ┌──────────────────────┐
                │   PostgreSQL DB      │
                │                      │
                │ • Events             │
                │ • Agent Sessions     │
                │ • Contexts           │
                │ • Task Results       │
                │ • System Learnings   │
                └──────────────────────┘
```

### Architecture Principles

- **Event-Driven**: All agent activities generate events processed through the pipeline
- **Database-Centric**: PostgreSQL serves as the single source of truth
- **Stateless Agents**: Agents operate statelessly, pulling context as needed
- **Pipeline Processing**: 5-stage pipeline ensures thorough event analysis
- **Asynchronous**: Agents work concurrently when possible

---

## Core Components

### 1. BrainEventProcessor (Orchestration Hub)

The central intelligence that coordinates all agent activities.

**Responsibilities:**
- Receive events from all agents
- Process events through 5-stage pipeline
- Coordinate agent activities
- Make high-level strategic decisions
- Ensure system coherence

**Pipeline Stages:**
1. **Event**: Capture raw event data
2. **Understanding**: Analyze and interpret the event
3. **Context**: Fetch relevant context from database
4. **Plan**: Develop strategy for handling the event
5. **Execution**: Execute the plan and capture results

### 2. PostgreSQL Database (Central State)

Persistent storage for all system state and history.

**Tables:**
- `events`: All system events
- `agent_sessions`: Agent execution sessions
- `agent_contexts`: Contextual information
- `task_results`: Task outputs and artifacts
- `system_learnings`: Captured patterns and insights
- `file_operations`: File system activity logs

### 3. Specialized Agents (Domain Experts)

Each agent handles specific responsibilities:

#### Context Fetcher Agent
- **Role**: Database Intelligence Specialist
- **Function**: Execute read-only queries to gather context
- **Output**: Structured intelligence reports

#### Context Updater Agent
- **Role**: Database Persistence Specialist
- **Function**: Execute write operations to persist state
- **Output**: Persistence confirmation reports

#### Project Scaffolder Agent
- **Role**: Project Blueprint Specialist
- **Function**: Create zero-error project foundations
- **Output**: Production-ready project structures

#### Merge Agent
- **Role**: Integration Validation Specialist
- **Function**: Coordinate and validate agent contributions
- **Output**: Merged, validated code

---

## Agent Ecosystem

### Agent Communication Flow

```
┌─────────────────┐
│   User Request  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      BrainEventProcessor            │
│  1. Understand request              │
│  2. Fetch context (→ Context        │
│     Fetcher)                        │
│  3. Create plan                     │
│  4. Assign to implementation agent  │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│    Implementation Agent             │
│  (e.g., Project Scaffolder)         │
│  1. Execute assigned task           │
│  2. Generate artifacts              │
│  3. Emit completion event           │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│      BrainEventProcessor            │
│  1. Receive completion event        │
│  2. Process through pipeline        │
│  3. Persist results (→ Context      │
│     Updater)                        │
│  4. Update system state             │
└─────────────────────────────────────┘
```

### Agent Capabilities Matrix

| Agent | Read DB | Write DB | Create Files | Execute Tools | Learn Patterns |
|-------|---------|----------|--------------|---------------|----------------|
| BrainEventProcessor | ✓ | ✓ | ✗ | ✓ | ✓ |
| Context Fetcher | ✓ | ✗ | ✗ | ✗ | ✗ |
| Context Updater | ✗ | ✓ | ✗ | ✗ | ✗ |
| Project Scaffolder | ✗ | ✗ | ✓ | ✓ | ✓ |
| Merge Agent | ✗ | ✗ | ✓ | ✓ | ✓ |

---

## Event Processing Pipeline

### Stage 1: Event Capture

```json
{
  "event_id": "uuid",
  "event_type": "project_scaffolding_requested",
  "timestamp": "ISO-8601",
  "agent_name": "ProjectScaffolder",
  "payload": {
    "project_type": "react-vite",
    "requirements": {...}
  }
}
```

### Stage 2: Understanding

```json
{
  "intent": "User wants to create a new React project with Vite",
  "entities": ["react", "vite", "typescript"],
  "priority": "high",
  "complexity": "medium"
}
```

### Stage 3: Context Fetching

```json
{
  "relevant_history": [
    "User created 3 React projects previously",
    "Always uses TypeScript",
    "Prefers Tailwind CSS"
  ],
  "system_state": {
    "active_sessions": 0,
    "available_agents": ["ProjectScaffolder"]
  },
  "patterns": [
    "React + Vite + TypeScript is common pattern",
    "User typically adds Tailwind later"
  ]
}
```

### Stage 4: Planning

```json
{
  "strategy": "Use official Vite scaffolding tool with TypeScript template",
  "steps": [
    "Execute npm create vite",
    "Install dependencies",
    "Verify zero errors",
    "Create git commit"
  ],
  "estimated_duration": "2 minutes",
  "risks": ["Dependency installation failures"]
}
```

### Stage 5: Execution

```json
{
  "actions_taken": [
    "Executed npm create vite with react-ts template",
    "Installed dependencies (45 packages)",
    "Verified TypeScript compilation (0 errors)",
    "Created git commit"
  ],
  "results": {
    "success": true,
    "files_created": 23,
    "directories_created": 8
  },
  "learnings": [
    "Vite + React-TS scaffolding completed in 87 seconds",
    "Zero errors achieved on first attempt"
  ]
}
```

### Stage 6: Persistence

The Context Updater persists all pipeline data:
- Event status updated to "processed"
- Execution results stored
- Learnings captured
- System state updated

---

## Database Schema

### Core Tables

#### `events`
```sql
CREATE TABLE events (
  event_id UUID PRIMARY KEY,
  session_id UUID REFERENCES agent_sessions(session_id),
  event_type VARCHAR(100) NOT NULL,
  agent_name VARCHAR(255),
  event_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed BOOLEAN DEFAULT FALSE,
  processing_result JSONB
);
```

#### `agent_sessions`
```sql
CREATE TABLE agent_sessions (
  session_id UUID PRIMARY KEY,
  agent_name VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  metadata JSONB
);
```

#### `agent_contexts`
```sql
CREATE TABLE agent_contexts (
  context_id UUID PRIMARY KEY,
  session_id UUID REFERENCES agent_sessions(session_id),
  context_type VARCHAR(100) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### `system_learnings`
```sql
CREATE TABLE system_learnings (
  learning_id UUID PRIMARY KEY,
  learning_type VARCHAR(100) NOT NULL,
  agent_name VARCHAR(255),
  content JSONB NOT NULL,
  relevance_score FLOAT DEFAULT 1.0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  tags TEXT[]
);
```

---

## Workflows

### Workflow 1: New Project Creation

```
User: "Create a new React TypeScript project"
  ↓
BrainEventProcessor:
  - Understand: User wants React + TypeScript project
  - Context: Check user's previous React projects (via Context Fetcher)
  - Plan: Use Project Scaffolder with Vite template
  - Execute: Assign to Project Scaffolder
  ↓
Project Scaffolder:
  - Execute: npm create vite with react-ts template
  - Install dependencies
  - Verify: tsc --noEmit (0 errors)
  - Commit: Create git commit with clean state
  - Emit: "project_scaffolding_completed" event
  ↓
BrainEventProcessor:
  - Receive completion event
  - Context: Validate project structure
  - Persist: Store results (via Context Updater)
  - Respond: "Project created successfully at ./my-react-app"
```

### Workflow 2: Feature Implementation with Multiple Agents

```
User: "Add authentication to the project"
  ↓
BrainEventProcessor:
  - Understand: Add auth feature to existing project
  - Context: Fetch project structure and tech stack
  - Plan: Break into subtasks for multiple agents
  ↓
Task Distribution:
  Agent A: Create auth API endpoints
  Agent B: Build login UI components
  Agent C: Set up auth state management
  ↓
Parallel Execution:
  - All agents work concurrently
  - Each emits completion events
  ↓
Merge Agent:
  - Collect all contributions
  - Validate compatibility
  - Resolve conflicts
  - Merge into main codebase
  ↓
BrainEventProcessor:
  - Verify merged result
  - Persist learnings
  - Respond: "Authentication feature added successfully"
```

### Workflow 3: Error Recovery

```
Agent: Encounters error during task
  ↓
BrainEventProcessor:
  - Receive error event
  - Context: Fetch error history and patterns
  - Plan: Determine recovery strategy
  ↓
Recovery Options:
  1. Retry with different approach
  2. Assign to different agent
  3. Request user clarification
  4. Escalate to human developer
  ↓
Context Updater:
  - Store error pattern
  - Capture resolution attempt
  - Update system learnings
```

---

## Getting Started

### Prerequisites

- Node.js 18+ or Python 3.11+
- PostgreSQL 14+
- Git
- Claude API access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd game2048
   ```

2. **Set up the database**
   ```bash
   # Create database
   createdb multi_claude_db

   # Run migrations
   psql -d multi_claude_db -f database/schema.sql
   ```

3. **Install dependencies**
   ```bash
   # Backend
   cd backend
   npm install

   # Frontend (if applicable)
   cd ../frontend
   npm install
   ```

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials and Claude API key
   ```

5. **Start the system**
   ```bash
   npm run dev
   ```

---

## Project Structure

```
game2048/
├── backend/                 # Backend services
│   ├── src/
│   │   ├── agents/         # Agent implementations
│   │   ├── brain/          # BrainEventProcessor
│   │   ├── database/       # Database access layer
│   │   └── utils/          # Shared utilities
│   └── package.json
├── mobile/                 # Mobile application (if applicable)
├── specs/                  # Agent specifications
│   ├── context_fetcher_specs.md
│   ├── context_updater_specs.md
│   ├── project_scaffolder_specs.md
│   └── merge_agent_specs.md
├── database/               # Database schemas and migrations
│   └── schema.sql
├── docs/                   # Additional documentation
└── README.md              # This file
```

---

## Development

### Adding a New Agent

1. **Create specification**
   ```bash
   touch specs/new_agent_specs.md
   # Document agent's role, responsibilities, and interface
   ```

2. **Implement agent**
   ```bash
   mkdir backend/src/agents/new-agent
   touch backend/src/agents/new-agent/index.ts
   ```

3. **Register with BrainEventProcessor**
   ```typescript
   // backend/src/brain/processor.ts
   import { NewAgent } from '../agents/new-agent';

   const agents = {
     contextFetcher: new ContextFetcher(),
     contextUpdater: new ContextUpdater(),
     projectScaffolder: new ProjectScaffolder(),
     newAgent: new NewAgent(),  // Add new agent
   };
   ```

4. **Add database tables** (if needed)
   ```sql
   -- database/migrations/xxx_add_new_agent_tables.sql
   CREATE TABLE new_agent_data (...);
   ```

5. **Test integration**
   ```bash
   npm test -- --grep "NewAgent"
   ```

### Running Tests

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

### Database Migrations

```bash
# Create new migration
npm run migration:create add_new_table

# Run migrations
npm run migration:run

# Rollback last migration
npm run migration:rollback
```

---

## Contributing

### Contribution Guidelines

1. **Read the specs**: Understand agent responsibilities in `specs/` directory
2. **Follow patterns**: Maintain consistency with existing agents
3. **Zero errors**: Ensure all code compiles and tests pass
4. **Document**: Update specs and README for significant changes
5. **Test thoroughly**: Add unit and integration tests

### Pull Request Process

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit: `git commit -m "Add feature"`
3. Push to branch: `git push origin feature/my-feature`
4. Open pull request with description
5. Address review feedback
6. Merge after approval

### Code Standards

- **TypeScript**: Strict mode enabled, no `any` types
- **Naming**: camelCase for variables, PascalCase for classes
- **Formatting**: Prettier with 2-space indentation
- **Linting**: ESLint rules enforced
- **Testing**: Minimum 80% code coverage

---

## Architecture Decisions

### Why PostgreSQL?

- **JSONB support**: Flexible schema for event data
- **ACID compliance**: Ensures data integrity
- **Powerful queries**: Complex analytics and pattern detection
- **Reliability**: Battle-tested in production environments

### Why Event-Driven?

- **Decoupling**: Agents work independently
- **Scalability**: Easy to add new agents
- **Auditability**: Complete history of all actions
- **Debugging**: Clear event trail for troubleshooting

### Why Specialized Agents?

- **Expertise**: Each agent masters its domain
- **Reliability**: Focused responsibility reduces errors
- **Parallelism**: Agents work concurrently
- **Maintainability**: Clear separation of concerns

---

## Roadmap

### Phase 1: Foundation (Current)
- ✅ Core agent specifications
- ✅ Database schema design
- ✅ BrainEventProcessor architecture
- 🔄 Basic agent implementations

### Phase 2: Implementation
- 🔲 Complete agent implementations
- 🔲 Integration testing
- 🔲 Error recovery mechanisms
- 🔲 Performance optimization

### Phase 3: Enhancement
- 🔲 Advanced learning capabilities
- 🔲 Multi-project coordination
- 🔲 Real-time collaboration features
- 🔲 Web UI for monitoring

### Phase 4: Production
- 🔲 Production deployment
- 🔲 Monitoring and observability
- 🔲 Security hardening
- 🔲 Documentation completion

---

## Troubleshooting

### Common Issues

**Database connection errors**
```bash
# Check PostgreSQL is running
psql -l

# Verify connection string in .env
DATABASE_URL=postgresql://user:password@localhost:5432/multi_claude_db
```

**Agent not responding**
```bash
# Check agent logs
tail -f logs/brain-event-processor.log

# Verify agent registered
npm run list-agents
```

**Event processing stuck**
```bash
# Check event queue
psql -d multi_claude_db -c "SELECT * FROM events WHERE processed = false;"

# Retry processing
npm run process-pending-events
```

---

## FAQ

**Q: Can agents communicate directly with each other?**
A: No. All communication flows through the BrainEventProcessor via events.

**Q: How do agents maintain context across requests?**
A: Agents are stateless. Context is fetched from the database for each request.

**Q: What happens if an agent fails?**
A: The BrainEventProcessor detects failure, logs it, and either retries or escalates.

**Q: Can I run multiple instances of the system?**
A: Yes, but coordination requires distributed locking (future enhancement).

**Q: How are conflicts resolved between agent outputs?**
A: The Merge Agent handles conflict detection and resolution.

---

## Performance

### Benchmarks (Target)

- Event processing: < 100ms (p50), < 500ms (p99)
- Context fetch: < 50ms (p50), < 200ms (p99)
- Context update: < 30ms (p50), < 100ms (p99)
- Project scaffolding: < 2 minutes for typical project

### Scalability

- Events/second: 100+ (single instance)
- Concurrent agents: 10+ (per instance)
- Database size: Optimized for 1M+ events
- Learning storage: Efficient JSONB indexing

---

## Security

### Security Measures

- **SQL Injection Prevention**: Parameterized queries only
- **Input Validation**: All inputs validated before processing
- **Access Control**: Database-level permissions
- **Audit Logging**: Complete audit trail of all operations
- **Secrets Management**: Environment variables, never in code

### Security Best Practices

- Never commit `.env` files
- Rotate database credentials regularly
- Use read-only connections where possible
- Validate all JSONB payloads
- Sanitize user inputs

---

## License

MIT License - See LICENSE file for details

---

## Acknowledgments

- Powered by Claude AI from Anthropic
- Built with modern TypeScript and PostgreSQL
- Inspired by autonomous agent research

---

## Contact & Support

- **Issues**: GitHub Issues
- **Documentation**: `/docs` directory
- **Specs**: `/specs` directory

---

**Status**: Active Development
**Version**: 1.0.0
**Last Updated**: 2025-12-16

---

Built with ❤️ by the Multi-Claude 3.0 Team
