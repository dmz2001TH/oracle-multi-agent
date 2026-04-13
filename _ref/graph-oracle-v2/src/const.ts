export const GRAPH_DEFAULT_PORT = 47792;
export const GRAPH_DB_FILE = 'graph.db';
export const GRAPH_DATA_DIR_NAME = '.graph-oracle';
export const SERVER_NAME = 'graph-oracle';

// Traversal constraints (BFS with guardrails)
export const MAX_TRAVERSAL_DEPTH = 4;
export const MAX_BRANCH_FACTOR = 5;
export const MIN_CONFIDENCE_THRESHOLD = 0.5;

// Scoring weights (adapted from PROMETHEUS 5D scoring)
export const SCORING_WEIGHTS = {
  novelty: 0.25,
  feasibility: 0.20,
  impact: 0.25,
  cross_domain: 0.20,
  specificity: 0.10,
} as const;

// Discovery thresholds
export const SCORE_S_TIER = 8.0;
export const SCORE_A_TIER = 7.0;
export const SCORE_B_TIER = 6.0;

// RRF constant (from GitNexus hybrid search pattern)
export const RRF_K = 60;

// Confidence levels for edge creation
export const CONFIDENCE = {
  EXACT_CONCEPT: 0.95,
  SAME_ORACLE_CONCEPT: 0.90,
  CROSS_ORACLE_CONCEPT: 0.85,
  SEMANTIC_HIGH: 0.70,
  SEMANTIC_LOW: 0.50,
  MIN_EDGE: 0.50,
} as const;
