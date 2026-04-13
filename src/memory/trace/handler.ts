/**
 * Trace Handler — for oracle tools
 * Functional handlers backed by the trace_log table via db module
 */

import { v4 as uuidv4 } from 'uuid';
import { db, sqlite } from '../db/index.ts';
import { traceLog } from '../db/schema.ts';
import { eq, sql, and, like, desc, isNull, or } from 'drizzle-orm';
import type {
  CreateTraceInput,
  ListTracesInput,
  GetTraceInput,
  CreateTraceResult,
  ListTracesResult,
  TraceRecord,
  TraceChainResult,
  LinkTraceResult,
  UnlinkTraceResult,
} from './types.ts';

function parseJsonArray<T = any>(val: string | null | undefined): T[] {
  if (!val) return [];
  try { return JSON.parse(val); } catch { return []; }
}

function rowToRecord(row: any): TraceRecord {
  return {
    traceId: row.traceId,
    query: row.query,
    queryType: row.queryType || 'general',
    scope: row.scope || 'project',
    depth: row.depth ?? 0,
    status: row.status || 'raw',
    foundFiles: parseJsonArray(row.foundFiles),
    foundCommits: parseJsonArray(row.foundCommits),
    foundIssues: parseJsonArray(row.foundIssues),
    foundRetrospectives: parseJsonArray(row.foundRetrospectives),
    foundLearnings: parseJsonArray(row.foundLearnings),
    foundResonance: parseJsonArray(row.foundResonance),
    fileCount: row.fileCount ?? 0,
    commitCount: row.commitCount ?? 0,
    issueCount: row.issueCount ?? 0,
    parentTraceId: row.parentTraceId ?? null,
    childTraceIds: parseJsonArray(row.childTraceIds),
    prevTraceId: row.prevTraceId ?? null,
    nextTraceId: row.nextTraceId ?? null,
    project: row.project ?? null,
    agentCount: row.agentCount ?? 1,
    durationMs: row.durationMs ?? null,
    awakening: row.awakening ?? null,
    distilledToId: row.distilledToId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    hasAwakening: !!row.awakening,
  };
}

export function createTrace(input: CreateTraceInput): CreateTraceResult {
  const traceId = uuidv4();
  const now = Date.now();
  const fileCount = input.foundFiles?.length ?? 0;
  const commitCount = input.foundCommits?.length ?? 0;
  const issueCount = input.foundIssues?.length ?? 0;

  db.insert(traceLog).values({
    traceId,
    query: input.query,
    queryType: input.queryType ?? 'general',
    foundFiles: JSON.stringify(input.foundFiles ?? []),
    foundCommits: JSON.stringify(input.foundCommits ?? []),
    foundIssues: JSON.stringify(input.foundIssues ?? []),
    foundRetrospectives: JSON.stringify(input.foundRetrospectives ?? []),
    foundLearnings: JSON.stringify(input.foundLearnings ?? []),
    foundResonance: '[]',
    fileCount,
    commitCount,
    issueCount,
    depth: 0,
    parentTraceId: input.parentTraceId ?? null,
    childTraceIds: '[]',
    scope: input.scope ?? 'project',
    project: input.project ?? null,
    agentCount: input.agentCount ?? 1,
    durationMs: input.durationMs ?? null,
    status: 'raw',
    createdAt: now,
    updatedAt: now,
  }).run();

  return {
    success: true,
    traceId,
    depth: 0,
    summary: {
      totalDigPoints: fileCount + commitCount + issueCount,
      fileCount,
      commitCount,
      issueCount,
    },
  };
}

export function getTrace(traceId: string): TraceRecord | null {
  const row = db.select().from(traceLog).where(eq(traceLog.traceId, traceId)).get();
  return row ? rowToRecord(row) : null;
}

export function listTraces(input: ListTracesInput = {}): ListTracesResult {
  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;

  let query = db.select().from(traceLog).$dynamic();
  const conditions: any[] = [];

  if (input.query) conditions.push(like(traceLog.query, `%${input.query}%`));
  if (input.project) conditions.push(eq(traceLog.project, input.project));
  if (input.status) conditions.push(eq(traceLog.status, input.status));
  if (input.depth !== undefined) conditions.push(eq(traceLog.depth, input.depth));

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rows = query.orderBy(desc(traceLog.createdAt)).limit(limit + 1).offset(offset).all();
  const hasMore = rows.length > limit;
  const traces = rows.slice(0, limit).map(rowToRecord);

  return { traces, total: traces.length, hasMore };
}

export function getTraceChain(traceId: string): TraceRecord[] {
  const trace = getTrace(traceId);
  if (!trace) return [];

  const chain: TraceRecord[] = [];
  // Walk up to find root
  let current: TraceRecord | null = trace;
  while (current?.parentTraceId) {
    current = getTrace(current.parentTraceId);
  }
  // Walk down from root
  if (current) {
    chain.push(current);
    const children = parseJsonArray<string>(current.childTraceIds as any);
    for (const childId of children) {
      const child = getTrace(childId);
      if (child) chain.push(child);
    }
  }
  return chain;
}

export function linkTraces(prevTraceId: string, nextTraceId: string): LinkTraceResult {
  const prev = getTrace(prevTraceId);
  const next = getTrace(nextTraceId);

  if (!prev) return { success: false, message: `Trace not found: ${prevTraceId}`, prevTrace: null, nextTrace: null };
  if (!next) return { success: false, message: `Trace not found: ${nextTraceId}`, prevTrace: null, nextTrace: null };

  const now = Date.now();
  db.update(traceLog).set({ nextTraceId, updatedAt: now }).where(eq(traceLog.traceId, prevTraceId)).run();
  db.update(traceLog).set({ prevTraceId, updatedAt: now }).where(eq(traceLog.traceId, nextTraceId)).run();

  return {
    success: true,
    message: `Linked: ${prevTraceId} → ${nextTraceId}`,
    prevTrace: getTrace(prevTraceId),
    nextTrace: getTrace(nextTraceId),
  };
}

export function unlinkTraces(traceId: string, direction: 'prev' | 'next'): UnlinkTraceResult {
  const trace = getTrace(traceId);
  if (!trace) return { success: false, message: `Trace not found: ${traceId}` };

  const now = Date.now();
  if (direction === 'prev' && trace.prevTraceId) {
    const linkedId = trace.prevTraceId;
    db.update(traceLog).set({ nextTraceId: null, updatedAt: now }).where(eq(traceLog.traceId, linkedId)).run();
    db.update(traceLog).set({ prevTraceId: null, updatedAt: now }).where(eq(traceLog.traceId, traceId)).run();
  } else if (direction === 'next' && trace.nextTraceId) {
    const linkedId = trace.nextTraceId;
    db.update(traceLog).set({ prevTraceId: null, updatedAt: now }).where(eq(traceLog.traceId, linkedId)).run();
    db.update(traceLog).set({ nextTraceId: null, updatedAt: now }).where(eq(traceLog.traceId, traceId)).run();
  }

  return { success: true, message: `Unlinked ${traceId} (${direction})` };
}

export function getTraceLinkedChain(traceId: string): TraceChainResult {
  const trace = getTrace(traceId);
  if (!trace) {
    return { chain: [], totalDepth: 0, hasAwakening: false, awakeningTraceId: null, position: 0 };
  }

  // Walk to the start of the chain
  let current: TraceRecord = trace;
  while (current.prevTraceId) {
    const prev = getTrace(current.prevTraceId);
    if (!prev) break;
    current = prev;
  }

  // Collect chain from start
  const chain: TraceRecord[] = [current];
  while (current.nextTraceId) {
    const next = getTrace(current.nextTraceId);
    if (!next) break;
    chain.push(next);
    current = next;
  }

  const position = chain.findIndex(t => t.traceId === traceId);
  const awakeningTrace = chain.find(t => t.hasAwakening);

  return {
    chain,
    totalDepth: chain.length,
    hasAwakening: !!awakeningTrace,
    awakeningTraceId: awakeningTrace?.traceId ?? null,
    position: position >= 0 ? position : 0,
  };
}
