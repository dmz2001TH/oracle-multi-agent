import type { Hono } from "hono";
import { federationView } from "./federation.js";
import { timemachineView } from "./timemachine.js";
import { demoView } from "./demo.js";

// Self-contained HTML views. Dashboard (React) is served separately via Vite dev server.
export function mountViews(app: Hono) {
  app.route("/demo", demoView);
  app.route("/timemachine", timemachineView);
  app.route("/federation", federationView);
}
