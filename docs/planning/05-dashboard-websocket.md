# Dashboard WebSocket Design

## Overview
From Soul-Brews WebSocket Dashboard pattern, we design the real-time dashboard for oracle-multi-agent on port 3456.

## Architecture
**From Soul-Brews Dashboard Design:**
- WebSocket streaming (not polling)
- Port 3456 (already in use)
- Goal input, Realtime log, Agent status cards, Approve button
- Human visibility and control

---

## WebSocket API Design

### Connection Endpoint
```
ws://localhost:3456/ws
```

### WebSocket Events

#### Client → Server Events

**1. goal_submit**
```typescript
{
  event: 'goal_submit',
  data: {
    goal: string,
    priority: 'low' | 'medium' | 'high',
    context?: Record<string, any>
  }
}
```

**2. agent_control**
```typescript
{
  event: 'agent_control',
  data: {
    agentId: string,
    action: 'wake' | 'sleep' | 'stop' | 'restart',
    reason?: string
  }
}
```

**3. approve_request**
```typescript
{
  event: 'approve_request',
  data: {
    requestId: string,
    approved: boolean,
    comment?: string
  }
}
```

**4. subscribe_logs**
```typescript
{
  event: 'subscribe_logs',
  data: {
    agentId?: string, // null for all agents
    level?: 'debug' | 'info' | 'warn' | 'error'
  }
}
```

**5. query_state**
```typescript
{
  event: 'query_state',
  data: {
    agentId?: string
  }
}
```

---

#### Server → Client Events

**1. log_stream**
```typescript
{
  event: 'log_stream',
  data: {
    agentId: string,
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    timestamp: number,
    metadata?: Record<string, any>
  }
}
```

**2. agent_status**
```typescript
{
  event: 'agent_status',
  data: {
    agentId: string,
    name: string,
    role: string,
    state: 'init' | 'active' | 'sleep' | 'blocked' | 'crash' | 'resume',
    circuitState: 'closed' | 'open' | 'half_open',
    progress: number, // 0-100
    currentTask: string | null,
    uptime: number,
    lastHeartbeat: number
  }
}
```

**3. approve_request**
```typescript
{
  event: 'approve_request',
  data: {
    requestId: string,
    agentId: string,
    decision: string,
    rationale: string,
    options: string[],
    timestamp: number
  }
}
```

**4. goal_update**
```typescript
{
  event: 'goal_update',
  data: {
    goalId: string,
    status: 'pending' | 'in_progress' | 'completed' | 'failed',
    progress: number,
    message: string
  }
}
```

**5. state_snapshot**
```typescript
{
  event: 'state_snapshot',
  data: {
    agents: AgentState[],
    tasks: Task[],
    systemState: SystemState
  }
}
```

**6. error**
```typescript
{
  event: 'error',
  data: {
    code: string,
    message: string,
    details?: any
  }
}
```

---

## WebSocket Server Implementation

### TypeScript Implementation
```typescript
/**
 * WebSocket Server for Dashboard
 * From Soul-Brews WebSocket streaming pattern
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface WebSocketClient {
  ws: WebSocket;
  subscriptions: {
    agentId?: string;
    logLevel?: string;
  };
}

class DashboardWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private httpServer: Server;

  constructor(httpServer: Server) {
    this.httpServer = httpServer;
    this.wss = new WebSocketServer({ server: this.httpServer, path: '/ws' });
    
    this.setupServer();
  }

  /**
   * Setup WebSocket server
   */
  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = this.generateClientId();
      
      console.log(`🔌 WebSocket connected: ${clientId}`);
      
      const client: WebSocketClient = {
        ws,
        subscriptions: {}
      };
      
      this.clients.set(clientId, client);
      
      // Send initial state
      this.sendStateSnapshot(clientId);
      
      // Handle client messages
      ws.on('message', (data: string) => {
        try {
          const message = JSON.parse(data);
          this.handleClientMessage(clientId, message);
        } catch (error) {
          console.error(`Invalid message from ${clientId}:`, error);
        }
      });
      
      // Handle disconnect
      ws.on('close', () => {
        console.log(`🔌 WebSocket disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });
      
      // Handle errors
      ws.on('error', (error) => {
        console.error(`WebSocket error for ${clientId}:`, error);
      });
    });
  }

  /**
   * Handle client message
   */
  private async handleClientMessage(clientId: string, message: any): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.event) {
      case 'goal_submit':
        await this.handleGoalSubmit(clientId, message.data);
        break;
      
      case 'agent_control':
        await this.handleAgentControl(clientId, message.data);
        break;
      
      case 'approve_request':
        await this.handleApproveRequest(clientId, message.data);
        break;
      
      case 'subscribe_logs':
        this.handleSubscribeLogs(clientId, message.data);
        break;
      
      case 'query_state':
        this.sendStateSnapshot(clientId);
        break;
      
      default:
        this.sendError(clientId, 'UNKNOWN_EVENT', `Unknown event: ${message.event}`);
    }
  }

  /**
   * Handle goal submission
   */
  private async handleGoalSubmit(clientId: string, data: any): Promise<void> {
    try {
      // Submit goal to CEO agent
      const goalId = await this.orchestrator.submitGoal(data);
      
      // Broadcast goal update
      this.broadcast({
        event: 'goal_update',
        data: {
          goalId,
          status: 'pending',
          progress: 0,
          message: 'Goal submitted to CEO'
        }
      });
    } catch (error) {
      this.sendError(clientId, 'GOAL_SUBMIT_FAILED', error.message);
    }
  }

  /**
   * Handle agent control
   */
  private async handleAgentControl(clientId: string, data: any): Promise<void> {
    try {
      await this.lifecycleManager.controlAgent(
        data.agentId,
        data.action,
        data.reason
      );
      
      // Broadcast updated status
      const status = await this.lifecycleManager.getAgentStatus(data.agentId);
      this.broadcastAgentStatus(status);
    } catch (error) {
      this.sendError(clientId, 'AGENT_CONTROL_FAILED', error.message);
    }
  }

  /**
   * Handle approval request response
   */
  private async handleApproveRequest(clientId: string, data: any): Promise<void> {
    try {
      await this.orchestrator.handleApproval(data);
      
      // Broadcast approval result
      this.broadcast({
        event: 'goal_update',
        data: {
          goalId: data.requestId,
          status: data.approved ? 'in_progress' : 'pending',
          message: data.approved ? 'Approved' : 'Rejected'
        }
      });
    } catch (error) {
      this.sendError(clientId, 'APPROVAL_FAILED', error.message);
    }
  }

  /**
   * Handle log subscription
   */
  private handleSubscribeLogs(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.subscriptions = {
        agentId: data.agentId,
        logLevel: data.level
      };
    }
  }

  /**
   * Send log stream to subscribed clients
   */
  sendLogStream(log: LogEntry): void {
    for (const [clientId, client] of this.clients.entries()) {
      // Check subscription
      if (client.subscriptions.agentId && client.subscriptions.agentId !== log.agentId) {
        continue;
      }
      
      if (client.subscriptions.logLevel && this.shouldFilterLog(log, client.subscriptions.logLevel)) {
        continue;
      }
      
      client.ws.send(JSON.stringify({
        event: 'log_stream',
        data: log
      }));
    }
  }

  /**
   * Broadcast agent status update
   */
  broadcastAgentStatus(status: AgentStatus): void {
    this.broadcast({
      event: 'agent_status',
      data: status
    });
  }

  /**
   * Broadcast approval request
   */
  broadcastApprovalRequest(request: ApprovalRequest): void {
    this.broadcast({
      event: 'approve_request',
      data: request
    });
  }

  /**
   * Send state snapshot to client
   */
  private sendStateSnapshot(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    const snapshot = this.orchestrator.getStateSnapshot();
    
    client.ws.send(JSON.stringify({
      event: 'state_snapshot',
      data: snapshot
    }));
  }

  /**
   * Broadcast to all clients
   */
  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  /**
   * Send error to client
   */
  private sendError(clientId: string, code: string, message: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.ws.send(JSON.stringify({
      event: 'error',
      data: { code, message }
    }));
  }

  /**
   * Generate client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Check if log should be filtered
   */
  private shouldFilterLog(log: LogEntry, level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(log.level) < levels.indexOf(level);
  }
}
```

---

## Dashboard UI Design

### Layout Structure
```typescript
/**
 * Dashboard UI Components
 * From Soul-Brews Dashboard design
 */

interface DashboardLayout {
  // Header
  header: {
    title: string;
    goalInput: GoalInputComponent;
  };

  // Main Content
  main: {
    left: {
      agentStatusCards: AgentStatusCard[];
    };
    center: {
      realtimeLog: LogStreamComponent;
    };
    right: {
      approvalPanel: ApprovalPanelComponent;
      taskBoard: TaskBoardComponent;
    };
  };

  // Footer
  footer: {
    systemStatus: SystemStatusComponent;
  };
}
```

### Component: Goal Input
```typescript
/**
 * Goal Input Component
 */
class GoalInputComponent {
  render(): string {
    return `
      <div class="goal-input">
        <h2>🎯 Submit Goal</h2>
        <textarea 
          id="goal-text" 
          placeholder="Enter your goal here..."
          rows="3"
        ></textarea>
        
        <div class="goal-controls">
          <select id="goal-priority">
            <option value="low">Low Priority</option>
            <option value="medium" selected>Medium Priority</option>
            <option value="high">High Priority</option>
          </select>
          
          <button id="submit-goal" class="btn-primary">
            Submit Goal
          </button>
        </div>
      </div>
    `;
  }

  setup(ws: WebSocket): void {
    const submitBtn = document.getElementById('submit-goal');
    const goalText = document.getElementById('goal-text');
    const goalPriority = document.getElementById('goal-priority');

    submitBtn.addEventListener('click', () => {
      const goal = goalText.value.trim();
      if (!goal) return;

      ws.send(JSON.stringify({
        event: 'goal_submit',
        data: {
          goal,
          priority: goalPriority.value
        }
      }));

      goalText.value = '';
    });
  }
}
```

### Component: Agent Status Card
```typescript
/**
 * Agent Status Card
 */
class AgentStatusCard {
  private agentId: string;

  constructor(agentId: string) {
    this.agentId = agentId;
  }

  render(status: AgentStatus): string {
    const stateColor = this.getStateColor(status.state);
    const circuitColor = this.getCircuitColor(status.circuitState);

    return `
      <div class="agent-card" id="agent-${this.agentId}">
        <div class="agent-header">
          <h3>${status.name}</h3>
          <span class="agent-role">${status.role}</span>
        </div>
        
        <div class="agent-status">
          <span class="status-badge" style="background: ${stateColor}">
            ${status.state}
          </span>
          <span class="circuit-badge" style="background: ${circuitColor}">
            Circuit: ${status.circuitState}
          </span>
        </div>
        
        <div class="agent-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${status.progress}%"></div>
          </div>
          <span class="progress-text">${status.progress}%</span>
        </div>
        
        <div class="agent-task">
          ${status.currentTask ? `Task: ${status.currentTask}` : 'Idle'}
        </div>
        
        <div class="agent-controls">
          <button class="btn-wake" data-agent="${this.agentId}">Wake</button>
          <button class="btn-sleep" data-agent="${this.agentId}">Sleep</button>
          <button class="btn-stop" data-agent="${this.agentId}">Stop</button>
        </div>
        
        <div class="agent-metrics">
          <small>Uptime: ${this.formatUptime(status.uptime)}</small>
          <small>Last heartbeat: ${this.formatTime(status.lastHeartbeat)}</small>
        </div>
      </div>
    `;
  }

  private getStateColor(state: string): string {
    const colors = {
      init: '#6c757d',
      active: '#28a745',
      sleep: '#17a2b8',
      blocked: '#ffc107',
      crash: '#dc3545',
      resume: '#6f42c1'
    };
    return colors[state] || '#6c757d';
  }

  private getCircuitColor(state: string): string {
    const colors = {
      closed: '#28a745',
      open: '#dc3545',
      half_open: '#ffc107'
    };
    return colors[state] || '#6c757d';
  }

  private formatUptime(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  private formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }
}
```

### Component: Realtime Log
```typescript
/**
 * Realtime Log Stream
 */
class LogStreamComponent {
  private logs: LogEntry[] = [];
  private maxLogs = 100;

  render(): string {
    return `
      <div class="log-stream">
        <h3>📋 Realtime Logs</h3>
        
        <div class="log-controls">
          <select id="log-filter">
            <option value="">All Agents</option>
            <option value="Mother">Mother</option>
            <option value="Neo">Neo</option>
          </select>
          
          <select id="log-level">
            <option value="">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          
          <button id="clear-logs">Clear</button>
        </div>
        
        <div id="log-container" class="log-container">
          ${this.logs.map(log => this.renderLogEntry(log)).join('')}
        </div>
      </div>
    `;
  }

  private renderLogEntry(log: LogEntry): string {
    const levelColor = this.getLevelColor(log.level);
    const time = new Date(log.timestamp).toLocaleTimeString();

    return `
      <div class="log-entry level-${log.level}">
        <span class="log-time">${time}</span>
        <span class="log-agent">${log.agentId}</span>
        <span class="log-level" style="color: ${levelColor}">${log.level.toUpperCase()}</span>
        <span class="log-message">${log.message}</span>
      </div>
    `;
  }

  addLog(log: LogEntry): void {
    this.logs.push(log);
    
    // Keep only last N logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Update UI
    this.updateUI();
  }

  private getLevelColor(level: string): string {
    const colors = {
      debug: '#6c757d',
      info: '#17a2b8',
      warn: '#ffc107',
      error: '#dc3545'
    };
    return colors[level] || '#6c757d';
  }

  private updateUI(): void {
    const container = document.getElementById('log-container');
    if (container) {
      container.innerHTML = this.logs.map(log => this.renderLogEntry(log)).join('');
      container.scrollTop = container.scrollHeight;
    }
  }
}
```

### Component: Approval Panel
```typescript
/**
 * Approval Panel for Human-in-the-Loop
 */
class ApprovalPanelComponent {
  private pendingRequests: ApprovalRequest[] = [];

  render(): string {
    return `
      <div class="approval-panel">
        <h3>✋ Pending Approvals</h3>
        
        <div id="approval-list" class="approval-list">
          ${this.pendingRequests.length === 0 
            ? '<p class="no-approvals">No pending approvals</p>'
            : this.pendingRequests.map(req => this.renderRequest(req)).join('')
          }
        </div>
      </div>
    `;
  }

  private renderRequest(request: ApprovalRequest): string {
    return `
      <div class="approval-request" id="request-${request.requestId}">
        <div class="request-header">
          <span class="request-agent">${request.agentId}</span>
          <span class="request-time">${new Date(request.timestamp).toLocaleTimeString()}</span>
        </div>
        
        <div class="request-decision">
          <strong>Decision:</strong> ${request.decision}
        </div>
        
        <div class="request-rationale">
          <strong>Rationale:</strong> ${request.rationale}
        </div>
        
        ${request.options.length > 0 ? `
          <div class="request-options">
            <strong>Options:</strong>
            <ul>
              ${request.options.map(opt => `<li>${opt}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
        
        <div class="request-actions">
          <button class="btn-approve" data-request="${request.requestId}">
            Approve
          </button>
          <button class="btn-reject" data-request="${request.requestId}">
            Reject
          </button>
          <input 
            type="text" 
            class="approval-comment" 
            placeholder="Add comment..."
            data-request="${request.requestId}"
          >
        </div>
      </div>
    `;
  }

  addRequest(request: ApprovalRequest): void {
    this.pendingRequests.push(request);
    this.updateUI();
  }

  removeRequest(requestId: string): void {
    this.pendingRequests = this.pendingRequests.filter(r => r.requestId !== requestId);
    this.updateUI();
  }

  private updateUI(): void {
    const container = document.getElementById('approval-list');
    if (container) {
      container.innerHTML = this.pendingRequests.length === 0
        ? '<p class="no-approvals">No pending approvals</p>'
        : this.pendingRequests.map(req => this.renderRequest(req)).join('');
    }
  }
}
```

---

## Integration with Backend

### WebSocket Server Integration
```typescript
/**
 * Integrate WebSocket server with existing backend
 */
import { createServer } from 'http';
import { DashboardWebSocketServer } from './dashboard-websocket';
import { Orchestrator } from './orchestrator';
import { LifecycleManager } from './lifecycle-manager';

const httpServer = createServer();
const orchestrator = new Orchestrator();
const lifecycleManager = new LifecycleManager();

// Create WebSocket server
const wsServer = new DashboardWebSocketServer(httpServer);

// Connect to orchestrator and lifecycle manager
wsServer.setOrchestrator(orchestrator);
wsServer.setLifecycleManager(lifecycleManager);

// Start server on port 3456
httpServer.listen(3456, () => {
  console.log('🌐 Dashboard WebSocket server listening on port 3456');
  console.log('🔌 WebSocket endpoint: ws://localhost:3456/ws');
});
```

### Log Streaming Integration
```typescript
/**
 * Stream logs from agents to dashboard
 */
lifecycleManager.on('log', (log: LogEntry) => {
  wsServer.sendLogStream(log);
});

lifecycleManager.on('agentStatusChange', (status: AgentStatus) => {
  wsServer.broadcastAgentStatus(status);
});

orchestrator.on('approvalRequest', (request: ApprovalRequest) => {
  wsServer.broadcastApprovalRequest(request);
});
```

---

## WebSocket Security

### Authentication
```typescript
/**
 * WebSocket authentication
 */
class WebSocketAuth {
  /**
   * Authenticate WebSocket connection
   */
  static authenticate(ws: WebSocket, req: any): boolean {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    
    if (!token) {
      ws.close(1008, 'No token provided');
      return false;
    }
    
    // Verify token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      return true;
    } catch (error) {
      ws.close(1008, 'Invalid token');
      return false;
    }
  }
}
```

### Rate Limiting
```typescript
/**
 * Rate limit WebSocket messages
 */
class WebSocketRateLimiter {
  private messageCounts: Map<string, number[]> = new Map();

  checkRateLimit(clientId: string): boolean {
    const now = Date.now();
    const window = 60000; // 1 minute
    const maxMessages = 100;

    const messages = this.messageCounts.get(clientId) || [];
    
    // Filter messages within window
    const recentMessages = messages.filter(time => now - time < window);
    
    if (recentMessages.length >= maxMessages) {
      return false;
    }
    
    recentMessages.push(now);
    this.messageCounts.set(clientId, recentMessages);
    
    return true;
  }
}
```

---

## Performance Optimization

### Message Batching
```typescript
/**
 * Batch log messages to reduce WebSocket traffic
 */
class LogBatcher {
  private batch: LogEntry[] = [];
  private batchSize = 10;
  private batchInterval = 1000; // 1 second

  constructor(private wsServer: DashboardWebSocketServer) {
    setInterval(() => this.flush(), this.batchInterval);
  }

  addLog(log: LogEntry): void {
    this.batch.push(log);
    
    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.batch.length === 0) return;

    this.batch.forEach(log => {
      this.wsServer.sendLogStream(log);
    });

    this.batch = [];
  }
}
```

---

## Testing

### WebSocket Connection Test
```typescript
/**
 * Test WebSocket connection
 */
async function testWebSocketConnection(): Promise<void> {
  const ws = new WebSocket('ws://localhost:3456/ws');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    // Test goal submission
    ws.send(JSON.stringify({
      event: 'goal_submit',
      data: {
        goal: 'Test goal',
        priority: 'medium'
      }
    }));
  });
  
  ws.on('message', (data: string) => {
    const message = JSON.parse(data);
    console.log('📩 Received:', message);
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
}
```
