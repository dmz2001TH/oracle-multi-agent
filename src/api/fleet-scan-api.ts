import { Hono } from "hono";
import { scanFleet, formatFleetReport } from "../fleet-scan/index.js";
export const fleetScanApi = new Hono();

fleetScanApi.get("/api/fleet-scan", (c) => {
  const report = scanFleet(c.req.query("node"));
  return c.json({ ok: true, report, formatted: formatFleetReport(report) });
});
