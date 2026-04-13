/**
 * 5-Dimensional Scoring Engine
 * Adapted from PROMETHEUS scoring.py + GitNexus RRF
 */

import { SCORING_WEIGHTS, RRF_K, SCORE_S_TIER, SCORE_A_TIER, SCORE_B_TIER } from '../const.ts';
import { sqlite } from '../db/index.ts';

export interface Scores {
  novelty: number;
  feasibility: number;
  impact: number;
  cross_domain: number;
  specificity: number;
}

export interface ScoredDiscovery {
  id: string;
  type: string;
  title: string;
  description: string;
  sourceOracles: string[];
  path: string[];
  scores: Scores;
  compositeScore: number;
  grade: string;
  impactRadius: { depth_1: string[]; depth_2: string[]; depth_3: string[] };
}

/** Compute weighted composite score */
export function computeComposite(scores: Scores): number {
  return (
    scores.novelty * SCORING_WEIGHTS.novelty +
    scores.feasibility * SCORING_WEIGHTS.feasibility +
    scores.impact * SCORING_WEIGHTS.impact +
    scores.cross_domain * SCORING_WEIGHTS.cross_domain +
    scores.specificity * SCORING_WEIGHTS.specificity
  );
}

/** Get grade from composite score */
export function getGrade(score: number): string {
  if (score >= SCORE_S_TIER) return 'S';
  if (score >= SCORE_A_TIER) return 'A';
  if (score >= SCORE_B_TIER) return 'B';
  return 'C';
}

/** Score a bridge discovery */
export function scoreBridge(concept: string, oracles: string[], departments: string[], edgeCount: number): Scores {
  const existingCount = (sqlite.prepare(
    "SELECT COUNT(*) as c FROM discoveries WHERE title LIKE ?"
  ).get(`%${concept}%`) as any)?.c || 0;

  return {
    novelty: Math.min(10, departments.length * 2.5),
    feasibility: Math.min(10, edgeCount * 0.8 + 3),
    impact: Math.min(10, oracles.length * 2),
    cross_domain: Math.min(10, departments.length * 3),
    specificity: Math.max(1, 10 - existingCount * 2),
  };
}

/** Score a chain discovery */
export function scoreChain(pathLength: number, domainsCrossed: string[], confidenceMin: number): Scores {
  return {
    novelty: Math.min(10, pathLength * 2.5),
    feasibility: Math.min(10, confidenceMin * 10),
    impact: Math.min(10, domainsCrossed.length * 3),
    cross_domain: Math.min(10, domainsCrossed.length * 3.5),
    specificity: Math.min(10, pathLength * 2),
  };
}

/** Score a cluster discovery */
export function scoreCluster(oracleCount: number, conceptCount: number, deptCount: number): Scores {
  return {
    novelty: Math.min(10, deptCount * 2),
    feasibility: Math.min(10, 7 + conceptCount * 0.3),
    impact: Math.min(10, oracleCount * 1.8),
    cross_domain: Math.min(10, deptCount * 3),
    specificity: Math.min(10, conceptCount * 1.5),
  };
}

/** RRF merge: combine ranked lists from multiple sources */
export function rrfMerge(rankedLists: Array<Array<{ id: string; [key: string]: any }>>): Array<{ id: string; rrfScore: number; [key: string]: any }> {
  const scoreMap = new Map<string, { rrfScore: number; item: any }>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const item = list[rank];
      const rrfScore = 1 / (RRF_K + rank + 1);
      const existing = scoreMap.get(item.id);
      if (existing) {
        existing.rrfScore += rrfScore;
      } else {
        scoreMap.set(item.id, { rrfScore, item });
      }
    }
  }

  return [...scoreMap.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ rrfScore, item }) => ({ ...item, rrfScore }));
}

/** Compute impact radius (blast radius) for a set of Oracles */
export function computeImpactRadius(sourceOracles: string[]): { depth_1: string[]; depth_2: string[]; depth_3: string[] } {
  const depth1 = sourceOracles.slice(0, 2);
  const depth2 = sourceOracles.slice(2, 4);
  const depth3 = sourceOracles.slice(4);
  return { depth_1: depth1, depth_2: depth2, depth_3: depth3 };
}
