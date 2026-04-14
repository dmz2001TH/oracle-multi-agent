/**
 * Experience Memory — Learn from successes and failures
 * Stores patterns of what worked and what didn't.
 * Agents consult this before making decisions.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const EXPERIENCE_DIR = join(homedir(), ".oracle", "experience");

export interface Experience {
  id: string;
  timestamp: string;
  agentName: string;
  taskType: string;            // "research", "coding", "deploy", etc.
  description: string;
  approach: string;            // what was tried
  outcome: "success" | "failure" | "partial";
  result: string;              // what happened
  lesson: string;              // what was learned
  tags: string[];
  confidence: number;          // 0-1, how confident we are in this lesson
  timesRelevant: number;       // how many times this experience was consulted
  timesCorrect: number;        // how many times this lesson was correct
}

export interface Pattern {
  id: string;
  pattern: string;             // regex or keyword pattern
  recommendation: string;      // what to do when this pattern is seen
  successRate: number;         // 0-1
  basedOn: string[];           // experience ids
  createdAt: string;
}

function ensureDir() { mkdirSync(EXPERIENCE_DIR, { recursive: true }); }
function experiencesFile() { return join(EXPERIENCE_DIR, "experiences.jsonl"); }
function patternsFile() { return join(EXPERIENCE_DIR, "patterns.jsonl"); }

function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Experience CRUD ───

export function recordExperience(agentName: string, taskType: string, description: string, approach: string, outcome: Experience["outcome"], result: string, lesson: string, tags: string[] = []): Experience {
  ensureDir();
  const exp: Experience = {
    id: genId("exp"),
    timestamp: new Date().toISOString(),
    agentName,
    taskType,
    description,
    approach,
    outcome,
    result,
    lesson,
    tags,
    confidence: outcome === "success" ? 0.8 : outcome === "partial" ? 0.5 : 0.3,
    timesRelevant: 0,
    timesCorrect: 0,
  };
  appendFileSync(experiencesFile(), JSON.stringify(exp) + "\n");
  return exp;
}

export function getRelevantExperiences(taskType: string, keywords: string[], limit = 5): Experience[] {
  ensureDir();
  if (!existsSync(experiencesFile())) return [];

  const lines = readFileSync(experiencesFile(), "utf-8").split("\n").filter(Boolean);
  const all: Experience[] = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  // Score each experience by relevance
  const scored = all.map(exp => {
    let score = 0;
    if (exp.taskType === taskType) score += 3;
    for (const kw of keywords) {
      if (exp.description.toLowerCase().includes(kw.toLowerCase())) score += 1;
      if (exp.lesson.toLowerCase().includes(kw.toLowerCase())) score += 1;
      if (exp.tags.some(t => t.toLowerCase().includes(kw.toLowerCase()))) score += 1;
    }
    // Weight by confidence and correctness
    score *= exp.confidence * (exp.timesRelevant > 0 ? exp.timesCorrect / exp.timesRelevant : 0.5);
    return { exp, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => {
      // Track that this experience was consulted
      s.exp.timesRelevant++;
      return s.exp;
    });
}

export function markExperienceCorrect(experienceId: string, wasCorrect: boolean): void {
  ensureDir();
  if (!existsSync(experiencesFile())) return;
  const lines = readFileSync(experiencesFile(), "utf-8").split("\n").filter(Boolean);
  const updated = lines.map(l => {
    try {
      const exp = JSON.parse(l);
      if (exp.id === experienceId) {
        if (wasCorrect) exp.timesCorrect++;
        // Update confidence based on track record
        if (exp.timesRelevant > 0) {
          exp.confidence = Math.min(1, exp.timesCorrect / exp.timesRelevant);
        }
      }
      return JSON.stringify(exp);
    } catch { return l; }
  });
  writeFileSync(experiencesFile(), updated.join("\n") + "\n");
}

// ─── Pattern Learning ───

/**
 * Learn patterns from accumulated experiences.
 * When multiple experiences share similar characteristics, extract a pattern.
 */
export function learnPatterns(): Pattern[] {
  ensureDir();
  if (!existsSync(experiencesFile())) return [];

  const lines = readFileSync(experiencesFile(), "utf-8").split("\n").filter(Boolean);
  const all: Experience[] = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  // Group by task type
  const byType: Record<string, Experience[]> = {};
  for (const exp of all) {
    if (!byType[exp.taskType]) byType[exp.taskType] = [];
    byType[exp.taskType].push(exp);
  }

  const patterns: Pattern[] = [];

  for (const [type, exps] of Object.entries(byType)) {
    if (exps.length < 2) continue;

    // Find successful approaches
    const successful = exps.filter(e => e.outcome === "success");
    const failed = exps.filter(e => e.outcome === "failure");

    if (successful.length > 0) {
      // Find common successful approach
      const approachCounts: Record<string, number> = {};
      for (const exp of successful) {
        const key = exp.approach.slice(0, 100);
        approachCounts[key] = (approachCounts[key] || 0) + 1;
      }

      const bestApproach = Object.entries(approachCounts).sort((a, b) => b[1] - a[1])[0];
      if (bestApproach) {
        const successRate = successful.length / exps.length;
        const pattern: Pattern = {
          id: genId("pattern"),
          pattern: `taskType:${type}`,
          recommendation: bestApproach[0],
          successRate,
          basedOn: successful.map(e => e.id),
          createdAt: new Date().toISOString(),
        };
        patterns.push(pattern);
      }
    }

    // Find failure patterns to avoid
    if (failed.length > 0) {
      const failApproaches: Record<string, number> = {};
      for (const exp of failed) {
        const key = exp.approach.slice(0, 100);
        failApproaches[key] = (failApproaches[key] || 0) + 1;
      }

      for (const [approach, count] of Object.entries(failApproaches)) {
        if (count >= 2) {
          patterns.push({
            id: genId("pattern"),
            pattern: `avoid:${type}`,
            recommendation: `AVOID: "${approach}" — failed ${count} times`,
            successRate: 0,
            basedOn: failed.filter(e => e.approach.startsWith(approach)).map(e => e.id),
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
  }

  // Save patterns
  for (const p of patterns) {
    appendFileSync(patternsFile(), JSON.stringify(p) + "\n");
  }

  return patterns;
}

export function getPatterns(taskType?: string): Pattern[] {
  ensureDir();
  if (!existsSync(patternsFile())) return [];
  const lines = readFileSync(patternsFile(), "utf-8").split("\n").filter(Boolean);
  return lines.map(l => { try { return JSON.parse(l); } catch { return null; } })
    .filter((p): p is Pattern => p !== null && (!taskType || p.pattern.includes(taskType)));
}

// ─── Decision Support ───

/**
 * Get advice for a task based on past experience.
 */
export function getAdvice(taskType: string, taskDescription: string): {
  recommendation: string;
  confidence: number;
  basedOn: number;
  avoidList: string[];
} {
  const desc = taskDescription || "";
  const keywords = desc.split(/\s+/).filter(w => w.length > 3);
  const experiences = getRelevantExperiences(taskType, keywords);
  const patterns = getPatterns(taskType);

  if (experiences.length === 0 && patterns.length === 0) {
    return {
      recommendation: "No prior experience — try the most straightforward approach",
      confidence: 0.1,
      basedOn: 0,
      avoidList: [],
    };
  }

  const successful = experiences.filter(e => e.outcome === "success");
  const failed = experiences.filter(e => e.outcome === "failure");
  const avgConfidence = experiences.reduce((s, e) => s + e.confidence, 0) / experiences.length;

  const avoidList = failed.map(e => e.approach.slice(0, 80));
  const recommendation = successful.length > 0
    ? `Based on ${successful.length} similar successes: "${successful[0].lesson}"`
    : patterns.length > 0
      ? patterns[0].recommendation
      : "No clear pattern — proceed with caution";

  return { recommendation, confidence: avgConfidence, basedOn: experiences.length, avoidList };
}

// ─── Stats ───

export function getExperienceStats(): {
  total: number;
  successes: number;
  failures: number;
  partials: number;
  byType: Record<string, number>;
  topLessons: string[];
} {
  ensureDir();
  if (!existsSync(experiencesFile())) {
    return { total: 0, successes: 0, failures: 0, partials: 0, byType: {}, topLessons: [] };
  }

  const lines = readFileSync(experiencesFile(), "utf-8").split("\n").filter(Boolean);
  const all: Experience[] = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  const byType: Record<string, number> = {};
  for (const exp of all) {
    byType[exp.taskType] = (byType[exp.taskType] || 0) + 1;
  }

  // Find most referenced lessons
  const lessonCounts: Record<string, number> = {};
  for (const exp of all) {
    if (exp.timesRelevant > 0) {
      lessonCounts[exp.lesson] = (lessonCounts[exp.lesson] || 0) + exp.timesRelevant;
    }
  }
  const topLessons = Object.entries(lessonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lesson]) => lesson);

  return {
    total: all.length,
    successes: all.filter(e => e.outcome === "success").length,
    failures: all.filter(e => e.outcome === "failure").length,
    partials: all.filter(e => e.outcome === "partial").length,
    byType,
    topLessons,
  };
}
