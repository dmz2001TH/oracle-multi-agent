# Oracle Multi-Agent Deployment Guide

## Prerequisites

- Node.js 18+ 
- Oracle Database (or Oracle Cloud DB)
- npm or yarn package manager

## Installation

```bash
# Install dependencies
npm install
```

## Environment Variables

Create a `.env` file in the project root:

```env
# LLM Configuration
MIMO_API_KEY=your_mimo_api_key_here
AGENT_MODEL=mimo-v2-pro

# Oracle Database
ORACLE_CONNECTION_STRING=oracle://user:password@host:port/service

# Ports (optional, defaults shown)
ORACLE_PORT=3456
AGENT_SERVICE_PORT=4000
ORACLE_DASHBOARD_PORT=3460
```

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MIMO_API_KEY` | API key for LLM provider (MiMo) | `sk-xxxxx` |
| `ORACLE_CONNECTION_STRING` | Oracle DB connection string | `oracle://user:pass@localhost:1521/XE` |

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ORACLE_PORT` | 3456 | Hono System port (reserved) |
| `ORACLE_DASHBOARD_PORT` | 3460 | Oracle Dashboard port |
| `AGENT_SERVICE_PORT` | 4000 | Agent service port |

## Database Setup

### Oracle DB Schema

The following tables are required:

```sql
-- Agent states table
CREATE TABLE agent_states (
  thread_id VARCHAR(255) PRIMARY KEY,
  agent_id VARCHAR(255),
  state VARCHAR(50),
  config CLOB,
  created_at TIMESTAMP DEFAULT SYSTIMESTAMP,
  updated_at TIMESTAMP DEFAULT SYSTIMESTAMP
);

-- Checkpoints table
CREATE TABLE checkpoints (
  thread_id VARCHAR(255) PRIMARY KEY,
  checkpoint CLOB,
  metadata CLOB,
  timestamp NUMBER,
  FOREIGN KEY (thread_id) REFERENCES agent_states(thread_id)
);
```

### Migration

```bash
# Run database migrations
npm run migrate
```

## Starting Services

### Option 1: Start All Services

```bash
# Start backend, dashboard, and agent service
npm run start:all
```

### Option 2: Start Services Individually

```bash
# Start original Hono System (port 3456)
npm start

# Start Oracle Dashboard (port 3460)
npm run start:dashboard

# Start agent service (port 4000)
npm run start:service
```

### Service Startup Order

1. **Oracle Database** - Ensure Oracle DB is running
2. **Hono System** - Start original backend (port 3456)
3. **Oracle Dashboard** - Start Oracle Dashboard (port 3460)
4. **Agent Service** - Start persistent agent service (port 4000)

## Port Allocation

| Port | Service | Endpoint | Purpose |
|------|---------|----------|---------|
| 3456 | Hono System | http://localhost:3456 | Original web + v2 API + /ws WebSocket |
| 3460 | Oracle Dashboard | http://localhost:3460/ | Oracle Dashboard UI |
| 3460 | Oracle Dashboard API | http://localhost:3460/health | Health check |
| 3460 | Oracle Dashboard WebSocket | ws://localhost:3460 | WebSocket connection |
| 4000 | Agent Service | http://localhost:4000/health | Agent service health |
| 4000 | Agent Service | http://localhost:4000/agents/status | Agent status endpoint |

**Note:** Port 3456 is reserved for the original Hono System with the existing web application and v2 API.

## Verification

### Health Checks

```bash
# Check Hono System health (port 3456)
curl http://localhost:3456/health

# Check Oracle Dashboard health (port 3460)
curl http://localhost:3460/health

# Check agent service health
curl http://localhost:4000/health

# Check agent status
curl http://localhost:4000/agents/status
```

Expected response for Oracle Dashboard:
```json
{
  "ok": true,
  "service": "dashboard-api",
  "port": 3460,
  "uptime": 123.45
}
```

### Smoke Test

```bash
# Run smoke test script
bash scripts/smoke-test.sh
```

## Dashboard Access

Once services are running, access the dashboards at:

**Original Hono System:**
```
http://localhost:3456/
```

**Oracle Dashboard:**
```
http://localhost:3460/
```

Or serve the dashboard static files:

```bash
# Serve Oracle Dashboard on port 3460
npx tsx api/serve-dashboard.ts
```

Then access at:
```
http://localhost:3460/index.html
```

## Agent Configuration

Agent configurations are defined in YAML files in the `agents/` directory:

- `agents/ceo.yaml` - CEO agent configuration
- `agents/planner.yaml` - Planner agent configuration
- `agents/worker-coder.yaml` - Coder worker configuration
- `agents/worker-researcher.yaml` - Researcher worker configuration
- `agents/critic.yaml` - Critic agent configuration

No hardcoded agent configurations - all loaded from YAML files.

## Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- tests/core/maw-lifecycle.test.ts
npm test -- tests/api/dashboard.test.ts
npm test -- tests/e2e/full-system.test.ts
```

## Production Deployment

### Docker Deployment (Recommended)

```bash
# Build Docker images
docker-compose build

# Start all services
docker-compose up -d
```

### Manual Deployment

```bash
# 1. Set environment variables
export MIMO_API_KEY=your_key
export ORACLE_CONNECTION_STRING=your_connection_string

# 2. Install dependencies
npm install --production

# 3. Run migrations
npm run migrate

# 4. Start services
npm run start:all
```

### Process Manager (PM2)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start npm --name "oracle-dashboard" -- run start:dashboard
pm2 start npm --name "oracle-agent-service" -- run start:service

# Save PM2 configuration
pm2 save
pm2 startup
```

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
netstat -ano | findstr :3456
netstat -ano | findstr :4000

# Kill process
taskkill /PID <PID> /F
```

### Database Connection Issues

- Verify Oracle DB is running
- Check connection string format
- Ensure firewall allows connection
- Verify credentials

### Agent Service Not Registering

- Check agent service is running on port 4000
- Verify auto-registration is enabled
- Check logs for heartbeat failures
- Ensure circuit breaker not in OPEN state

### WebSocket Connection Failed

- Verify dashboard server is running on port 3456
- Check firewall allows WebSocket connections
- Verify socket.io client version matches server
- Check browser console for errors

## Monitoring

### Logs

Backend logs are output to console. For production, configure logging to file:

```bash
# Redirect logs to file
npm run start:all > logs/oracle.log 2>&1
```

### Metrics

- **Agent Status** - Check `/agents/status` endpoint
- **Dashboard Health** - Check `/health` endpoint
- **Circuit Breaker State** - Monitor logs for circuit breaker events
- **Checkpoint Persistence** - Monitor Oracle DB checkpoint table

## Security Considerations

1. **API Keys** - Never commit `.env` file to version control
2. **Database Credentials** - Use strong passwords and rotate regularly
3. **WebSocket Authentication** - Implement token-based auth for production
4. **CORS** - Configure CORS for production domains only
5. **Rate Limiting** - Implement rate limiting on API endpoints

## Backup and Recovery

### Database Backup

```bash
# Export Oracle DB schema and data
expdp system/password@ORCL DIRECTORY=dp_dir DUMPFILE=oracle_backup.dmp
```

### Checkpoint Backup

Checkpoints are stored in Oracle DB. Regular database backups ensure checkpoint recovery.

### Configuration Backup

Backup agent YAML files:
```bash
tar -czf agents-backup.tar.gz agents/
```

## Scaling

### Horizontal Scaling

Run multiple agent service instances on different ports:

```bash
# Start agent service on port 4000
PORT=4000 npm run start:service

# Start another agent service on port 4001
PORT=4001 npm run start:service
```

### Load Balancing

Configure load balancer for dashboard port 3456 to distribute WebSocket connections.

## Support

For issues or questions:
- Check documentation in `docs/` directory
- Review architecture in `docs/ARCHITECTURE.md`
- Run smoke test: `bash scripts/smoke-test.sh`
- Check logs for error messages
