/**
 * Oracle Vault — Knowledge management inspired by arra-oracle-v3
 * File-based persistent knowledge store with git integration
 *
 * Structure:
 *   ψ/inbox/     — incoming items
 *   ψ/memory/    — persistent memories
 *   ψ/writing/   — documents
 *   ψ/lab/       — experiments
 *   ψ/outbox/    — outgoing items
 *   ψ/sessions/  — session handoffs
 */

import { mkdir, readFile, writeFile, readdir, stat, rename } from 'fs/promises';
import { join, basename, extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

const VAULT_DIRS = ['inbox', 'memory', 'writing', 'lab', 'outbox', 'sessions', 'traces', 'threads'];

export class OracleVault {
  constructor(basePath = './ψ') {
    this.basePath = basePath;
    this.initialized = false;
  }

  async init() {
    for (const dir of VAULT_DIRS) {
      await mkdir(join(this.basePath, dir), { recursive: true });
    }
    this.initialized = true;
    console.log('[vault] Initialized at', this.basePath);
  }

  // === Generic CRUD ===

  async write(section, name, content, meta = {}) {
    const filePath = join(this.basePath, section, `${name}.md`);
    const header = `---\nid: ${meta.id || uuidv4()}\ncreated: ${meta.created || new Date().toISOString()}\nupdated: ${new Date().toISOString()}\ntags: ${(meta.tags || []).join(', ')}\n---\n\n`;
    await writeFile(filePath, header + content, 'utf-8');
    return { path: filePath, name };
  }

  async read(section, name) {
    const filePath = join(this.basePath, section, `${name}.md`);
    try {
      return await readFile(filePath, 'utf-8');
    } catch {
      return null;
    }
  }

  async list(section, options = {}) {
    const dirPath = join(this.basePath, section);
    try {
      const files = await readdir(dirPath);
      const mdFiles = files.filter(f => f.endsWith('.md'));
      const items = [];

      for (const file of mdFiles) {
        const filePath = join(dirPath, file);
        const stats = await stat(filePath);
        items.push({
          name: file.replace('.md', ''),
          path: filePath,
          size: stats.size,
          modified: stats.mtime,
          created: stats.birthtime
        });
      }

      // Sort by modified date (newest first)
      items.sort((a, b) => b.modified - a.modified);

      if (options.limit) return items.slice(0, options.limit);
      return items;
    } catch {
      return [];
    }
  }

  async move(fromSection, toSection, name) {
    const from = join(this.basePath, fromSection, `${name}.md`);
    const to = join(this.basePath, toSection, `${name}.md`);
    await rename(from, to);
  }

  async delete(section, name) {
    // Oracle principle: "Nothing is Deleted" — move to archive instead
    const archiveDir = join(this.basePath, '.archive');
    await mkdir(archiveDir, { recursive: true });
    const from = join(this.basePath, section, `${name}.md`);
    const to = join(archiveDir, `${name}-${Date.now()}.md`);
    await rename(from, to);
    return { archived: to };
  }

  // === Section-specific helpers ===

  async addToInbox(title, content, tags = []) {
    const name = `${new Date().toISOString().slice(0, 10)}-${title.toLowerCase().replace(/\s+/g, '-').slice(0, 50)}`;
    return this.write('inbox', name, content, { tags });
  }

  async addMemory(title, content, tags = []) {
    const name = `${new Date().toISOString().slice(0, 10)}-${title.toLowerCase().replace(/\s+/g, '-').slice(0, 50)}`;
    return this.write('memory', name, content, { tags });
  }

  async addWriting(title, content, tags = []) {
    const name = title.toLowerCase().replace(/\s+/g, '-').slice(0, 80);
    return this.write('writing', name, content, { tags });
  }

  async addLab(title, content, tags = []) {
    const name = `${Date.now()}-${title.toLowerCase().replace(/\s+/g, '-').slice(0, 50)}`;
    return this.write('lab', name, content, { tags });
  }

  // === Traces (query chain tracking, from arra-oracle-v3) ===

  async createTrace(query, results = [], meta = {}) {
    const trace = {
      id: uuidv4(),
      query,
      results: results.map(r => ({ source: r.source, relevance: r.relevance, snippet: r.snippet })),
      chains: [],
      created: new Date().toISOString(),
      ...meta
    };
    const name = `trace-${Date.now()}`;
    await this.write('traces', name, JSON.stringify(trace, null, 2), { tags: ['trace'] });
    return trace;
  }

  async linkTraces(traceId1, traceId2, relation = 'related') {
    // Find and update trace files to link them
    const traces = await this.list('traces');
    // Simplified linking via outbox
    await this.write('outbox', `link-${Date.now()}`,
      `Trace Link: ${traceId1} ↔ ${traceId2} (${relation})`, { tags: ['link'] });
  }

  // === Threads (conversation threads, from arra-oracle-v3) ===

  async createThread(title, messages = []) {
    const thread = {
      id: uuidv4(),
      title,
      messages,
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };
    const name = `thread-${Date.now()}`;
    await this.write('threads', name, JSON.stringify(thread, null, 2), { tags: ['thread'] });
    return thread;
  }

  // === Session Handoffs ===

  async createHandoff(summary, context = {}, nextSteps = []) {
    const handoff = {
      id: uuidv4(),
      summary,
      context,
      nextSteps,
      created: new Date().toISOString()
    };
    const name = `handoff-${new Date().toISOString().slice(0, 16).replace(':', '')}`;
    await this.write('sessions', name, JSON.stringify(handoff, null, 2), { tags: ['handoff'] });
    return handoff;
  }

  // === Status ===

  async status() {
    const result = {};
    for (const dir of VAULT_DIRS) {
      result[dir] = (await this.list(dir)).length;
    }
    result.total = Object.values(result).reduce((a, b) => a + b, 0);
    result.initialized = this.initialized;
    result.path = this.basePath;
    return result;
  }
}
