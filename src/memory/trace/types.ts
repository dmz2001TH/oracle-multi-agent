/**
 * Trace Types — for oracle tools
 */

export interface FoundFile {
  path: string;
  type: 'learning' | 'retro' | 'resonance' | 'other';
  matchReason: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface FoundCommit {
  hash: string;
  shortHash: string;
  date: string;
  message: string;
}

export interface FoundIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  url: string;
}

export interface CreateTraceInput {
  query: string;
  queryType?: 'general' | 'project' | 'pattern' | 'evolution';
  foundFiles?: FoundFile[];
  foundCommits?: FoundCommit[];
  foundIssues?: FoundIssue[];
  foundRetrospectives?: string[];
  foundLearnings?: string[];
  scope?: 'project' | 'cross-project' | 'human';
  parentTraceId?: string;
  project?: string;
  agentCount?: number;
  durationMs?: number;
}

export interface ListTracesInput {
  query?: string;
  project?: string;
  status?: 'raw' | 'reviewed' | 'distilling' | 'distilled';
  depth?: number;
  limit?: number;
  offset?: number;
}

export interface GetTraceInput {
  traceId: string;
  includeChain?: boolean;
}

export interface TraceRecord {
  traceId: string;
  query: string;
  queryType: string;
  scope: string;
  depth: number;
  status: string;
  foundFiles: FoundFile[];
  foundCommits: FoundCommit[];
  foundIssues: FoundIssue[];
  foundRetrospectives: string[];
  foundLearnings: string[];
  foundResonance: string[];
  fileCount: number;
  commitCount: number;
  issueCount: number;
  parentTraceId: string | null;
  childTraceIds: string[];
  prevTraceId: string | null;
  nextTraceId: string | null;
  project: string | null;
  agentCount: number;
  durationMs: number | null;
  awakening: string | null;
  distilledToId: string | null;
  createdAt: number;
  updatedAt: number;
  hasAwakening: boolean;
}

export interface TraceSummary {
  totalDigPoints: number;
  fileCount: number;
  commitCount: number;
  issueCount: number;
}

export interface CreateTraceResult {
  success: boolean;
  traceId: string;
  depth: number;
  summary: TraceSummary;
}

export interface ListTracesResult {
  traces: TraceRecord[];
  total: number;
  hasMore: boolean;
}

export interface TraceChainResult {
  chain: TraceRecord[];
  totalDepth: number;
  hasAwakening: boolean;
  awakeningTraceId: string | null;
  position: number;
}

export interface LinkTraceResult {
  success: boolean;
  message: string;
  prevTrace: TraceRecord | null;
  nextTrace: TraceRecord | null;
}

export interface UnlinkTraceResult {
  success: boolean;
  message: string;
}
