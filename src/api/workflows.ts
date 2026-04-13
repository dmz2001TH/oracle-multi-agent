/**
 * Workflows API — multi-agent workflow patterns
 */

import { Hono } from "hono";
import { WORKFLOW_TEMPLATES, getWorkflowTemplate, listWorkflowTemplates } from "../workflows/index.js";

export const workflowsApi = new Hono();

// GET /api/workflows — list templates
workflowsApi.get("/api/workflows", (c) => {
  return c.json({ ok: true, workflows: listWorkflowTemplates() });
});

// GET /api/workflows/:name — get template details
workflowsApi.get("/api/workflows/:name", (c) => {
  const name = c.req.param("name");
  const template = getWorkflowTemplate(name);
  if (!template) return c.json({ ok: false, error: `Workflow not found: ${name}` }, 404);
  return c.json({ ok: true, workflow: template });
});
