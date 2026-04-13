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
        -- Supersede pattern (Oracle: "Nothing is Deleted")
        superseded_by INTEGER,
        superseded_at INTEGER,
        superseded_reason TEXT,
        -- Provenance
        source TEXT DEFAULT 'manual',
        project TEXT,
        -- Semantic: pre-computed keyword bag for similarity
        keywords TEXT DEFAULT '',
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (agent_id) REFERENCES agents(id),
        FOREIGN KEY (superseded_by) REFERENCES memories(id)
      );

      -- ============================================================
      -- ψ/ STRUCTURE (Oracle philosophy folders)
      -- ============================================================

      CREATE TABLE IF NOT EXISTS psi_inbox (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        status TEXT DEFAULT 'open',      -- open, in_progress, done
        priority INTEGER DEFAULT 1,
        assigned_to TEXT,
        created_by TEXT DEFAULT 'human',
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS psi_writing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        category TEXT DEFAULT 'general',  -- general, doc, report, note
        version INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS psi_lab (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        experiment TEXT NOT NULL,
        hypothesis TEXT,
        result TEXT,
        status TEXT DEFAULT 'running',   -- running, succeeded, failed
        created_at INTEGER DEFAULT (unixepoch()),
        completed_at INTEGER
      );

      -- ============================================================
      -- THREADED MESSAGES (Oracle forum pattern)
      -- ============================================================

      CREATE TABLE IF NOT EXISTS threads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_by TEXT DEFAULT 'human',
        status TEXT DEFAULT 'active',
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
        role TEXT DEFAULT 'human',
        content TEXT NOT NULL,
        metadata TEXT,
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
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 1,
        result TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        completed_at INTEGER,
        FOREIGN KEY (thread_id) REFERENCES threads(id)
      );

      -- ============================================================
      -- TRACES
      -- ============================================================

      CREATE TABLE IF NOT EXISTS traces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trace_id TEXT UNIQUE NOT NULL,
        query TEXT NOT NULL,
        query_type TEXT DEFAULT 'general',
        found_files TEXT,
        found_memories TEXT,
        found_messages TEXT,
        file_count INTEGER DEFAULT 0,
        memory_count INTEGER DEFAULT 0,
        message_count INTEGER DEFAULT 0,
        parent_trace_id TEXT,
        depth INTEGER DEFAULT 0,
        prev_trace_id TEXT,
        next_trace_id TEXT,
        status TEXT DEFAULT 'raw',
        insight TEXT,
        agent_id TEXT,
        session_id TEXT,
        duration_ms INTEGER,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      );

      -- ============================================================
      -- ANALYTICS
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
        concepts TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS access_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT,
        resource_type TEXT,
        resource_id INTEGER,
        access_type TEXT,
        created_at INTEGER DEFAULT (unixepoch())
      );

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
      -- AGENT STATE PERSISTENCE
      -- ============================================================

      CREATE TABLE IF NOT EXISTS agent_states (
        id TEXT PRIMARY KEY,
        name TEXT,
        role TEXT,
        personality TEXT,
        conversation_history TEXT DEFAULT '[]',
        memory_cache TEXT DEFAULT '[]',
        message_queue TEXT DEFAULT '[]',
        saved_at INTEGER DEFAULT (unixepoch())
      );

      -- ============================================================
      -- HANDOFFS
      -- ============================================================

      CREATE TABLE IF NOT EXISTS handoffs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        from_session TEXT,
        to_session TEXT,
        context TEXT,
        status TEXT DEFAULT 'pending',
        created_at INTEGER DEFAULT (unixepoch())
      );

      -- ============================================================
      -- FLEET CONFIG (multi-agent orchestration)
      -- ============================================================

      CREATE TABLE IF NOT EXISTS fleet_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        template TEXT NOT NULL,          -- JSON: team composition
        active INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch())
      );

      -- ============================================================
      -- FTS5 VIRTUAL TABLES
      -- ============================================================

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content, tags, category, keywords,
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

      -- FTS sync triggers (external content tables need triggers, not manual INSERT)
      CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
        INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
      END;
      CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
      END;
      CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
        INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.id, old.content);
        INSERT INTO messages_fts(rowid, content) VALUES (new.id, new.content);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content, tags, category, keywords) VALUES (new.id, new.content, new.tags, new.category, new.keywords);
      END;
      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, tags, category, keywords) VALUES('delete', old.id, old.content, old.tags, old.category, old.keywords);
      END;
      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, content, tags, category, keywords) VALUES('delete', old.id, old.content, old.tags, old.category, old.keywords);
        INSERT INTO memories_fts(rowid, content, tags, category, keywords) VALUES (new.id, new.content, new.tags, new.category, new.keywords);
      END;
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_traces_parent ON traces(parent_trace_id);
      CREATE INDEX IF NOT EXISTS idx_psi_inbox_status ON psi_inbox(status);
      CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);

      -- Register system agents
      INSERT OR IGNORE INTO agents (id, name, role, status, personality)
      VALUES ('system', 'System', 'system', 'active', 'System agent for handoffs and metadata');
      INSERT OR IGNORE INTO agents (id, name, role, status, personality)
      VALUES ('human', 'Human', 'human', 'active', 'Human user');
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
  // MEMORIES (with Supersede + Semantic Search)
  // ================================================================

  _extractKeywords(text) {
    // Simple keyword extraction: lowercase, split, filter stop words, unique
    const stopWords = new Set(['the','a','an','is','are','was','were','be','been','being','have','has','had',
      'do','does','did','will','would','shall','should','may','might','can','could','of','in','to','for',
      'with','on','at','by','from','as','into','through','during','before','after','above','below','and',
      'but','or','nor','not','no','so','if','then','than','too','very','just','about','also','that','this',
      'it','its','i','me','my','we','our','you','your','he','she','they','them','what','which','who',
      'when','where','how','all','each','every','both','few','more','most','other','some','such','only',
      'same','than','too','very','คือ','ของ','ใน','ที่','มี','และ','หรือ','แต่','ก็','ได้','จะ','ไม่',
      'แล้ว','อยู่','ไป','มา','ให้','ถ้า','เพราะ','เลย','นะ','ครับ','ค่ะ','เอา','ทำ','กับ']);
    const words = text.toLowerCase().replace(/[^\wก-๙\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
    return [...new Set(words)].slice(0, 30).join(' ');
  }

  addMemory(agentId, content, category = 'general', importance = 1, tags = '', source = 'manual') {
    const keywords = this._extractKeywords(content + ' ' + tags + ' ' + category);
    const result = this.db.prepare(
      'INSERT INTO memories (agent_id, content, category, importance, tags, source, keywords) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(agentId, content, category, importance, tags, source, keywords);

    // FTS sync handled by trigger — no manual INSERT needed

    this.db.prepare(
      'INSERT INTO learn_log (agent_id, memory_id, content_preview, category, concepts) VALUES (?, ?, ?, ?, ?)'
    ).run(agentId, result.lastInsertRowid, content.slice(0, 100), category, JSON.stringify(tags.split(',')));

    return result.lastInsertRowid;
  }

  supersedeMemory(oldId, newId, reason, agentId) {
    this.db.prepare(
      'UPDATE memories SET superseded_by = ?, superseded_at = unixepoch(), superseded_reason = ? WHERE id = ?'
    ).run(newId, reason, oldId);

    const old = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(oldId);
    if (old) {
      this.db.prepare(
        'INSERT INTO supersede_log (old_id, old_content, old_category, new_id, reason, agent_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(oldId, old.content, old.category, newId, reason, agentId);
    }
  }

  /** @param {string|null} [agentId] */
  searchMemories(query, agentId = null, limit = 10) {
    const start = Date.now();
    let results = [];

    // Try FTS5 first
    try {
      if (agentId) {
        results = this.db.prepare(`
          SELECT m.* FROM memories m
          JOIN memories_fts fts ON m.id = fts.rowid
          WHERE memories_fts MATCH ? AND m.agent_id = ? AND m.superseded_by IS NULL
          ORDER BY m.importance DESC
          LIMIT ?
        `).all(query, agentId, limit);
      } else {
        results = this.db.prepare(`
          SELECT m.* FROM memories m
          JOIN memories_fts fts ON m.id = fts.rowid
          WHERE memories_fts MATCH ? AND m.superseded_by IS NULL
          ORDER BY m.importance DESC
          LIMIT ?
        `).all(query, limit);
      }
    } catch {
      // FTS parse error — fallback to LIKE search
      results = [];
    }

    // Fallback: LIKE search if FTS returned nothing
    if (results.length === 0) {
      const q = `%${query}%`;
      if (agentId) {
        results = this.db.prepare(
          'SELECT * FROM memories WHERE (content LIKE ? OR tags LIKE ? OR keywords LIKE ?) AND agent_id = ? AND superseded_by IS NULL ORDER BY importance DESC, created_at DESC LIMIT ?'
        ).all(q, q, q, agentId, limit);
      } else {
        results = this.db.prepare(
          'SELECT * FROM memories WHERE (content LIKE ? OR tags LIKE ? OR keywords LIKE ?) AND superseded_by IS NULL ORDER BY importance DESC, created_at DESC LIMIT ?'
        ).all(q, q, q, limit);
      }
    }

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
  // ψ/ INBOX
  // ================================================================

  psiInboxAdd(title, content = '', priority = 1, createdBy = 'human') {
    const r = this.db.prepare(
      'INSERT INTO psi_inbox (title, content, priority, created_by) VALUES (?, ?, ?, ?)'
    ).run(title, content, priority, createdBy);
    return { id: r.lastInsertRowid, title };
  }

  psiInboxList(status = null, limit = 50) {
    if (status) return this.db.prepare('SELECT * FROM psi_inbox WHERE status = ? ORDER BY priority DESC, created_at DESC LIMIT ?').all(status, limit);
    return this.db.prepare('SELECT * FROM psi_inbox ORDER BY priority DESC, created_at DESC LIMIT ?').all(limit);
  }

  psiInboxUpdate(id, data) {
    const fields = []; const vals = [];
    for (const [k,v] of Object.entries(data)) { fields.push(`${k} = ?`); vals.push(v); }
    vals.push(id);
    this.db.prepare(`UPDATE psi_inbox SET ${fields.join(', ')}, updated_at = unixepoch() WHERE id = ?`).run(...vals);
  }

  // ================================================================
  // ψ/ WRITING
  // ================================================================

  psiWritingSave(title, content, category = 'general') {
    // Upsert by title
    const existing = this.db.prepare('SELECT * FROM psi_writing WHERE title = ?').get(title);
    if (existing) {
      this.db.prepare('UPDATE psi_writing SET content = ?, category = ?, version = version + 1, updated_at = unixepoch() WHERE id = ?')
        .run(content, category, existing.id);
      return { id: existing.id, version: existing.version + 1 };
    }
    const r = this.db.prepare('INSERT INTO psi_writing (title, content, category) VALUES (?, ?, ?)').run(title, content, category);
    return { id: r.lastInsertRowid, version: 1 };
  }

  psiWritingList(limit = 50) {
    return this.db.prepare('SELECT * FROM psi_writing ORDER BY updated_at DESC LIMIT ?').all(limit);
  }

  psiWritingGet(title) {
    return this.db.prepare('SELECT * FROM psi_writing WHERE title = ?').get(title);
  }

  // ================================================================
  // ψ/ LAB
  // ================================================================

  psiLabAdd(experiment, hypothesis = '') {
    const r = this.db.prepare('INSERT INTO psi_lab (experiment, hypothesis) VALUES (?, ?)').run(experiment, hypothesis);
    return { id: r.lastInsertRowid };
  }

  psiLabComplete(id, result, status = 'succeeded') {
    this.db.prepare('UPDATE psi_lab SET result = ?, status = ?, completed_at = unixepoch() WHERE id = ?').run(result, status, id);
  }

  psiLabList(limit = 20) {
    return this.db.prepare('SELECT * FROM psi_lab ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  // ================================================================
  // THREADED MESSAGES
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

  sendMessage(fromAgent, content, toAgent = null, threadId = null, role = 'agent', metadata = null) {
    const result = this.db.prepare(
      'INSERT INTO messages (thread_id, from_agent, to_agent, role, content, metadata) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(threadId, fromAgent, toAgent, role, content, metadata ? JSON.stringify(metadata) : null);

    if (threadId) {
      this.db.prepare("UPDATE threads SET updated_at = unixepoch() WHERE id = ?").run(threadId);
    }

    // FTS sync handled by triggers — no manual INSERT needed
    // (direct INSERT into FTS5 external content tables fails with FK constraints)

    return result.lastInsertRowid;
  }

  getMessages(threadId = null, limit = 50) {
    if (threadId) {
      return this.db.prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC LIMIT ?').all(threadId, limit);
    }
    return this.db.prepare('SELECT * FROM messages WHERE thread_id IS NULL ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  searchMessages(query, limit = 20) {
    const start = Date.now();
    let results;
    try {
      results = this.db.prepare(`
        SELECT m.* FROM messages m
        JOIN messages_fts fts ON m.id = fts.rowid
        WHERE messages_fts MATCH ?
        ORDER BY rank, m.created_at DESC
        LIMIT ?
      `).all(query, limit);
    } catch {
      results = this.db.prepare('SELECT * FROM messages WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?').all(`%${query}%`, limit);
    }

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

  getAllTasks() {
    return this.db.prepare('SELECT * FROM tasks ORDER BY status, priority DESC, created_at DESC').all();
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
    const fields = []; const values = [];
    for (const [key, value] of Object.entries(data)) { fields.push(`${key} = ?`); values.push(value); }
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
    if (agentId) return this.db.prepare('SELECT * FROM traces WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?').all(agentId, limit);
    return this.db.prepare('SELECT * FROM traces ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  getTraceChain(traceId) {
    let current = this.db.prepare('SELECT * FROM traces WHERE trace_id = ?').get(traceId);
    while (current?.prev_trace_id) {
      current = this.db.prepare('SELECT * FROM traces WHERE trace_id = ?').get(current.prev_trace_id);
    }
    const chain = [current];
    while (current?.next_trace_id) {
      current = this.db.prepare('SELECT * FROM traces WHERE trace_id = ?').get(current.next_trace_id);
      chain.push(current);
    }
    return chain;
  }

  // ================================================================
  // FLEET CONFIGS
  // ================================================================

  saveFleetConfig(name, template) {
    this.db.prepare(
      'INSERT OR REPLACE INTO fleet_configs (name, template, updated_at) VALUES (?, ?, unixepoch())'
    ).run(name, JSON.stringify(template));
  }

  getFleetConfig(name) {
    const row = this.db.prepare('SELECT * FROM fleet_configs WHERE name = ?').get(name);
    return row ? { ...row, template: JSON.parse(row.template) } : null;
  }

  listFleetConfigs() {
    return this.db.prepare('SELECT * FROM fleet_configs ORDER BY updated_at DESC').all();
  }

  // ================================================================
  // ANALYTICS
  // ================================================================

  logAccess(agentId, resourceType, resourceId, accessType) {
    this.db.prepare('INSERT INTO access_log (agent_id, resource_type, resource_id, access_type) VALUES (?, ?, ?, ?)').run(agentId, resourceType, resourceId, accessType);
  }

  getSearchStats() {
    return this.db.prepare(`
      SELECT COUNT(*) as total_searches, AVG(search_time_ms) as avg_time_ms, AVG(results_count) as avg_results
      FROM search_log WHERE created_at > unixepoch() - 86400
    `).get();
  }

  getActivityTimeline(hours = 24) {
    const s = hours * 3600;
    return this.db.prepare(`
      SELECT 'search' as type, query as detail, created_at FROM search_log WHERE created_at > unixepoch() - ?
      UNION ALL
      SELECT 'learn' as type, content_preview as detail, created_at FROM learn_log WHERE created_at > unixepoch() - ?
      UNION ALL
      SELECT 'message' as type, substr(content, 1, 100) as detail, created_at FROM messages WHERE created_at > unixepoch() - ?
      UNION ALL
      SELECT 'task' as type, title as detail, created_at FROM tasks WHERE created_at > unixepoch() - ?
      UNION ALL
      SELECT 'inbox' as type, title as detail, created_at FROM psi_inbox WHERE created_at > unixepoch() - ?
      ORDER BY created_at DESC LIMIT 100
    `).all(s, s, s, s, s);
  }

  // ================================================================
  // STATS
  // ================================================================

  getStats() {
    const q = (sql) => this.db.prepare(sql).get().count;
    return {
      agents: q("SELECT COUNT(*) as count FROM agents"),
      activeAgents: q("SELECT COUNT(*) as count FROM agents WHERE status = 'active'"),
      memories: q("SELECT COUNT(*) as count FROM memories WHERE superseded_by IS NULL"),
      messages: q('SELECT COUNT(*) as count FROM messages'),
      pendingTasks: q("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'"),
      completedTasks: q("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'"),
      threads: q('SELECT COUNT(*) as count FROM threads'),
      traces: q('SELECT COUNT(*) as count FROM traces'),
      superseded: q('SELECT COUNT(*) as count FROM supersede_log'),
      inbox: q("SELECT COUNT(*) as count FROM psi_inbox WHERE status != 'done'"),
      writing: q('SELECT COUNT(*) as count FROM psi_writing'),
      lab: q("SELECT COUNT(*) as count FROM psi_lab WHERE status = 'running'"),
    };
  }

  close() {
    this.db.close();
  }

  // ================================================================
  // AGENT STATE PERSISTENCE
  // ================================================================

  saveAgentState(agentId, name, role, personality, conversationHistory, memoryCache, messageQueue) {
    this.db.prepare(
      `INSERT OR REPLACE INTO agent_states (id, name, role, personality, conversation_history, memory_cache, message_queue, saved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch())`
    ).run(agentId, name, role, personality || '', JSON.stringify(conversationHistory), JSON.stringify(memoryCache), JSON.stringify(messageQueue));
  }

  loadAgentState(agentId) {
    const row = this.db.prepare('SELECT * FROM agent_states WHERE id = ?').get(agentId);
    if (!row) return null;
    return {
      id: row.id, name: row.name, role: row.role, personality: row.personality,
      conversationHistory: JSON.parse(row.conversation_history || '[]'),
      memoryCache: JSON.parse(row.memory_cache || '[]'),
      messageQueue: JSON.parse(row.message_queue || '[]'),
      savedAt: row.saved_at,
    };
  }

  deleteAgentState(agentId) {
    this.db.prepare('DELETE FROM agent_states WHERE id = ?').run(agentId);
  }

  getAllSavedStates() {
    return this.db.prepare('SELECT * FROM agent_states ORDER BY saved_at DESC').all();
  }

  // ================================================================
  // HANDOFFS
  // ================================================================

  createHandoff(title, summary, fromSession = null, context = null) {
    const result = this.db.prepare(
      'INSERT INTO handoffs (title, summary, from_session, context) VALUES (?, ?, ?, ?)'
    ).run(title, summary, fromSession, context ? JSON.stringify(context) : null);

    this.addMemory('system', `Handoff: ${title}\n${summary}`, 'handoff', 3, 'handoff,session', 'handoff');
    return { id: result.lastInsertRowid, title, summary };
  }

  getHandoffs(limit = 10) {
    return this.db.prepare('SELECT * FROM handoffs ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  updateHandoffStatus(handoffId, status) {
    this.db.prepare('UPDATE handoffs SET status = ? WHERE id = ?').run(status, handoffId);
  }

  generateSessionSummary() {
    const stats = this.getStats();
    const recentMessages = this.getMessages(null, 20);
    const recentMemories = this.getAllMemories(10);
    const agents = this.listAgents();

    const messagePreview = recentMessages.slice(0, 5).map(m =>
      `[${m.from_agent}→${m.to_agent || 'all'}]: ${m.content.slice(0, 80)}`
    ).join('\n');

    const memoryPreview = recentMemories.slice(0, 5).map(m =>
      `- ${m.category}: ${m.content.slice(0, 80)}`
    ).join('\n');

    const agentList = agents.map(a => `${a.name}(${a.role}:${a.status})`).join(', ');

    return {
      title: `Session ${new Date().toISOString().slice(0, 16)}`,
      summary: `Agents: ${agentList}\nStats: ${stats.memories} memories, ${stats.messages} messages, ${stats.pendingTasks} pending tasks\n\nRecent messages:\n${messagePreview}\n\nKey memories:\n${memoryPreview}`,
      context: {
        agents: agents.map(a => ({ name: a.name, role: a.role, status: a.status })),
        stats,
        recentMessages: recentMessages.slice(0, 5).map(m => ({ from: m.from_agent, content: m.content.slice(0, 100) })),
        recentMemories: recentMemories.slice(0, 5).map(m => ({ category: m.category, content: m.content.slice(0, 100) })),
      }
    };
  }

  // ================================================================
  // RECAP / RRR / STANDUP
  // ================================================================

  generateRecap() {
    const agents = this.listAgents();
    const recentMemories = this.getAllMemories(15);
    const pendingTasks = this.getPendingTasks();
    const recentMessages = this.getMessages(null, 10);

    let recap = '## 📋 Session Recap\n\n';

    // Active agents
    const active = agents.filter(a => a.status === 'active');
    if (active.length > 0) {
      recap += `**Active Agents:** ${active.map(a => `${a.name} (${a.role})`).join(', ')}\n\n`;
    }

    // Pending tasks
    if (pendingTasks.length > 0) {
      recap += `**Pending Tasks (${pendingTasks.length}):**\n`;
      for (const t of pendingTasks.slice(0, 5)) {
        recap += `- [ ] ${t.title}${t.assigned_to ? ` → ${t.assigned_to}` : ''}\n`;
      }
      recap += '\n';
    }

    // Recent memories
    if (recentMemories.length > 0) {
      recap += `**Recent Memories:**\n`;
      for (const m of recentMemories.slice(0, 5)) {
        recap += `- [${m.category}] ${m.content.slice(0, 80)}\n`;
      }
      recap += '\n';
    }

    // Recent messages
    if (recentMessages.length > 0) {
      recap += `**Recent Activity:**\n`;
      for (const m of recentMessages.slice(0, 5)) {
        recap += `- ${m.from_agent}: ${m.content.slice(0, 60)}\n`;
      }
    }

    return recap;
  }

  generateRRR() {
    const timeline = this.getActivityTimeline(24);
    const memories = this.getAllMemories(10);

    let rrr = '## 🔄 RRR — Retrospective\n\n';

    // Activity summary
    const searches = timeline.filter(t => t.type === 'search').length;
    const learns = timeline.filter(t => t.type === 'learn').length;
    const msgs = timeline.filter(t => t.type === 'message').length;

    rrr += `**Activity (24h):** ${searches} searches, ${learns} learnings, ${msgs} messages\n\n`;

    // Key learnings
    if (memories.length > 0) {
      rrr += `**Key Learnings:**\n`;
      for (const m of memories.filter(m => m.importance >= 3).slice(0, 5)) {
        rrr += `- ⭐${m.importance} [${m.category}] ${m.content.slice(0, 100)}\n`;
      }
      rrr += '\n';
    }

    rrr += '**Patterns observed:** Auto-generated from activity timeline.\n';

    return rrr;
  }

  generateStandup() {
    const pendingTasks = this.getPendingTasks();
    const agents = this.listAgents().filter(a => a.status === 'active');
    const recentMessages = this.getMessages(null, 5);

    let standup = '## 🧍 Daily Standup\n\n';

    // What's planned
    if (pendingTasks.length > 0) {
      standup += `**Today's plan:**\n`;
      for (const t of pendingTasks.slice(0, 5)) {
        standup += `- ${t.title}${t.assigned_to ? ` (${t.assigned_to})` : ''}\n`;
      }
      standup += '\n';
    }

    // Agent status
    if (agents.length > 0) {
      standup += `**Team status:**\n`;
      for (const a of agents) {
        standup += `- ${a.name} (${a.role}): ${a.status}\n`;
      }
      standup += '\n';
    }

    // Recent
    if (recentMessages.length > 0) {
      standup += `**Last activity:**\n`;
      for (const m of recentMessages.slice(0, 3)) {
        standup += `- ${m.from_agent}: ${m.content.slice(0, 60)}\n`;
      }
    }

    return standup;
  }
}
