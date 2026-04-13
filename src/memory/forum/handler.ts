/**
 * Forum Handler — for oracle tools
 * Functional handlers backed by forum_threads / forum_messages tables
 */

import { db } from '../db/index.ts';
import { forumThreads, forumMessages, oracleDocuments } from '../db/schema.ts';
import { eq, and, desc, sql, like, or, isNull } from 'drizzle-orm';

// ============================================================================
// Input interfaces matching how tools/forum.ts calls these functions
// ============================================================================

export interface ThreadMessageInput {
  message: string;
  threadId?: number;
  title?: string;
  role?: 'human' | 'claude' | 'oracle';
  model?: string;
}

export interface ListThreadsInput {
  status?: 'active' | 'answered' | 'pending' | 'closed';
  limit?: number;
  offset?: number;
}

// ============================================================================
// Return types
// ============================================================================

export interface ThreadMessageResult {
  threadId: number;
  messageId: number;
  status: string;
  oracleResponse: {
    content: string;
    principlesFound: number;
    patternsFound: number;
  } | null;
  issueUrl: string | null;
}

export interface ThreadRecord {
  id: number;
  title: string;
  status: string;
  createdBy: string;
  issueUrl: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface MessageRecord {
  id: number;
  threadId: number;
  role: string;
  content: string;
  author: string | null;
  createdAt: number;
}

export interface ListThreadsResult {
  threads: ThreadRecord[];
  total: number;
}

export interface FullThreadResult {
  thread: ThreadRecord;
  messages: MessageRecord[];
}

// ============================================================================
// Helpers
// ============================================================================

function rowToThread(row: any): ThreadRecord {
  return {
    id: row.id,
    title: row.title,
    status: row.status || 'active',
    createdBy: row.createdBy || 'human',
    issueUrl: row.issueUrl ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToMessage(row: any): MessageRecord {
  return {
    id: row.id,
    threadId: row.threadId,
    role: row.role,
    content: row.content,
    author: row.author ?? null,
    createdAt: row.createdAt,
  };
}

// Simple Oracle auto-reply: searches knowledge base for relevant docs
function generateOracleReply(message: string): { content: string; principlesFound: number; patternsFound: number } {
  const keywords = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  let principles = 0;
  let patterns = 0;

  try {
    for (const kw of keywords.slice(0, 5)) {
      const rows = db.select().from(oracleDocuments)
        .where(
          and(
            or(
              eq(oracleDocuments.type, 'principle'),
              eq(oracleDocuments.type, 'pattern')
            )
          )
        )
        .limit(5)
        .all();
      for (const r of rows) {
        if (r.type === 'principle') principles++;
        if (r.type === 'pattern') patterns++;
      }
    }
  } catch { /* FTS not available, fallback */ }

  return {
    content: `I found ${principles} principles and ${patterns} patterns relevant to your question. Use arra_search for detailed results.`,
    principlesFound: principles,
    patternsFound: patterns,
  };
}

// ============================================================================
// Handler functions (matching how tools/forum.ts calls them)
// ============================================================================

export function handleThreadMessage(input: ThreadMessageInput): ThreadMessageResult {
  const now = Date.now();
  let threadId = input.threadId;
  let status = 'active';

  // Create thread if needed
  if (!threadId) {
    const title = input.title || input.message.substring(0, 50);
    const result = db.insert(forumThreads).values({
      title,
      createdBy: input.role || 'human',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }).run();
    threadId = result.lastInsertRowid as number;
  }

  // Insert the user message
  const msgResult = db.insert(forumMessages).values({
    threadId: threadId!,
    role: input.role || 'human',
    content: input.message,
    author: input.role || 'human',
    createdAt: now,
  }).run();
  const messageId = msgResult.lastInsertRowid as number;

  // Generate Oracle auto-reply
  const oracleResponse = generateOracleReply(input.message);

  // Insert Oracle's reply
  db.insert(forumMessages).values({
    threadId: threadId!,
    role: 'oracle',
    content: oracleResponse.content,
    author: 'oracle',
    principlesFound: oracleResponse.principlesFound,
    patternsFound: oracleResponse.patternsFound,
    createdAt: now + 1,
  }).run();

  // Update thread timestamp
  db.update(forumThreads).set({ updatedAt: now }).where(eq(forumThreads.id, threadId!)).run();

  const thread = db.select().from(forumThreads).where(eq(forumThreads.id, threadId!)).get();

  return {
    threadId: threadId!,
    messageId,
    status: thread?.status || 'active',
    oracleResponse,
    issueUrl: thread?.issueUrl ?? null,
  };
}

export function listThreads(input: ListThreadsInput = {}): ListThreadsResult {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;

  let query = db.select().from(forumThreads).$dynamic();
  if (input.status) {
    query = query.where(eq(forumThreads.status, input.status));
  }

  const rows = query.orderBy(desc(forumThreads.updatedAt)).limit(limit).offset(offset).all();
  const totalRows = db.select({ count: sql<number>`count(*)` }).from(forumThreads).all();
  const total = totalRows[0]?.count ?? 0;

  return {
    threads: rows.map(rowToThread),
    total,
  };
}

export function getMessages(threadId: number, opts?: { limit?: number }): MessageRecord[] {
  const limit = opts?.limit ?? 100;
  const rows = db.select().from(forumMessages)
    .where(eq(forumMessages.threadId, threadId))
    .orderBy(desc(forumMessages.createdAt))
    .limit(limit)
    .all();
  return rows.map(rowToMessage).reverse(); // chronological order
}

export function getFullThread(threadId: number): FullThreadResult | null {
  const threadRow = db.select().from(forumThreads).where(eq(forumThreads.id, threadId)).get();
  if (!threadRow) return null;

  const messageRows = db.select().from(forumMessages)
    .where(eq(forumMessages.threadId, threadId))
    .orderBy(desc(forumMessages.createdAt))
    .all();

  return {
    thread: rowToThread(threadRow),
    messages: messageRows.map(rowToMessage).reverse(),
  };
}

export function updateThreadStatus(threadId: number, status: string): void {
  const now = Date.now();
  db.update(forumThreads).set({ status, updatedAt: now }).where(eq(forumThreads.id, threadId)).run();
}
