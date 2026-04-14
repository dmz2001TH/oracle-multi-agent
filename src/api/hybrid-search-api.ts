import { Hono } from "hono";
import { buildIndex, searchFTS, loadOracleDocuments, tokenize } from "../hybrid-search/index.js";
export const hybridSearchApi = new Hono();

hybridSearchApi.get("/api/hybrid-search", (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ ok: false, error: "q parameter required" }, 400);
  const docs = loadOracleDocuments();
  const docMap = new Map(docs.map(d => [d.id, d]));
  const index = buildIndex(docs);
  const results = searchFTS(q, index, docMap);
  return c.json({ ok: true, query: q, count: results.length, results });
});

hybridSearchApi.get("/api/hybrid-search/index-stats", (c) => {
  const docs = loadOracleDocuments();
  const index = buildIndex(docs);
  return c.json({ ok: true, documents: docs.length, terms: index.terms.size, avgDocLength: index.avgDocLength });
});
