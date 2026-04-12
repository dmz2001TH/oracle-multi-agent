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
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'general',
        status TEXT DEFAULT 'idle',
        personality TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        last_active TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        content TEXT NOT NULL,
        importance INTEGER DEFAULT 1,
        tags TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_agent TEXT NOT NULL,
        to_agent TEXT,
        channel TEXT DEFAULT 'general',
        content TEXT NOT NULL,
        msg_type TEXT DEFAULT 'message',
        read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        assigned_to TEXT,
        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 1,
        result TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        summary TEXT,
        started_at TEXT DEFAULT (datetime('now')),
        ended_at TEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id)
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content, tags, category,
        content='memories',
        content_rowid='id'
      );

      CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id);
      CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_agent);
      CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
    `);
  }

  // === Agents ===
  registerAgent(id, name, role = 'general', personality = '') {
    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO agents (id, name, role, personality, status, last_active) VALUES (?, ?, ?, ?, ?, datetime('now'))"
    );
    stmt.run(id, name, role, personality, 'active');
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
    this.db.prepare("UPDATE agents SET status = ?, last_active = datetime('now') WHERE id = ?").run(status, id);
  }

  // === Memories ===
  addMemory(agentId, content, category = 'general', importance = 1, tags = '') {
    const stmt = this.db.prepare(
      'INSERT INTO memories (agent_id, content, category, importance, tags) VALUES (?, ?, ?, ?, ?)'
    );
    const result = stmt.run(agentId, content, category, importance, tags);
    // Update FTS
    this.db.prepare(
      'INSERT INTO memories_fts (rowid, content, tags, category) VALUES (?, ?, ?, ?)'
    ).run(result.lastInsertRowid, content, tags, category);
    return result.lastInsertRowid;
  }

  searchMemories(query, agentId = null, limit = 10) {
    if (agentId) {
      return this.db.prepare(`
        SELECT m.* FROM memories m
        JOIN memories_fts fts ON m.id = fts.rowid
        WHERE memories_fts MATCH ? AND m.agent_id = ?
        ORDER BY rank, m.importance DESC
        LIMIT ?
      `).all(query, agentId, limit);
    }
    return this.db.prepare(`
      SELECT m.* FROM memories m
      JOIN memories_fts fts ON m.id = fts.rowid
      WHERE memories_fts MATCH ?
      ORDER BY rank, m.importance DESC
      LIMIT ?
    `).all(query, limit);
  }

  getRecentMemories(agentId, limit = 20) {
    return this.db.prepare(
      'SELECT * FROM memories WHERE agent_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(agentId, limit);
  }

  getAllMemories(limit = 100) {
    return this.db.prepare('SELECT * FROM memories ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  // === Messages ===
  sendMessage(fromAgent, content, toAgent = null, channel = 'general', msgType = 'message') {
    const stmt = this.db.prepare(
      'INSERT INTO messages (from_agent, to_agent, channel, content, msg_type) VALUES (?, ?, ?, ?, ?)'
    );
    return stmt.run(fromAgent, toAgent, channel, content, msgType);
  }

  getMessages(channel = 'general', limit = 50) {
    return this.db.prepare(
      'SELECT * FROM messages WHERE channel = ? ORDER BY created_at DESC LIMIT ?'
    ).all(channel, limit);
  }

  getDirectMessages(agent1, agent2, limit = 50) {
    return this.db.prepare(`
      SELECT * FROM messages 
      WHERE (from_agent = ? AND to_agent = ?) OR (from_agent = ? AND to_agent = ?)
      ORDER BY created_at DESC LIMIT ?
    `).all(agent1, agent2, agent2, agent1, limit);
  }

  getUnreadMessages(agentId) {
    return this.db.prepare(
      'SELECT * FROM messages WHERE to_agent = ? AND read = 0 ORDER BY created_at'
    ).all(agentId);
  }

  markRead(messageId) {
    this.db.prepare('UPDATE messages SET read = 1 WHERE id = ?').run(messageId);
  }

  // === Tasks ===
  createTask(title, description = '', assignedTo = null, priority = 1) {
    const stmt = this.db.prepare(
      'INSERT INTO tasks (title, description, assigned_to, priority) VALUES (?, ?, ?, ?)'
    );
    return stmt.run(title, description, assignedTo, priority);
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
      this.db.prepare("UPDATE tasks SET status = ?, result = ?, completed_at = datetime('now') WHERE id = ?").run(status, result, taskId);
    } else {
      this.db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, taskId);
    }
  }

  // === Stats ===
  getStats() {
    const agents = this.db.prepare('SELECT COUNT(*) as count FROM agents').get();
    const activeAgents = this.db.prepare("SELECT COUNT(*) as count FROM agents WHERE status = 'active'").get();
    const memories = this.db.prepare('SELECT COUNT(*) as count FROM memories').get();
    const messages = this.db.prepare('SELECT COUNT(*) as count FROM messages').get();
    const pendingTasks = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'pending'").get();
    const completedTasks = this.db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'completed'").get();
    return {
      agents: agents.count,
      activeAgents: activeAgents.count,
      memories: memories.count,
      messages: messages.count,
      pendingTasks: pendingTasks.count,
      completedTasks: completedTasks.count,
    };
  }

  close() {
    this.db.close();
  }
}
