import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

export class MemoryStore {
  constructor(dbPath) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this._init();
  }

  _init() {
    this.db.exec(`
      -- ============================================================
      -- CORE TABLES
      -- ============================================================

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'general',
        status TEXT DEFAULT 'idle',
        personality TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        last_active INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 1,
        tags TEXT DEFAULT '',
        -- Supersede pattern (from Oracle: "Nothing is Deleted")
        superseded_by INTEGER,
        superseded_at INTEGER,
        superseded_reason TEXT,
        -- Provenance
        source TEXT DEFAULT 'manual',
        project TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (superseded_by) REFERENCES memories(id)
      );

      -- ============================================================
      -- THREADED MESSAGES (Oracle forum pattern)
      -- ============================================================

      CREATE TABLE IF NOT EXISTS threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_by TEXT DEFAULT 'human',
        status TEXT DEFAULT 'active',  -- active, answered, closed
        assigned_to TEXT,
        project TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER,
        from_agent TEXT NOT NULL,
        to_agent TEXT,
        role TEXT DEFAULT 'human',    -- human, agent, system
        content TEXT NOT NULL,
        metadata TEXT,                 -- JSON: tool calls, search results, etc.
        read INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (thread_id) REFERENCES threads(id)
      );

      -- ============================================================
      -- TASKS
      -- ============================================================

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to TEXT,
        status TEXT DEFAULT 'pending',  -- pending, active, completed, failed
        priority INTEGER DEFAULT 1,
        result TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        completed_at INTEGER,
        FOREIGN KEY (thread_id) REFERENCES threads(id)
      );

      -- ============================================================
      -- TRACES (Oracle trace system)
      -- ============================================================

      CREATE TABLE IF NOT EXISTS traces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT UNIQUE NOT NULL,
        query TEXT NOT NULL,
        query_type TEXT DEFAULT 'general',  -- general, search, learn, debug
        -- Results
        found_files TEXT,           -- JSON array
        found_memories TEXT,        -- JSON array
        found_messages TEXT,        -- JSON array
        file_count INTEGER DEFAULT 0,
        memory_count INTEGER DEFAULT 0,
        -- Hierarchy
        parent_trace_id TEXT,
        depth INTEGER DEFAULT 0,
        -- Chain
        prev_trace_id TEXT,
        next_trace_id TEXT,
        -- Distillation
        status TEXT DEFAULT 'raw',  -- raw, reviewed, distilled
        insight TEXT,               -- Extracted insight
        -- Context
        agent_id TEXT,
        session_id TEXT,
        duration_ms INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      );

      -- ============================================================
      -- ANALYTICS (Oracle logging pattern)
      -- ============================================================

      CREATE TABLE IF NOT EXISTS search_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        agent_id TEXT,
        results_count INTEGER DEFAULT 0,
        search_time_ms INTEGER,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS learn_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        memory_id INTEGER,
        content_preview TEXT,
        category TEXT,
        concepts TEXT,  -- JSON array
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS access_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT,
        resource_type TEXT,  -- memory, message, task, thread
        resource_id INTEGER,
        access_type TEXT,    -- read, write, search
        created_at INTEGER DEFAULT (unixepoch())
      );

      -- ============================================================
      -- SUPERSEDE LOG (Oracle "Nothing is Deleted" audit trail)
      -- ============================================================

      CREATE TABLE IF NOT EXISTS supersede_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        old_id INTEGER NOT NULL,
        old_content TEXT,
        old_category TEXT,
        new_id INTEGER,
        reason TEXT,
        agent_id TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      -- ============================================================
      -- FTS5 VIRTUAL TABLES
      -- ============================================================

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content, tags, category,
        content='memories',
        content_rowid='id'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        content,
        content='messages',
        content_rowid='id'
      );

      -- ============================================================
      -- INDEXES
      -- ============================================================

      CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id);
      CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
      CREATE INDEX IF NOT EXISTS idx_memories_superseded ON memories(superseded_by);
      CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_agent);
      CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_traces_parent ON traces(parent_trace_id);
      CREATE INDEX IF NOT EXISTS idx_traces_prev ON traces(prev_trace_id);
      CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
    `);
  }

  // ================================================================
  // AGENTS
  // ================================================================

  registerAgent(id, name, role = 'general', personality = '') {
    this.db.prepare(
      "INSERT OR REPLACE INTO agents (id, name, role, personality, status, last_active) VALUES (?, ?, ?, ?, 'active', unixepoch())"
    ).run(id, name, role, personality);
  }

  getAgent(id) {
    return this.db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
  }

  getAgentByName(name) {
    return this.db.prepare('SELECT * FROM agents WHERE name = ?').get(name);
  }

  listAgents(status = null) {
    if (status) return this.db.prepare('SELECT * FROM agents WHERE status = ? ORDER BY name').all(status);
    return this.db.prepare('SELECT * FROM agents ORDER BY name').all();
  }

  updateAgentStatus(id, status) {
    this.db.prepare("UPDATE agents SET status = ?, last_active = unixepoch() WHERE id = ?").run(status, id);
  }

  // ================================================================
  // MEMORIES (with Supersede Pattern)
  // ================================================================

  addMemory(agentId, content, category = 'general', importance = 1, tags = '', source = 'manual') {
    const result = this.db.prepare(
      'INSERT INTO memories (agent_id, content, category, importance, tags, source) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(agentId, content, category, importance, tags, source);

    // Update FTS
    this.db.prepare(
      'INSERT INTO memories_fts (rowid, content, tags, category) VALUES (?, ?, ?, ?)'
    ).run(result.lastInsertRowid, content, tags, category);

    // Log learning
    this.db.prepare(
      'INSERT INTO learn_log (agent_id, memory_id, content_preview, category, concepts) VALUES (?, ?, ?, ?, ?)'
    ).run(agentId, result.lastInsertRowid, content.slice(0, 100), category, JSON.stringify(tags.split(',')));

    return result.lastInsertRowid;
  }

  supersedeMemory(oldId, newId, reason, agentId) {
    // Mark old as superseded (don't delete!)
    this.db.prepare(
      'UPDATE memories SET superseded_by = ?, superseded_at = unixepoch(), superseded_reason = ? WHERE id = ?'
    ).run(newId, reason, oldId);

    // Log supersession
    const old = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(oldId);
    if (old) {
      this.db.prepare(
        'INSERT INTO supersede_log (old_id, old_content, old_category, new_id, reason, agent_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(oldId, old.content, old.category, newId, reason, agentId);
    }
  }

  searchMemories(query, agentId = null, limit = 10) {
    const start = Date.now();
    let results;

    if (agentId) {
      results = this.db.prepare(`
        SELECT m.* FROM memories m
        JOIN memories_fts fts ON m.id = fts.rowid
        WHERE memories_fts MATCH ? AND m.agent_id = ? AND m.superseded_by IS NULL
        ORDER BY rank, m.importance DESC
        LIMIT ?
      `).all(query, agentId, limit);
    } else {
      results = this.db.prepare(`
        SELECT m.* FROM memories m
        JOIN memories_fts fts ON m.id = fts.rowid
        WHERE memories_fts MATCH ? AND m.superseded_by IS NULL
        ORDER BY rank, m.importance DESC
        LIMIT ?
      `).all(query, limit);
    }

    // Log search
    this.db.prepare(
      'INSERT INTO search_log (query, agent_id, results_count, search_time_ms) VALUES (?, ?, ?, ?)'
    ).run(query, agentId, results.length, Date.now() - start);

    return results;
  }

  getRecentMemories(agentId, limit = 20) {
    return this.db.prepare(
      'SELECT * FROM memories WHERE agent_id = ? AND superseded_by IS NULL ORDER BY created_at DESC LIMIT ?'
    ).all(agentId, limit);
  }

  getAllMemories(limit = 100) {
    return this.db.prepare('SELECT * FROM memories WHERE superseded_by IS NULL ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  // ================================================================
  // THREADED MESSAGES (Oracle forum pattern)
  // ================================================================

  createThread(title, createdBy = 'human', assignedTo = null) {
    const result = this.db.prepare(
      'INSERT INTO threads (title, created_by, assigned_to) VALUES (?, ?, ?)'
    ).run(title, createdBy, assignedTo);
    return { id: result.lastInsertRowid, title };
  }

  getThread(threadId) {
    return this.db.prepare('SELECT * FROM threads WHERE id = ?').get(threadId);
  }

  listThreads(status = null, limit = 20) {
    if (status) {
      return this.db.prepare('SELECT * FROM threads WHERE status = ? ORDER BY updated_at DESC LIMIT ?').all(status, limit);
    }
    return this.db.prepare('SELECT * FROM threads ORDER BY updated_at DESC LIMIT ?').all(limit);
  }

  updateThreadStatus(threadId, status) {
    this.db.prepare("UPDATE threads SET status = ?, updated_at = unixepoch() WHERE id = ?").run(status, threadId);
  }

  // Send message (optionally in a thread)
  sendMessage(fromAgent, content, toAgent = null, threadId = null, role = 'agent', metadata = null) {
    const result = this.db.prepare(
      'INSERT INTO messages (thread_id, from_agent, to_agent, role, content, metadata) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(threadId, fromAgent, toAgent, role, content, metadata ? JSON.stringify(metadata) : null);

    // Update thread timestamp
    if (threadId) {
      this.db.prepare("UPDATE threads SET updated_at = unixepoch() WHERE id = ?").run(threadId);
    }

    // Update FTS
    this.db.prepare(
      'INSERT INTO messages_fts (rowid, content) VALUES (?, ?)'
    ).run(result.lastInsertRowid, content);

    return result.lastInsertRowid;
  }

  getMessages(threadId = null, limit = 50) {
    if (threadId) {
      return this.db.prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT ?').all(threadId, limit);
    }
    return this.db.prepare('SELECT * FROM messages WHERE thread_id IS NULL ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  getDirectMessages(agent1, agent2, limit = 50) {
    return this.db.prepare(`
      SELECT * FROM messages
      WHERE (from_agent = ? AND to_agent = ?) OR (from_agent = ? AND to_agent = ?)
      ORDER BY created_at DESC LIMIT ?
    `).all(agent1, agent2, agent2, agent1, limit);
  }

  searchMessages(query, limit = 20) {
    const start = Date.now();
    const results = this.db.prepare(`
      SELECT m.* FROM messages m
      JOIN messages_fts fts ON m.id = fts.rowid
      WHERE messages_fts MATCH ?
      ORDER BY rank, m.created_at DESC
      LIMIT ?
    `).all(query, limit);

    this.db.prepare(
      'INSERT INTO search_log (query, results_count, search_time_ms) VALUES (?, ?, ?)'
    ).run(`msg:${query}`, results.length, Date.now() - start);

    return results;
  }

  getUnreadMessages(agentId) {
    return this.db.prepare(
      'SELECT * FROM messages WHERE to_agent = ? AND read = 0 ORDER BY created_at'
    ).all(agentId);
  }

  markRead(messageId) {
    this.db.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(messageId);
  }

  // ================================================================
  // TASKS
  // ================================================================

  createTask(title, description = '', assignedTo = null, priority = 1, threadId = null) {
    const result = this.db.prepare(
      'INSERT INTO tasks (thread_id, title, description, assigned_to, priority) VALUES (?, ?, ?, ?, ?)'
    ).run(threadId, title, description, assignedTo, priority);
    return { id: result.lastInsertRowid };
  }

  getNextTask(agentId) {
    return this.db.prepare(
      "SELECT * FROM tasks WHERE assigned_to = ? AND status = 'pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
    ).get(agentId);
  }

  getPendingTasks() {
    return this.db.prepare(
      "SELECT * FROM tasks WHERE status = 'pending' ORDER BY priority DESC, created_at ASC"
    ).all();
  }

  updateTaskStatus(taskId, status, result = null) {
    if (result) {
      this.db.prepare("UPDATE tasks SET status = ?, result = ?, completed_at = unixepoch() WHERE id = ?").run(status, result, taskId);
    } else {
      this.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, taskId);
    }
  }

  // ================================================================
  // TRACES
  // ================================================================

  createTrace(query, queryType = 'general', agentId = null, parentTraceId = null) {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const depth = parentTraceId
      ? (this.db.prepare('SELECT depth FROM traces WHERE trace_id = ?').get(parentTraceId)?.depth || 0) + 1
      : 0;

    this.db.prepare(
      'INSERT INTO traces (trace_id, query, query_type, agent_id, parent_trace_id, depth) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(traceId, query, queryType, agentId, parentTraceId, depth);

    return traceId;
  }

  updateTrace(traceId, data) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    values.push(traceId);
    this.db.prepare(`UPDATE traces SET ${fields.join(', ')} WHERE trace_id = ?`).run(...values);
  }

  linkTraces(prevTraceId, nextTraceId) {
    this.db.prepare('UPDATE traces SET next_trace_id = ? WHERE trace_id = ?').run(nextTraceId, prevTraceId);
    this.db.prepare('UPDATE traces SET prev_trace_id = ? WHERE trace_id = ?').run(prevTraceId, nextTraceId);
  }

  getTrace(traceId) {
    return this.db.prepare('SELECT * FROM traces WHERE trace_id = ?').get(traceId);
  }

  listTraces(agentId = null, limit = 20) {
    if (agentId) {
      return this.db.prepare('SELECT * FROM traces WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?').all(agentId, limit);
    }
    return this.db.prepare('SELECT * FROM traces ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  getTraceChain(traceId) {
    // Find head of chain
    let current = this.db.prepare('SELECT * FROM traces WHERE trace_id = ?').get(traceId);
    while (current?.prev_trace_id) {
      current = this.db.prepare('SELECT * FROM traces WHERE trace_id = ?').get(current.prev_trace_id);
    }
    // Walk forward
    const chain = [current];
    while (current?.next_trace_id) {
      current = this.db.prepare('SELECT * FROM traces WHERE trace_id = ?').get(current.next_trace_id);
      chain.push(current);
    }
    return chain;
  }

  // ================================================================
  // ANALYTICS
  // ================================================================

  logAccess(agentId, resourceType, resourceId, accessType) {
    this.db.prepare(
      'INSERT INTO access_log (agent_id, resource_type, resource_id, access_type) VALUES (?, ?, ?, ?)'
    ).run(agentId, resourceType, resourceId, accessType);
  }

  getSearchStats() {
    return this.db.prepare(`
      SELECT
        COUNT(*) as total_searches,
        AVG(search_time_ms) as avg_time_ms,
        AVG(results_count) as avg_results
      FROM search_log
      WHERE created_at > unixepoch() - 86400
    `).get();
  }

  getActivityTimeline(hours = 24) {
    return this.db.prepare(`
      SELECT 'search' as type, query as detail, created_at FROM search_log
      WHERE created_at > unixepoch() - ?
      UNION ALL
      SELECT 'learn' as type, content_preview as detail, created_at FROM learn_log
      WHERE created_at > unixepoch() - ?
      UNION ALL
      SELECT 'message' as type, substr(content, 1, 100) as detail, created_at FROM messages
      WHERE created_at > unixepoch() - ?
      ORDER BY created_at DESC
      LIMIT 100
    `).all(hours * 3600, hours * 3600, hours * 3600);
  }

  // ================================================================
  // STATS
  // ================================================================

  getStats() {
    const agents = this.db.prepare("SELECT COUNT(*) as count FROM agents").get();
    const activeAgents = this.db.prepare("SELECT COUNT(*) as count FROM agents WHERE status = 'active'").get();
    const memories = this.db.prepare("SELECT COUNT(*) as count FROM memories WHERE superseded_by IS NULL").get();
    const messages = this.db.prepare('SELECT COUNT(*) as count FROM messages').get();
    const pendingTasks = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'").get();
    const completedTasks = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get();
    const threads = this.db.prepare('SELECT COUNT(*) as count FROM threads').get();
    const traces = this.db.prepare('SELECT COUNT(*) as count FROM traces').get();
    const superseded = this.db.prepare('SELECT COUNT(*) as count FROM supersede_log').get();

    return {
      agents: agents.count,
      activeAgents: activeAgents.count,
      memories: memories.count,
      messages: messages.count,
      pendingTasks: pendingTasks.count,
      completedTasks: completedTasks.count,
      threads: threads.count,
      traces: traces.count,
      superseded: superseded.count,
    };
  }

  close() {
    this.db.close();
  }
}
