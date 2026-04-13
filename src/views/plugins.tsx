/** Plugin system view — Hono JSX */
import { Hono } from "hono";
import type { PluginSystem } from "../plugins.js";

export function pluginsView(plugins: PluginSystem) {
  const view = new Hono();

  view.get("/", (c) => {
    const s = plugins.stats();
    const up = Math.round((Date.now() - new Date(s.startedAt).getTime()) / 1000);
    const upStr = up > 3600
      ? `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m`
      : up > 60 ? `${Math.floor(up / 60)}m ${up % 60}s` : `${up}s`;

    const rows = s.plugins.map((p: any) =>
      `<tr>
        <td><strong>${esc(p.name)}</strong></td>
        <td><span class="tag">${esc(p.type)}</span></td>
        <td>${p.events}</td>
        <td class="${p.errors > 0 ? 'err' : 'ok'}">${p.errors}</td>
        <td>${p.lastEvent || "—"}</td>
      </tr>`
    ).join("");

    return c.html(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Plugins</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#020a18;color:#e0e0e0;font:13px/1.6 monospace;padding:24px}
h1{color:#00f5d4;font-size:18px;margin-bottom:16px}
.stats{display:flex;gap:24px;margin-bottom:24px}
.stat{background:#0a1628;border:1px solid #1a2a40;border-radius:8px;padding:12px 20px}
.stat .n{font-size:28px;font-weight:bold;color:#00f5d4}
.stat .l{font-size:10px;color:#607080;text-transform:uppercase;letter-spacing:1px}
table{width:100%;border-collapse:collapse;margin-bottom:24px}
th{text-align:left;font-size:10px;color:#607080;text-transform:uppercase;padding:8px 12px;border-bottom:1px solid #1a2a40}
td{padding:8px 12px;border-bottom:1px solid #0d1a2a}
tr:hover{background:#0a1628}
.tag{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;background:#00f5d420;color:#00f5d4}
.err{color:#f15bb5}.ok{color:#00f5d4}
</style></head><body>
<h1>🔌 Plugin System</h1>
<div class="stats">
  <div class="stat"><div class="n">${s.plugins.length}</div><div class="l">Plugins</div></div>
  <div class="stat"><div class="n">${s.totalEvents}</div><div class="l">Events</div></div>
  <div class="stat"><div class="n ${s.totalErrors > 0 ? 'err' : 'ok'}">${s.totalErrors}</div><div class="l">Errors</div></div>
  <div class="stat"><div class="n">${upStr}</div><div class="l">Uptime</div></div>
</div>
<table><tr><th>Plugin</th><th>Type</th><th>Events</th><th>Errors</th><th>Last Event</th></tr>${rows}</table>
</body></html>`);
  });

  return view;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
