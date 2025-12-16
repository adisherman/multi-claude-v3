# Multi-Claude 3.0 - Docker Setup Guide

This guide explains how to run the Multi-Claude 3.0 autonomous coding system using Docker Compose.

## Overview

The system consists of three main services:

1. **PostgreSQL Database** - Stores agent events, decisions, sessions, and system state
2. **Backend API** - Brain Event Processor with 5-stage pipeline
3. **Dashboard** - React-based monitoring interface

All services are orchestrated using Docker Compose with proper health checks and dependency management.

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose v2.0+ installed
- At least 4GB of available RAM
- Ports 5432, 8080, and 5173 available

Check your Docker installation:
```bash
docker --version
docker compose version
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Docker Network                      │
│              (multi-claude-network)                  │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  PostgreSQL  │←─│   Backend    │←─│ Dashboard │ │
│  │   :5432      │  │    :8080     │  │   :5173   │ │
│  └──────────────┘  └──────────────┘  └───────────┘ │
│         ↓                                            │
│  ┌──────────────┐                                   │
│  │postgres_data │                                   │
│  │   (volume)   │                                   │
│  └──────────────┘                                   │
└─────────────────────────────────────────────────────┘
```

## Environment Variables

Create a `.env` file in the project root (optional):

```bash
# Database Configuration
DB_PASSWORD=your_secure_password_here

# Backend Configuration
NODE_ENV=production
PORT=8080

# API URL for Dashboard (if different from default)
VITE_API_URL=http://localhost:8080
```

**Note**: If `.env` is not provided, default values from `docker-compose.yml` will be used.

## Quick Start

### 1. Start All Services

```bash
# Build and start all services
docker compose up -d

# View logs
docker compose logs -f
```

This will:
- Pull/build all required images
- Create the database with schema and seed data
- Start backend API on http://localhost:8080
- Start dashboard on http://localhost:5173

### 2. Verify Services

Check health status:
```bash
docker compose ps
```

Expected output:
```
NAME                      STATUS         PORTS
multi-claude-postgres     Up (healthy)   0.0.0.0:5432->5432/tcp
multi-claude-backend      Up (healthy)   0.0.0.0:8080->8080/tcp
multi-claude-dashboard    Up (healthy)   0.0.0.0:5173->80/tcp
```

### 3. Access the System

- **Dashboard**: http://localhost:5173
- **Backend API**: http://localhost:8080
- **Health Check**: http://localhost:8080/health
- **Metrics**: http://localhost:8080/metrics

### 4. Test Event Submission

Submit a test event:
```bash
curl -X POST http://localhost:8080/events \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session-123",
    "event_type": "user.request.create_project",
    "source": "cli",
    "priority": "normal",
    "payload": {
      "project_name": "demo-app",
      "project_type": "react-typescript",
      "description": "Demo project for testing"
    }
  }'
```

## Service Management

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f dashboard

# Last 100 lines
docker compose logs --tail=100 backend
```

### Stop Services

```bash
# Stop all services (keeps data)
docker compose stop

# Stop and remove containers (keeps data)
docker compose down

# Stop and remove everything including volumes (⚠️ DELETES DATA)
docker compose down -v
```

### Restart Services

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart backend
```

### Rebuild Services

After code changes:

```bash
# Rebuild and restart all services
docker compose up -d --build

# Rebuild specific service
docker compose up -d --build backend
```

## Database Management

### Access PostgreSQL

```bash
# Connect to database
docker compose exec postgres psql -U multi_claude_user -d multi_claude_system

# Run SQL queries
docker compose exec postgres psql -U multi_claude_user -d multi_claude_system -c "SELECT COUNT(*) FROM agent_events;"
```

### Backup Database

```bash
# Create backup
docker compose exec postgres pg_dump -U multi_claude_user multi_claude_system > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
docker compose exec -T postgres psql -U multi_claude_user -d multi_claude_system < backup_20250101_120000.sql
```

### Reset Database

```bash
# Stop all services
docker compose down

# Remove database volume
docker volume rm multi-claude-postgres-data

# Start services (will recreate database)
docker compose up -d
```

## Development Workflow

### Local Development with Docker

1. **Start only database**:
   ```bash
   docker compose up -d postgres
   ```

2. **Run backend locally**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

3. **Run dashboard locally**:
   ```bash
   cd dashboard
   npm install
   npm run dev
   ```

### Hot Reload

For development with hot reload, use local development instead of Docker:

```bash
# Terminal 1: Database only
docker compose up postgres

# Terminal 2: Backend with watch mode
cd backend && npm run dev

# Terminal 3: Dashboard with hot reload
cd dashboard && npm run dev
```

## Port Mappings

| Service   | Internal Port | External Port | URL                         |
|-----------|---------------|---------------|-----------------------------|
| Postgres  | 5432          | 5432          | localhost:5432              |
| Backend   | 8080          | 8080          | http://localhost:8080       |
| Dashboard | 80            | 5173          | http://localhost:5173       |

## Volume Management

### List Volumes

```bash
docker volume ls | grep multi-claude
```

### Inspect Volume

```bash
docker volume inspect multi-claude-postgres-data
```

### Remove Volumes

```bash
# Remove all stopped containers and volumes
docker compose down -v

# Remove specific volume
docker volume rm multi-claude-postgres-data
```

## Health Checks

All services have health checks configured:

### Backend Health Check
```bash
curl http://localhost:8080/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-15T12:00:00.000Z",
  "components": [
    {"name": "event_queue", "status": "healthy"},
    {"name": "decision_engine", "status": "healthy"},
    {"name": "context_coordinator", "status": "healthy"},
    {"name": "action_executor", "status": "healthy"}
  ]
}
```

### Database Health Check
```bash
docker compose exec postgres pg_isready -U multi_claude_user
```

## Troubleshooting

### Port Already in Use

If you get "port already allocated" errors:

```bash
# Find process using port 8080
lsof -i :8080

# Kill the process (replace PID)
kill -9 <PID>

# Or use different ports in docker-compose.yml
```

### Database Connection Failed

```bash
# Check if postgres is healthy
docker compose ps postgres

# View postgres logs
docker compose logs postgres

# Verify connection
docker compose exec postgres pg_isready -U multi_claude_user -d multi_claude_system
```

### Backend Won't Start

```bash
# Check backend logs
docker compose logs backend

# Common issues:
# 1. Database not ready - wait for postgres to be healthy
# 2. Port conflict - check if 8080 is available
# 3. Build errors - rebuild with: docker compose build backend
```

### Dashboard Shows "Cannot Connect to API"

```bash
# Verify backend is running
curl http://localhost:8080/health

# Check dashboard environment
docker compose exec dashboard env | grep VITE_API_URL

# Rebuild dashboard
docker compose up -d --build dashboard
```

### Out of Memory

If services crash with OOM errors:

```bash
# Increase Docker memory limit in Docker Desktop settings
# Recommended: 4GB minimum

# Check container stats
docker stats
```

## Production Deployment

For production deployments:

1. **Set strong passwords**:
   ```bash
   # Generate secure password
   openssl rand -base64 32

   # Update .env file
   DB_PASSWORD=<generated_password>
   ```

2. **Use environment-specific compose file**:
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
   ```

3. **Enable SSL/TLS**:
   - Add nginx reverse proxy with SSL certificates
   - Update VITE_API_URL to HTTPS endpoint

4. **Configure monitoring**:
   - Add Prometheus metrics export
   - Configure log aggregation
   - Set up alerting

5. **Backup strategy**:
   - Automated daily database backups
   - Volume snapshots
   - Offsite backup storage

## Advanced Configuration

### Custom Network

```bash
# Create custom network
docker network create custom-network

# Update docker-compose.yml to use custom network
```

### Resource Limits

Add to docker-compose.yml:
```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Multiple Environments

```bash
# Development
docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# Staging
docker compose -f docker-compose.yml -f docker-compose.staging.yml up

# Production
docker compose -f docker-compose.yml -f docker-compose.prod.yml up
```

## Maintenance

### Update Images

```bash
# Pull latest base images
docker compose pull

# Rebuild with latest
docker compose build --pull

# Restart with updates
docker compose up -d
```

### Clean Up

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything unused
docker system prune -a --volumes
```

## Support

For issues or questions:
- Check logs: `docker compose logs -f`
- Verify health: `docker compose ps`
- Review documentation: `README.md`
- Submit issues to project repository

## Next Steps

1. Access the dashboard at http://localhost:5173
2. Submit test events via the Event Form
3. Monitor system health and metrics
4. Review processing pipeline logs
5. Explore the database schema

Happy coding with Multi-Claude 3.0! 🧠🚀
