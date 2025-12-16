# Database Setup Guide

Quick guide to set up the Multi-Claude 3.0 PostgreSQL database.

## Quick Start (Recommended: Docker)

### Option 1: Docker Compose (Easiest)

```bash
cd database
docker-compose up -d
```

That's it! The database will be created and schema applied automatically.

**Access Details:**
- Database: `postgresql://postgres:postgres@localhost:5432/multi_claude_system`
- pgAdmin UI: `http://localhost:5050` (admin@multiclaudesystem.local / admin)

**Useful Commands:**
```bash
# View logs
docker-compose logs -f postgres

# Stop database
docker-compose down

# Stop and remove all data
docker-compose down -v

# Restart
docker-compose restart postgres

# Connect via psql
docker exec -it multi-claude-postgres psql -U postgres -d multi_claude_system
```

### Option 2: Automated Setup Script

```bash
cd database
./setup.sh
```

Follow the prompts to set up with either Docker or local PostgreSQL.

## Manual Setup

### Prerequisites

- PostgreSQL 12 or higher
- Extensions: `uuid-ossp`, `pgcrypto`

### Steps

1. **Create Database**
   ```bash
   createdb multi_claude_system
   ```

2. **Apply Schema**
   ```bash
   psql -d multi_claude_system -f schema.sql
   ```

3. **Verify**
   ```bash
   psql -d multi_claude_system -c "\dt"
   ```

## Verification

Run the verification script to ensure everything is set up correctly:

```bash
cd database
./verify.sh
```

This will:
- Check database connection
- Verify all tables, views, and functions exist
- Run basic operation tests
- Display database statistics

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
DB_HOST=localhost
DB_PORT=5432
DB_NAME=multi_claude_system
DB_USER=postgres
DB_PASSWORD=postgres

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/multi_claude_system
```

The `setup.sh` script creates this file automatically.

### Connection Examples

**Node.js:**
```javascript
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
```

**Python:**
```python
import psycopg2
import os

conn = psycopg2.connect(os.environ['DATABASE_URL'])
```

## Database Structure

### Core Tables

| Table | Purpose |
|-------|---------|
| `agent_sessions` | Agent lifecycle tracking |
| `agent_events` | Event logging |
| `agent_tasks` | Task management |
| `file_operations` | File system operations |
| `merge_operations` | Merge tracking |
| `merge_conflicts` | Conflict details |
| `processing_decisions` | Brain decisions |
| `context_storage` | General context |
| `system_metrics` | Performance metrics |

### Useful Views

| View | Purpose |
|------|---------|
| `active_sessions` | Currently running sessions |
| `session_summary` | Aggregated session stats |
| `recent_events` | Last 100 events |
| `pending_tasks` | Tasks waiting to run |
| `merge_statistics` | Merge analytics |

### Utility Functions

- `get_session_hierarchy(session_id)` - Get parent-child session tree
- `calculate_session_metrics(session_id)` - Aggregate session stats

## Common Tasks

### View All Tables
```sql
\dt
```

### Check Table Structure
```sql
\d+ agent_sessions
```

### View Active Sessions
```sql
SELECT * FROM active_sessions;
```

### Check Database Size
```sql
SELECT pg_size_pretty(pg_database_size('multi_claude_system'));
```

### Backup Database
```bash
pg_dump multi_claude_system > backup.sql
```

### Restore Database
```bash
psql multi_claude_system < backup.sql
```

## Troubleshooting

### Cannot Connect to Database

**Docker:**
```bash
docker-compose ps
docker-compose logs postgres
```

**Local:**
```bash
pg_isready
```

### Schema Not Applied

```bash
psql -d multi_claude_system -f schema.sql
```

### Missing Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

### Permission Denied

```sql
GRANT ALL PRIVILEGES ON DATABASE multi_claude_system TO postgres;
```

## Next Steps

1. ✅ Database is set up
2. 📖 Read the [README.md](README.md) for detailed documentation
3. 🔍 Explore [sample_queries.sql](sample_queries.sql) for query examples
4. 🤖 Start building your Multi-Claude agents!

## Support

- **Schema Documentation:** [schema.sql](schema.sql)
- **Detailed Guide:** [README.md](README.md)
- **Sample Queries:** [sample_queries.sql](sample_queries.sql)
- **Agent Specs:** [../specs/](../specs/)

---

**Quick Reference:**

```bash
# Docker setup
docker-compose up -d

# Verify setup
./verify.sh

# Connect to database
docker exec -it multi-claude-postgres psql -U postgres -d multi_claude_system

# View logs
docker-compose logs -f

# Stop everything
docker-compose down
```
