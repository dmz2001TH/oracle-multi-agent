/**
 * Trace Types — stub for oracle tools
 */

export interface TraceResult {
  traceId: string;
  query: string;
  foundFiles: any[];
  foundCommits: any[];
  foundIssues: any[];
  createdAt: number;
}
