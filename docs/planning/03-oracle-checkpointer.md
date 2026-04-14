# Oracle Checkpointer Design

## Overview
From LangGraph Checkpoint mechanism and MAW Guide crash recovery, we design OracleCheckpointer for state persistence in Oracle DB.

## Architecture
**From LangGraph BaseCheckpointSaver pattern:**
- Extend BaseCheckpointSaver interface
- Implement checkpoint save/load operations
- Use Oracle DB as persistence layer
- Enable resume from last checkpoint after crash

**From MAW Guide Checkpoint:**
- Save state before critical operations
- Enable crash recovery without restart from scratch
- Maintain 3-layer memory consistency

---

## Oracle DB Schema

### Table: agent_states
```sql
CREATE TABLE agent_states (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  state_type VARCHAR(50) NOT NULL, -- 'current', 'next', 'checkpoint'
  state_data TEXT NOT NULL, -- JSON serialized state
  metadata TEXT, -- JSON metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_agent_id (agent_id),
  INDEX idx_state_type (state_type),
  INDEX idx_created_at (created_at)
);
```

### Table: checkpoints
```sql
CREATE TABLE checkpoints (
  id VARCHAR(36) PRIMARY KEY,
  thread_id VARCHAR(36) NOT NULL,
  checkpoint_id VARCHAR(100) NOT NULL,
  checkpoint_data TEXT NOT NULL, -- JSON checkpoint
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE KEY unique_thread_checkpoint (thread_id, checkpoint_id),
  INDEX idx_thread_id (thread_id),
  INDEX idx_checkpoint_id (checkpoint_id)
);
```

### Table: memory_episodic
```sql
CREATE TABLE memory_episodic (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  episode_type VARCHAR(50) NOT NULL, -- 'conversation', 'task', 'event'
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  related_checkpoint_id VARCHAR(36),
  
  INDEX idx_agent_id (agent_id),
  INDEX idx_episode_type (episode_type),
  INDEX idx_timestamp (timestamp),
  FOREIGN KEY (related_checkpoint_id) REFERENCES checkpoints(id)
);
```

### Table: memory_semantic
```sql
CREATE TABLE memory_semantic (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  embedding BLOB NOT NULL, -- Vector embedding
  content TEXT NOT NULL,
  metadata TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_agent_id (agent_id)
);
```

### Table: memory_procedural
```sql
CREATE TABLE memory_procedural (
  id VARCHAR(36) PRIMARY KEY,
  agent_id VARCHAR(36) NOT NULL,
  skill_name VARCHAR(100) NOT NULL,
  procedure_data TEXT NOT NULL, -- JSON procedure
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_agent_id (agent_id),
  INDEX idx_skill_name (skill_name)
);
```

---

## TypeScript Implementation

### OracleCheckpointer Class
```typescript
/**
 * OracleCheckpointer - StateGraph Checkpoint Saver for Oracle DB
 * From LangGraph BaseCheckpointSaver pattern
 * From MAW Guide crash recovery mechanism
 */

import { BaseCheckpointSaver, Checkpoint } from '@langchain/langgraph';
import { OracleDB } from './oracle-db';

interface CheckpointTuple {
  config: Record<string, any>;
  checkpoint: Checkpoint;
  metadata?: Record<string, any>;
}

export class OracleCheckpointer extends BaseCheckpointSaver {
  private db: OracleDB;
  private threadId: string;

  constructor(db: OracleDB, threadId: string) {
    super();
    this.db = db;
    this.threadId = threadId;
  }

  /**
   * Save checkpoint to Oracle DB
   * From LangGraph put method
   */
  async put(
    config: Record<string, any>,
    checkpoint: Checkpoint,
    metadata?: Record<string, any>
  ): Promise<void> {
    const checkpointId = this.generateCheckpointId();
    
    // Save checkpoint
    await this.db.execute(`
      INSERT INTO checkpoints (id, thread_id, checkpoint_id, checkpoint_data, metadata)
      VALUES (?, ?, ?, ?, ?)
    `, [
      this.generateId(),
      this.threadId,
      checkpointId,
      JSON.stringify(checkpoint),
      JSON.stringify(metadata || {})
    ]);

    // Save agent states
    for (const [agentId, state] of Object.entries(checkpoint.channel_values || {})) {
      await this.db.execute(`
        INSERT INTO agent_states (id, agent_id, state_type, state_data, metadata)
        VALUES (?, ?, 'current', ?, ?)
      `, [
        this.generateId(),
        agentId,
        JSON.stringify(state),
        JSON.stringify({ checkpoint_id: checkpointId })
      ]);
    }

    // Save episodic memory if present
    if (checkpoint.metadata?.episodic_memory) {
      await this.saveEpisodicMemory(checkpointId, checkpoint.metadata.episodic_memory);
    }
  }

  /**
   * Get checkpoint from Oracle DB
   * From LangGraph get method
   */
  async get(config: Record<string, any>): Promise<CheckpointTuple | undefined> {
    const checkpointId = config.configurable?.checkpoint_id;
    
    if (!checkpointId) {
      return undefined;
    }

    // Get checkpoint
    const result = await this.db.query(`
      SELECT checkpoint_data, metadata
      FROM checkpoints
      WHERE thread_id = ? AND checkpoint_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `, [this.threadId, checkpointId]);

    if (!result || result.length === 0) {
      return undefined;
    }

    const checkpoint = JSON.parse(result[0].checkpoint_data);
    const metadata = JSON.parse(result[0].metadata || '{}');

    // Restore agent states
    const states = await this.db.query(`
      SELECT agent_id, state_data
      FROM agent_states
      WHERE metadata LIKE ?
    `, [`%"checkpoint_id":"${checkpointId}"%`]);

    for (const state of states) {
      checkpoint.channel_values = checkpoint.channel_values || {};
      checkpoint.channel_values[state.agent_id] = JSON.parse(state.state_data);
    }

    return {
      config,
      checkpoint,
      metadata
    };
  }

  /**
   * List all checkpoints for thread
   */
  async list(config: Record<string, any>): Promise<CheckpointTuple[]> {
    const results = await this.db.query(`
      SELECT checkpoint_id, checkpoint_data, metadata, created_at
      FROM checkpoints
      WHERE thread_id = ?
      ORDER BY created_at DESC
    `, [this.threadId]);

    return results.map(row => ({
      config: { ...config, configurable: { checkpoint_id: row.checkpoint_id } },
      checkpoint: JSON.parse(row.checkpoint_data),
      metadata: JSON.parse(row.metadata || '{}')
    }));
  }

  /**
   * Save episodic memory
   * From MAW Guide 3-layer memory
   */
  private async saveEpisodicMemory(checkpointId: string, memory: any[]): Promise<void> {
    for (const episode of memory) {
      await this.db.execute(`
        INSERT INTO memory_episodic (id, agent_id, episode_type, content, related_checkpoint_id)
        VALUES (?, ?, ?, ?, ?)
      `, [
        this.generateId(),
        episode.agent_id,
        episode.type,
        JSON.stringify(episode),
        checkpointId
      ]);
    }
  }

  /**
   * Restore episodic memory
   */
  async restoreEpisodicMemory(checkpointId: string): Promise<any[]> {
    const results = await this.db.query(`
      SELECT content
      FROM memory_episodic
      WHERE related_checkpoint_id = ?
      ORDER BY timestamp ASC
    `, [checkpointId]);

    return results.map(row => JSON.parse(row.content));
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate checkpoint ID
   */
  private generateCheckpointId(): string {
    return `chk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## Checkpoint Strategy

### When to Save Checkpoints
**From LangGraph + MAW Guide:**

1. **Before State Transitions**
   - Before CEO receives goal
   - Before Planner creates plan
   - Before Worker starts task
   - Before Critic reviews task

2. **After Critical Operations**
   - After CEO delegates task
   - After Planner assigns workers
   - After Worker completes subtask
   - After Critic approves task

3. **Periodic During Long Operations**
   - Every 30 seconds during long-running tasks
   - After every 5 tool calls
   - After every memory update

4. **Before Human Approval**
   - Save state before requesting approval
   - Enables resume after approval/rejection

### Checkpoint Data Structure
```typescript
interface Checkpoint {
  // Channel values (agent states)
  channel_values: {
    [agentId: string]: AgentState;
  };

  // Channel versions
  channel_versions: {
    [channelId: string]: number;
  };

  // Versions seen
  versions_seen: {
    [channelId: string]: number;
  };

  // Metadata
  metadata: {
    checkpoint_id: string;
    timestamp: number;
    phase: 'planning' | 'execution' | 'review';
    episodic_memory?: any[];
  };
}
```

---

## Crash Recovery Flow

### Recovery Steps
```typescript
/**
 * Recover from crash using checkpoint
 * From MAW Guide crash recovery
 */
async function recoverFromCrash(threadId: string): Promise<void> {
  const checkpointer = new OracleCheckpointer(db, threadId);
  
  // Get latest checkpoint
  const checkpoints = await checkpointer.list({ configurable: {} });
  
  if (checkpoints.length === 0) {
    console.log('No checkpoints found, starting fresh');
    return;
  }

  const latest = checkpoints[0];
  console.log(`Recovering from checkpoint: ${latest.config.configurable.checkpoint_id}`);

  // Restore state
  const state = latest.checkpoint.channel_values;
  
  // Restore episodic memory
  const memory = await checkpointer.restoreEpisodicMemory(
    latest.config.configurable.checkpoint_id
  );

  // Resume StateGraph from checkpoint
  const graph = new StateGraph(stateSchema);
  const runnable = graph.compile({ checkpointer });
  
  // Resume execution
  await runnable.invoke(null, { configurable: { threadId } });
  
  console.log('Recovery complete');
}
```

---

## Memory Layer Integration

### 3-Layer Memory (From MAW Guide)

#### 1. Episodic Memory
```typescript
/**
 * Episodic Memory - Events and conversations
 * Stored in memory_episodic table
 */
class EpisodicMemory {
  async save(agentId: string, episode: Episode): Promise<void> {
    await db.execute(`
      INSERT INTO memory_episodic (id, agent_id, episode_type, content, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `, [
      generateId(),
      agentId,
      episode.type,
      JSON.stringify(episode),
      Date.now()
    ]);
  }

  async retrieve(agentId: string, limit: number = 10): Promise<Episode[]> {
    const results = await db.query(`
      SELECT content
      FROM memory_episodic
      WHERE agent_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `, [agentId, limit]);

    return results.map(row => JSON.parse(row.content));
  }
}
```

#### 2. Semantic Memory
```typescript
/**
 * Semantic Memory - Vector embeddings for search
 * Stored in memory_semantic table
 */
class SemanticMemory {
  async save(agentId: string, content: string, embedding: number[]): Promise<void> {
    await db.execute(`
      INSERT INTO memory_semantic (id, agent_id, embedding, content)
      VALUES (?, ?, ?, ?)
    `, [
      generateId(),
      agentId,
      Buffer.from(new Float32Array(embedding)),
      content
    ]);
  }

  async search(queryEmbedding: number[], limit: number = 5): Promise<any[]> {
    // Vector similarity search
    const results = await db.query(`
      SELECT content, 1 - (embedding <=> ?) as similarity
      FROM memory_semantic
      ORDER BY similarity DESC
      LIMIT ?
    `, [Buffer.from(new Float32Array(queryEmbedding)), limit]);

    return results;
  }
}
```

#### 3. Procedural Memory
```typescript
/**
 * Procedural Memory - Skills and procedures
 * Stored in memory_procedural table
 */
class ProceduralMemory {
  async save(agentId: string, skillName: string, procedure: any): Promise<void> {
    await db.execute(`
      INSERT INTO memory_procedural (id, agent_id, skill_name, procedure_data)
      VALUES (?, ?, ?, ?)
    `, [
      generateId(),
      agentId,
      skillName,
      JSON.stringify(procedure)
    ]);
  }

  async retrieve(agentId: string, skillName: string): Promise<any | null> {
    const results = await db.query(`
      SELECT procedure_data
      FROM memory_procedural
      WHERE agent_id = ? AND skill_name = ?
    `, [agentId, skillName]);

    return results.length > 0 ? JSON.parse(results[0].procedure_data) : null;
  }
}
```

---

## Usage Example

### Integrating with StateGraph
```typescript
/**
 * From LangGraph StateGraph pattern
 */
import { StateGraph } from '@langchain/langgraph';
import { OracleCheckpointer } from './oracle-checkpointer';

// Initialize checkpointer
const db = new OracleDB('oracle-multi-agent');
const checkpointer = new OracleCheckpointer(db, 'thread-123');

// Create StateGraph
const graph = new StateGraph(stateSchema)
  .addNode('ceo', ceoNode)
  .addNode('planner', plannerNode)
  .addNode('worker', workerNode)
  .addEdge('ceo', 'planner')
  .addEdge('planner', 'worker');

// Compile with checkpointer
const runnable = graph.compile({ checkpointer });

// Execute with checkpointing
await runnable.invoke(
  { goal: 'Implement feature X' },
  { configurable: { threadId: 'thread-123' } }
);

// Recovery after crash
await recoverFromCrash('thread-123');
```

---

## Performance Considerations

### Optimization Strategies
1. **Batch Insertions**: Insert multiple states in single transaction
2. **Index Optimization**: Ensure proper indexes on frequently queried columns
3. **Checkpoint Pruning**: Delete old checkpoints (keep last 100 per thread)
4. **Compression**: Compress large state data before storage
5. **Async Writes**: Write checkpoints asynchronously to avoid blocking

### Pruning Strategy
```typescript
/**
 * Prune old checkpoints
 * Keep last 100 checkpoints per thread
 */
async function pruneOldCheckpoints(threadId: string): Promise<void> {
  await db.execute(`
    DELETE FROM checkpoints
    WHERE thread_id = ? AND id NOT IN (
      SELECT id FROM checkpoints
      WHERE thread_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    )
  `, [threadId, threadId]);
}
```

---

## Security Considerations

1. **Access Control**: Restrict checkpoint access by thread owner
2. **Encryption**: Encrypt sensitive state data
3. **Audit Logging**: Log all checkpoint operations
4. **Validation**: Validate checkpoint data before restoration
5. **Backup**: Regular backups of checkpoint tables
