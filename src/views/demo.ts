import { Hono } from "hono";

export const demoView = new Hono();

// Serve demo HTML inline (no Bun serveStatic dependency)
demoView.get("/", (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Demo</title></head>
<body><h1>🧠 Oracle Multi-Agent v5.0</h1><p>Dashboard is running.</p></body></html>`);
});
