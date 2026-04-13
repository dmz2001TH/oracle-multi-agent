/**
 * Skills API — list, search, and get skill details
 */

import { Hono } from "hono";
import {
  SKILLS,
  listSkillsByCategory,
  findSkill,
  searchSkills,
  getSkillCount,
  getCategories,
} from "../skills/registry.js";

export const skillsApi = new Hono();

// GET /api/skills — list all skills (with optional category filter)
skillsApi.get("/api/skills", (c) => {
  const category = c.req.query("category");
  if (category) {
    const filtered = SKILLS.filter((s) => s.category === category);
    return c.json({ ok: true, count: filtered.length, skills: filtered });
  }
  const q = c.req.query("q");
  if (q) {
    const results = searchSkills(q);
    return c.json({ ok: true, count: results.length, skills: results });
  }
  return c.json({
    ok: true,
    count: getSkillCount(),
    categories: getCategories(),
    skillsByCategory: listSkillsByCategory(),
  });
});

// GET /api/skills/:name — get single skill details
skillsApi.get("/api/skills/:name", (c) => {
  const name = c.req.param("name");
  const skill = findSkill(name);
  if (!skill) return c.json({ ok: false, error: `Skill not found: ${name}` }, 404);
  return c.json({ ok: true, skill });
});
