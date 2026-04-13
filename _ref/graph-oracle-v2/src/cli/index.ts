#!/usr/bin/env bun
/**
 * Graph Oracle CLI
 */

import { Command } from 'commander';
import { getOnlineOracles, getOracleUrl, FLEET } from '../fleet.ts';
import { harvestOracle, buildCrossOracleEdges } from '../harvesters/oracle-harvester.ts';
import { searchByKeyword, getCrossDomainBridges, traverse } from '../engine/traversal.ts';
import { runDiscovery } from '../engine/discovery.ts';
import { getGrade } from '../engine/scoring.ts';
import { sqlite } from '../db/index.ts';

const program = new Command();
program.name('graph-oracle').version('0.1.0').description('Cross-Oracle Knowledge Graph');

// ── harvest ────────────────────────────────────────────
program.command('harvest')
  .description('Harvest knowledge from Oracle fleet')
  .option('--oracle <name>', 'Harvest specific Oracle only')
  .action(async (opts) => {
    console.log('Harvesting fleet...');

    let oracles = await getOnlineOracles();
    if (opts.oracle) {
      oracles = oracles.filter(o => o.name === opts.oracle);
      if (oracles.length === 0) {
        console.log(`  ✗ ${opts.oracle} — not online`);
        return;
      }
    }

    let totalNodes = 0, totalEdges = 0;
    for (const oracle of oracles) {
      const result = await harvestOracle(oracle);
      if (result.error) {
        console.log(`  ✗ ${oracle.name.padEnd(12)} — ${result.error}`);
      } else {
        console.log(`  ✓ ${oracle.name.padEnd(12)} — ${result.nodesCreated} nodes, ${result.edgesCreated} edges (${(result.durationMs / 1000).toFixed(1)}s)`);
        totalNodes += result.nodesCreated;
        totalEdges += result.edgesCreated;
      }
    }

    const crossEdges = buildCrossOracleEdges();
    console.log(`\nTotal: ${totalNodes} nodes, ${totalEdges + crossEdges} edges from ${oracles.length} Oracles (${crossEdges} cross-Oracle)`);
  });

// ── discover ───────────────────────────────────────────
program.command('discover')
  .description('Find cross-Oracle discoveries')
  .option('--type <type>', 'Filter: bridges, chains, clusters')
  .option('--min-score <n>', 'Minimum composite score', '6.0')
  .action((opts) => {
    console.log('Discovering connections...\n');

    const result = runDiscovery(parseFloat(opts.minScore));

    // Print discoveries
    const rows = sqlite.prepare(
      'SELECT * FROM discoveries ORDER BY composite_score DESC LIMIT 20'
    ).all() as any[];

    for (const d of rows) {
      if (opts.type && d.discovery_type !== opts.type) continue;
      const grade = getGrade(d.composite_score);
      const oracles = JSON.parse(d.source_oracles || '[]');
      console.log(`[${grade}] ${d.composite_score.toFixed(2)} — ${d.discovery_type}: ${d.title}`);
      console.log(`    ${oracles.join(' → ')}`);
      if (d.description) console.log(`    ${d.description.slice(0, 120)}`);
      console.log();
    }

    console.log(`Found: ${result.bridges} bridges, ${result.chains} chains, ${result.clusters} clusters (${result.total} total, ${result.durationMs}ms)`);
  });

// ── stats ──────────────────────────────────────────────
program.command('stats')
  .description('View graph statistics')
  .action(() => {
    const nodes = (sqlite.prepare('SELECT COUNT(*) as c FROM graph_nodes').get() as any).c;
    const edges = (sqlite.prepare('SELECT COUNT(*) as c FROM graph_edges').get() as any).c;
    const discs = (sqlite.prepare('SELECT COUNT(*) as c FROM discoveries').get() as any).c;
    const harvests = (sqlite.prepare("SELECT COUNT(DISTINCT oracle_name) as c FROM harvest_log WHERE status='success'").get() as any).c;

    const orphans = (sqlite.prepare(`
      SELECT COUNT(*) as c FROM graph_nodes
      WHERE id NOT IN (SELECT source_id FROM graph_edges) AND id NOT IN (SELECT target_id FROM graph_edges)
    `).get() as any).c;

    const crossDomain = (sqlite.prepare(`
      SELECT COUNT(*) as c FROM graph_edges e
      JOIN graph_nodes s ON s.id = e.source_id JOIN graph_nodes t ON t.id = e.target_id
      WHERE s.domain IS NOT NULL AND t.domain IS NOT NULL AND s.domain != t.domain
    `).get() as any).c;

    console.log(`Graph Oracle Stats`);
    console.log(`──────────────────`);
    console.log(`Nodes:              ${nodes}`);
    console.log(`Edges:              ${edges}`);
    console.log(`Discoveries:        ${discs}`);
    console.log(`Oracles Harvested:  ${harvests}/26`);
    console.log();
    console.log(`Quality Metrics`);
    console.log(`──────────────────`);
    console.log(`Connectivity:       ${nodes > 0 ? Math.round((1 - orphans / nodes) * 100) : 0}%`);
    console.log(`Orphan Rate:        ${nodes > 0 ? Math.round(orphans / nodes * 100) : 0}%`);
    console.log(`Cross-Domain Links: ${crossDomain}`);
  });

// ── search ─────────────────────────────────────────────
program.command('search <keyword>')
  .description('Search the graph')
  .option('--oracle <name>', 'Filter by Oracle')
  .option('--label <type>', 'Filter by label')
  .action((keyword, opts) => {
    let results = searchByKeyword(keyword, 20) as any[];
    if (opts.oracle) results = results.filter(r => r.oracle_source === opts.oracle);
    if (opts.label) results = results.filter(r => r.label === opts.label);

    console.log(`Search: "${keyword}" (${results.length} results)\n`);
    for (const r of results) {
      console.log(`  [${r.label}] ${r.name} — ${r.oracle_source || 'shared'}`);
    }
  });

// ── bridges ────────────────────────────────────────────
program.command('bridges')
  .description('View cross-domain bridges')
  .action(() => {
    const bridges = getCrossDomainBridges(20) as any[];
    console.log(`Cross-Domain Bridges\n──────────────────────`);
    for (const b of bridges) {
      const oracles = (b.oracles as string).split(',');
      console.log(`${b.concept.padEnd(20)} — ${oracles.length} Oracles (${b.departments})`);
    }
  });

// ── traverse ───────────────────────────────────────────
program.command('traverse')
  .description('Multi-hop traversal from a node')
  .requiredOption('--from <id>', 'Starting node ID')
  .option('--depth <n>', 'Max depth', '3')
  .option('--cross-domain', 'Cross-domain paths only')
  .option('--min-confidence <n>', 'Minimum confidence', '0.5')
  .action((opts) => {
    const paths = traverse(opts.from, parseInt(opts.depth), opts.crossDomain, parseFloat(opts.minConfidence));
    console.log(`Traverse from: ${opts.from} (${paths.length} paths)\n`);
    for (const p of paths.slice(0, 10)) {
      console.log(`  Path (depth ${p.depth}, confidence ${p.confidenceMin.toFixed(2)}):`);
      console.log(`    ${p.nodeNames.join(' → ')}`);
      console.log(`    Domains: ${p.domainsCrossed.join(', ')}\n`);
    }
  });

// ── report ─────────────────────────────────────────────
program.command('report')
  .description('Report discovery to relevant Oracles')
  .requiredOption('--id <id>', 'Discovery ID')
  .action(async (opts) => {
    const disc = sqlite.prepare('SELECT * FROM discoveries WHERE id = ?').get(opts.id) as any;
    if (!disc) { console.log('Discovery not found.'); return; }

    const oracles = JSON.parse(disc.source_oracles || '[]') as string[];
    console.log(`Reporting: ${disc.title}\n`);

    for (const name of oracles) {
      const url = getOracleUrl(name);
      if (!url) continue;
      try {
        const res = await fetch(`${url}/api/delegate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: name, from: 'graph',
            title: `Graph Discovery: ${disc.title}`,
            description: disc.description,
            priority: disc.composite_score >= 8 ? 'high' : 'normal',
            tags: ['graph-discovery', disc.discovery_type],
          }),
          signal: AbortSignal.timeout(5000),
        });
        console.log(`  → ${name}: ${res.ok ? 'delegated' : 'failed'}`);
      } catch {
        console.log(`  → ${name}: offline`);
      }
    }

    sqlite.prepare("UPDATE discoveries SET status = 'reported', reported_to = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(oracles), Date.now(), opts.id);
    console.log(`\nStatus: reported`);
  });

// ── discoveries ────────────────────────────────────────
program.command('discoveries')
  .description('List discoveries')
  .option('--status <s>', 'Filter by status')
  .option('--min-score <n>', 'Minimum score', '0')
  .action((opts) => {
    let sql = 'SELECT * FROM discoveries WHERE composite_score >= ?';
    const params: any[] = [parseFloat(opts.minScore)];
    if (opts.status) { sql += ' AND status = ?'; params.push(opts.status); }
    sql += ' ORDER BY composite_score DESC LIMIT 20';

    const rows = sqlite.prepare(sql).all(...params) as any[];
    for (const d of rows) {
      const grade = getGrade(d.composite_score);
      console.log(`[${grade}] ${d.composite_score.toFixed(2)} | ${d.discovery_type} | ${d.status} | ${d.title}`);
    }
    if (rows.length === 0) console.log('No discoveries found.');
  });

program.parse();
