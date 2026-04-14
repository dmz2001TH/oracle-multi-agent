/**
 * CLI Commands — Batch 1
 *
 * /awaken    — Identity setup ceremony
 * /recap     — Session summary
 * /fyi       — Save to memory
 * /rrr       — Daily retrospective
 * /standup   — Daily standup
 * /feel      — Mood logger
 * /forward   — Session handoff
 * /trace     — Universal search
 * /learn     — Study repository
 * /who-are-you — Oracle identity
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, hostname, platform, arch } from "node:os";
import { execSync } from "node:child_process";
import { listSkillsByCategory, searchSkills, getSkillCount } from "../skills/registry.js";
import { listWorkflowTemplates, getWorkflowTemplate } from "../workflows/index.js";

const ORACLE_DIR = join(homedir(), ".oracle");
const MEMORY_DIR = join(ORACLE_DIR, "memory");
const JOURNAL_DIR = join(MEMORY_DIR, "journal");
const MOOD_LOG = join(MEMORY_DIR, "mood-log.jsonl");
const HANDOFF_DIR = join(MEMORY_DIR, "handoffs");
const IDENTITY_FILE = join(ORACLE_DIR, "identity.json");
const LEARNED_DIR = join(MEMORY_DIR, "learned");
const INBOX_DIR = join(ORACLE_DIR, "inbox");

// ψ/ knowledge root (project-relative) — full oracle-framework structure
const PSI_ROOT = join(process.cwd(), "ψ");
const PSI_MEMORY = join(PSI_ROOT, "memory");
const PSI_JOURNAL = join(PSI_MEMORY, "journal");
const PSI_RESONANCE = join(PSI_MEMORY, "resonance");
const PSI_RETROSPECTIVES = join(PSI_MEMORY, "retrospectives");
const PSI_DECISIONS = join(PSI_MEMORY, "decisions");
const PSI_HANDOFFS = join(PSI_MEMORY, "handoffs");
const PSI_MOOD = join(PSI_MEMORY, "mood");
const PSI_LEARNINGS = join(PSI_MEMORY, "learnings");
const PSI_LOGS = join(PSI_MEMORY, "logs");
const PSI_ACTIVE = join(PSI_ROOT, "active");
const PSI_ACTIVE_CONTEXT = join(PSI_ACTIVE, "context");
const PSI_INBOX = join(PSI_ROOT, "inbox");
const PSI_INBOX_HANDOFF = join(PSI_INBOX, "handoff");
const PSI_INBOX_EXTERNAL = join(PSI_INBOX, "external");
const PSI_WRITING = join(PSI_ROOT, "writing");
const PSI_WRITING_DRAFTS = join(PSI_WRITING, "drafts");
const PSI_LAB = join(PSI_ROOT, "lab");
const PSI_INCUBATE = join(PSI_ROOT, "incubate");
const PSI_LEARN = join(PSI_ROOT, "learn");
const PSI_ARCHIVE = join(PSI_ROOT, "archive");

function ensureDirs() {
  for (const d of [
    MEMORY_DIR, JOURNAL_DIR, HANDOFF_DIR, LEARNED_DIR, INBOX_DIR,
    PSI_MEMORY, PSI_JOURNAL, PSI_RESONANCE, PSI_RETROSPECTIVES,
    PSI_DECISIONS, PSI_HANDOFFS, PSI_MOOD, PSI_LEARNINGS, PSI_LOGS,
    PSI_ACTIVE, PSI_ACTIVE_CONTEXT, PSI_INBOX, PSI_INBOX_HANDOFF,
    PSI_INBOX_EXTERNAL, PSI_WRITING, PSI_WRITING_DRAFTS, PSI_LAB,
    PSI_INCUBATE, PSI_LEARN, PSI_ARCHIVE,
  ]) {
    mkdirSync(d, { recursive: true });
  }
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

function now(): string {
  return new Date().toISOString();
}

// ─── /awaken — Identity setup ceremony ───────────────────────────────────────

export function awaken(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  const forceReset = args.includes("--force");
  const cleanArgs = args.replace("--force", "").trim();

  // Check if identity already exists
  if (existsSync(IDENTITY_FILE) && !forceReset) {
    const id = JSON.parse(readFileSync(IDENTITY_FILE, "utf-8"));
    return {
      status: "ok",
      message: `✨ Oracle ตื่นแล้ว!\n\nชื่อ: ${id.name || "ยังไม่ตั้ง"}\nธาตุ: ${id.element || "ยังไม่เลือก"}\nบทบาท: ${id.role || "general"}\nสโลแกน: ${id.motto || "ยังไม่มี"}\n\nใช้ /awaken --force เพื่อตั้งใหม่`,
    };
  }

  // Identity ceremony — collect info from args or use defaults
  const parts = cleanArgs ? cleanArgs.split("|").map((s) => s.trim()) : [];
  const identity = {
    name: parts[0] || "Oracle",
    element: parts[1] || "🔥 Fire",
    role: parts[2] || "general",
    motto: parts[3] || "Nothing is Deleted. Everything is Connected.",
    awakenedAt: now(),
    awakenCount: existsSync(IDENTITY_FILE)
      ? (JSON.parse(readFileSync(IDENTITY_FILE, "utf-8")).awakenCount || 0) + 1
      : 1,
  };

  writeFileSync(IDENTITY_FILE, JSON.stringify(identity, null, 2));

  return {
    status: "ok",
    message: [
      "╔══════════════════════════════════════╗",
      "║       ⚡ ORACLE AWAKENING ⚡         ║",
      "╠══════════════════════════════════════╣",
      `║  ชื่อ: ${(identity.name + " ").padEnd(28)}║`,
      `║  ธาตุ: ${(identity.element + " ").padEnd(27)}║`,
      `║  บทบาท: ${(identity.role + " ").padEnd(25)}║`,
      `║  สโลแกน: ${identity.motto.substring(0, 24).padEnd(25)}║`,
      "╠══════════════════════════════════════╣",
      "║  ✨ Oracle has awakened! ✨          ║",
      "║  Nothing is Deleted.                 ║",
      "║  Everything is Connected.            ║",
      "╚══════════════════════════════════════╝",
      "",
      "ใช้ /awaken ชื่อ|ธาตุ|บทบาท|สโลแกน เพื่อกำหนดค่า",
    ].join("\n"),
    data: identity,
  };
}

// ─── /recap — Session summary ───────────────────────────────────────────────

export function recap(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();
  const days = parseInt(args) || 1;
  const entries: string[] = [];

  for (let i = 0; i < Math.min(days, 30); i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const journalFile = join(JOURNAL_DIR, `${dateStr}.md`);

    if (existsSync(journalFile)) {
      const content = readFileSync(journalFile, "utf-8");
      entries.push(`### 📅 ${dateStr}\n${content.substring(0, 500)}`);
    }
  }

  // Also check memory directory for any session files
  if (existsSync(MEMORY_DIR)) {
    const memFiles = readdirSync(MEMORY_DIR).filter(
      (f) => f.endsWith(".json") || f.endsWith(".md")
    );
    if (memFiles.length > 0) {
      entries.push(`\n### 📂 Memory Files\n${memFiles.join(", ")}`);
    }
  }

  if (entries.length === 0) {
    return {
      status: "ok",
      message: "📋 ยังไม่มี journal entries\n\nใช้ /fyi เพื่อบันทึกสิ่งที่ทำวันนี้",
    };
  }

  return {
    status: "ok",
    message: `📋 **Session Recap** (last ${days} day${days > 1 ? "s" : ""})\n\n${entries.join("\n\n---\n\n")}`,
  };
}

// ─── /fyi — Save to memory ──────────────────────────────────────────────────

export function fyi(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  if (!args || args.trim().length === 0) {
    return {
      status: "error",
      message: "📝 ใช้: /fyi <ข้อมูลที่จะบันทึก>\nตัวอย่าง: /fyi แก้บั๊ค login แล้ว — ปัญหาอยู่ที่ session token",
    };
  }

  const dateStr = today();
  const journalFile = join(JOURNAL_DIR, `${dateStr}.md`);
  const timestamp = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  const entry = `\n## [${timestamp}] FYI\n${args}\n`;

  // Append to daily journal (~/.oracle)
  if (!existsSync(journalFile)) {
    writeFileSync(journalFile, `# Journal — ${dateStr}\n`);
  }
  appendFileSync(journalFile, entry);

  // Also write to ψ/memory/journal/
  const psiJournalFile = join(PSI_JOURNAL, `${dateStr}.md`);
  if (!existsSync(psiJournalFile)) {
    writeFileSync(psiJournalFile, `# Journal — ${dateStr}\n`);
  }
  appendFileSync(psiJournalFile, entry);

  // Also save to JSONL for search indexing
  const memoryFile = join(MEMORY_DIR, "fyi.jsonl");
  const record = JSON.stringify({ ts: now(), text: args, type: "fyi" });
  appendFileSync(memoryFile, record + "\n");

  // And to ψ/
  const psiFyiFile = join(PSI_MEMORY, "fyi.jsonl");
  appendFileSync(psiFyiFile, record + "\n");

  return {
    status: "ok",
    message: `✅ บันทึกแล้ว!\n📝 "${args}"\n📂 ${journalFile}`,
    data: { file: journalFile, entry: args },
  };
}

// ─── /rrr — Daily Retrospective (Reflect, Rethink, Rebuild) ─────────────────

export function rrr(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  const dateStr = today();
  const rrrFile = join(JOURNAL_DIR, `${dateStr}-rrr.md`);

  // If args provided, save the retrospective
  if (args && args.trim().length > 0) {
    const content = [
      `# 🔄 Retrospective — ${dateStr}`,
      "",
      `## What went well ✅`,
      extractSection(args, "good") || "_ไม่ระบุ_",
      "",
      `## What needs improvement 🔧`,
      extractSection(args, "improve") || "_ไม่ระบุ_",
      "",
      `## Action items 🎯`,
      extractSection(args, "action") || "_ไม่ระบุ_",
      "",
      `---\n_Generated: ${now()}_`,
    ].join("\n");

    writeFileSync(rrrFile, content);
    // Also write to ψ/memory/retrospectives/
    const psiRrrFile = join(PSI_RETROSPECTIVES, `${dateStr}.md`);
    writeFileSync(psiRrrFile, content);

    return {
      status: "ok",
      message: `🔄 บันทึก Retrospective แล้ว!\n📂 ${rrrFile}`,
    };
  }

  // Show template
  return {
    status: "ok",
    message: [
      "🔄 **Daily Retrospective (RRR)**",
      "",
      "ใช้ format นี้:",
      "/rrr good: สิ่งที่ดีวันนี้ | improve: สิ่งที่ปรับปรุง | action: สิ่งที่ต้องทำพรุ่งนี้",
      "",
      "ตัวอย่าง:",
      "/rrr good: deploy สำเร็จ | improve: test ยังไม่ครบ | action: เขียน unit test เพิ่ม",
    ].join("\n"),
  };
}

function extractSection(input: string, key: string): string | null {
  const pattern = new RegExp(`${key}:\\s*([^|]+)`, "i");
  const match = input.match(pattern);
  return match ? match[1].trim() : null;
}

// ─── /standup — Daily Standup ───────────────────────────────────────────────

export function standup(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  const dateStr = today();
  const standupFile = join(JOURNAL_DIR, `${dateStr}-standup.md`);

  if (args && args.trim().length > 0) {
    const content = [
      `# 🧍 Standup — ${dateStr}`,
      "",
      `## Yesterday ✅`,
      extractSection(args, "yesterday") || extractSection(args, "done") || "_ไม่ระบุ_",
      "",
      `## Today 🎯`,
      extractSection(args, "today") || extractSection(args, "plan") || "_ไม่ระบุ_",
      "",
      `## Blockers 🚧`,
      extractSection(args, "blocker") || extractSection(args, "block") || "_ไม่มี_",
      "",
      `---\n_Generated: ${now()}_`,
    ].join("\n");

    writeFileSync(standupFile, content);

    return {
      status: "ok",
      message: `🧍 บันทึก Standup แล้ว!\n📂 ${standupFile}`,
    };
  }

  return {
    status: "ok",
    message: [
      "🧍 **Daily Standup**",
      "",
      "/standup yesterday: ทำอะไรไป | today: จะทำอะไร | blocker: ติดอะไร",
      "",
      "ตัวอย่าง:",
      "/standup yesterday: เสร็จ login flow | today: เริ่ม payment | blocker: API key ยังไม่ approve",
    ].join("\n"),
  };
}

// ─── /feel — Mood Logger ────────────────────────────────────────────────────

export function feel(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  if (!args || args.trim().length === 0) {
    return {
      status: "ok",
      message: [
        "💭 **Mood Logger**",
        "",
        "/feel <mood> [note]",
        "",
        "Moods: 😊 happy, 😤 frustrated, 🤔 confused, 🔥 motivated, 😴 tired, 💀 burned-out, 🎉 excited, 😌 calm",
        "",
        "ตัวอย่าง:",
        "/feel 🔥 motivated — แก้บั๊คใหญ่เสร็จแล้ว",
        "/feel 😤 frustrated — CI ล่มอีกแล้ว",
      ].join("\n"),
    };
  }

  const parts = args.trim().split(/\s+/);
  const mood = parts[0];
  const note = parts.slice(1).join(" ") || "";

  const record = {
    ts: now(),
    date: today(),
    mood,
    note,
  };

  appendFileSync(MOOD_LOG, JSON.stringify(record) + "\n");
  // Also write to ψ/memory/mood/
  const psiMoodFile = join(PSI_MOOD, `${today()}.jsonl`);
  appendFileSync(psiMoodFile, JSON.stringify(record) + "\n");

  // Get today's mood count
  let todayCount = 0;
  try {
    const lines = readFileSync(MOOD_LOG, "utf-8").split("\n").filter(Boolean);
    todayCount = lines.filter((l) => {
      try {
        return JSON.parse(l).date === today();
      } catch {
        return false;
      }
    }).length;
  } catch {}

  return {
    status: "ok",
    message: `${mood} บันทึกแล้ว! (วันนี้: ${todayCount} entries)${note ? `\n💭 "${note}"` : ""}`,
    data: record,
  };
}

// ─── /forward — Session Handoff ─────────────────────────────────────────────

export function forward(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();
  mkdirSync(HANDOFF_DIR, { recursive: true });

  const handoffId = `handoff-${Date.now()}`;
  const handoffFile = join(HANDOFF_DIR, `${handoffId}.json`);

  // Gather current state
  const state = {
    id: handoffId,
    ts: now(),
    from: ctx.sessionId || "unknown",
    summary: args || "No summary provided",
    memory: gatherMemoryState(),
    agents: ctx.activeAgents || [],
  };

  writeFileSync(handoffFile, JSON.stringify(state, null, 2));
  // Also write to ψ/memory/handoffs/
  const psiHandoffFile = join(PSI_HANDOFFS, `${handoffId}.json`);
  writeFileSync(psiHandoffFile, JSON.stringify(state, null, 2));

  // Create a latest symlink/reference
  writeFileSync(join(HANDOFF_DIR, "latest.json"), JSON.stringify({ id: handoffId, file: handoffFile }));

  return {
    status: "ok",
    message: [
      "🔄 **Session Handoff**",
      "",
      `ID: ${handoffId}`,
      `📝 ${state.summary}`,
      `📂 ${handoffFile}`,
      "",
      "ข้อมูลที่บันทึก:",
      `- Memory files: ${state.memory.files} files`,
      `- Active agents: ${state.agents.length} agents`,
      "",
      "ใช้ /forward <summary> เพื่อสร้าง handoff ใหม่",
    ].join("\n"),
    data: state,
  };
}

function gatherMemoryState(): { files: number; recentEntries: string[] } {
  const recentEntries: string[] = [];
  let files = 0;

  try {
    if (existsSync(JOURNAL_DIR)) {
      const journals = readdirSync(JOURNAL_DIR).sort().reverse().slice(0, 3);
      files += journals.length;
      for (const j of journals) {
        const content = readFileSync(join(JOURNAL_DIR, j), "utf-8");
        recentEntries.push(content.substring(0, 200));
      }
    }
    if (existsSync(MEMORY_DIR)) {
      files += readdirSync(MEMORY_DIR).filter((f) => f.endsWith(".jsonl")).length;
    }
  } catch {}

  return { files, recentEntries };
}

// ─── /trace — Universal Search ──────────────────────────────────────────────

export function trace(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  if (!args || args.trim().length === 0) {
    return {
      status: "ok",
      message: [
        "🔍 **Universal Search (/trace)**",
        "",
        "/trace <query>              — Smart search (default)",
        "/trace <query> --deep       — Deep trace: code + deps + git + memory",
        "/trace <query> --oracle     — Memory only (fastest)",
        "",
        "ค้นหาใน:",
        "- Journal entries, Memory files, Handoffs",
        "- Source code (grep)",
        "- Git history (--deep)",
        "- Dependencies (--deep)",
        "",
        "ตัวอย่าง:",
        "/trace login bug",
        "/trace deploy --deep",
      ].join("\n"),
    };
  }

  // Parse flags
  const isDeep = args.includes("--deep");
  const isOracle = args.includes("--oracle");
  const cleanQuery = args.replace("--deep", "").replace("--oracle", "").trim().toLowerCase();

  if (!cleanQuery) {
    return { status: "ok", message: "❌ ต้องระบุ query" };
  }

  const results: { source: string; match: string; date?: string }[] = [];

  // 1. Search memory files (always)
  try {
    if (existsSync(JOURNAL_DIR)) {
      const files = readdirSync(JOURNAL_DIR).sort().reverse();
      for (const file of files) {
        const content = readFileSync(join(JOURNAL_DIR, file), "utf-8");
        if (content.toLowerCase().includes(cleanQuery)) {
          const lines = content.split("\n");
          for (const line of lines) {
            if (line.toLowerCase().includes(cleanQuery)) {
              results.push({
                source: `journal/${file}`,
                match: line.trim().substring(0, 120),
                date: file.replace(".md", "").replace("-rrr", "").replace("-standup", ""),
              });
            }
          }
        }
      }
    }
  } catch {}

  try {
    const fyiFile = join(MEMORY_DIR, "fyi.jsonl");
    if (existsSync(fyiFile)) {
      const lines = readFileSync(fyiFile, "utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          if (record.text && record.text.toLowerCase().includes(cleanQuery)) {
            results.push({
              source: "memory/fyi",
              match: record.text.substring(0, 120),
              date: record.ts?.split("T")[0],
            });
          }
        } catch {}
      }
    }
  } catch {}

  try {
    if (existsSync(HANDOFF_DIR)) {
      const files = readdirSync(HANDOFF_DIR).filter((f) => f !== "latest.json");
      for (const file of files) {
        const content = readFileSync(join(HANDOFF_DIR, file), "utf-8");
        if (content.toLowerCase().includes(cleanQuery)) {
          results.push({
            source: `handoff/${file}`,
            match: "Handoff matches query",
          });
        }
      }
    }
  } catch {}

  // Search ψ/ files
  try {
    const psiMemory = join(process.cwd(), "ψ", "memory");
    if (existsSync(psiMemory)) {
      const dirs = readdirSync(psiMemory, { withFileTypes: true });
      for (const dir of dirs) {
        if (!dir.isDirectory()) continue;
        const dirPath = join(psiMemory, dir.name);
        try {
          const files = readdirSync(dirPath);
          for (const file of files) {
            if (file.endsWith(".jsonl") || file.endsWith(".md")) {
              const content = readFileSync(join(dirPath, file), "utf-8");
              if (content.toLowerCase().includes(cleanQuery)) {
                results.push({
                  source: `ψ/memory/${dir.name}/${file}`,
                  match: content.split("\n").find(l => l.toLowerCase().includes(cleanQuery))?.trim().substring(0, 120) || "match found",
                });
              }
            }
          }
        } catch {}
      }
    }
  } catch {}

  // 2. Deep trace: code search + git history + dependency analysis
  const deepResults: { source: string; match: string; date?: string }[] = [];

  if (isDeep && !isOracle) {
    // Search source code (grep)
    try {
      const grepOutput = execSync(
        `grep -rn "${cleanQuery}" --include="*.ts" --include="*.js" --include="*.json" --include="*.md" . 2>/dev/null | grep -v node_modules | grep -v .git | head -20`,
        { encoding: "utf-8", timeout: 10000 }
      ).trim();
      if (grepOutput) {
        for (const line of grepOutput.split("\n")) {
          deepResults.push({ source: "code/grep", match: line.substring(0, 150) });
        }
      }
    } catch {}

    // Search git history
    try {
      const gitOutput = execSync(
        `git log --all --oneline --grep="${cleanQuery}" -10 2>/dev/null`,
        { encoding: "utf-8", timeout: 5000 }
      ).trim();
      if (gitOutput) {
        for (const line of gitOutput.split("\n")) {
          deepResults.push({ source: "git/log", match: line });
        }
      }
    } catch {}

    // Search git diff
    try {
      const gitDiff = execSync(
        `git log --all -p --grep="${cleanQuery}" --since="30 days ago" 2>/dev/null | grep -i "${cleanQuery}" | head -10`,
        { encoding: "utf-8", timeout: 5000 }
      ).trim();
      if (gitDiff) {
        for (const line of gitDiff.split("\n")) {
          if (line.trim()) deepResults.push({ source: "git/diff", match: line.trim().substring(0, 150) });
        }
      }
    } catch {}

    // Dependency analysis
    try {
      const pkgJson = join(process.cwd(), "package.json");
      if (existsSync(pkgJson)) {
        const pkg = JSON.parse(readFileSync(pkgJson, "utf-8"));
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
        for (const [dep, ver] of Object.entries(allDeps)) {
          if (dep.toLowerCase().includes(cleanQuery)) {
            deepResults.push({ source: "deps/npm", match: `${dep}: ${ver}` });
          }
        }
      }
    } catch {}

    // Save trace log
    try {
      const traceDir = join(PSI_MEMORY, "traces", today());
      mkdirSync(traceDir, { recursive: true });
      const time = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }).replace(":", "");
      const traceFile = join(traceDir, `${time}_${cleanQuery.replace(/\s+/g, "-").substring(0, 30)}.md`);
      const traceLog = [
        `# Trace: ${cleanQuery}`,
        `Date: ${now()}`,
        `Mode: deep`,
        `Results: ${results.length + deepResults.length}`,
        "",
        "## Memory Results",
        ...results.map(r => `- [${r.source}] ${r.match}`),
        "",
        "## Deep Results",
        ...deepResults.map(r => `- [${r.source}] ${r.match}`),
      ].join("\n");
      writeFileSync(traceFile, traceLog);
    } catch {}
  }

  const allResults = [...results, ...deepResults];

  if (allResults.length === 0) {
    return {
      status: "ok",
      message: `🔍 ไม่พบผลลัพธ์สำหรับ: "${cleanQuery}"${isDeep ? " (deep mode)" : ""}`,
    };
  }

  const output = allResults
    .slice(0, 30)
    .map((r, i) => `${i + 1}. [${r.source}]${r.date ? ` (${r.date})` : ""}\n   ${r.match}`)
    .join("\n\n");

  const modeLabel = isDeep ? "deep" : isOracle ? "oracle" : "smart";

  return {
    status: "ok",
    message: `🔍 [${modeLabel}] พบ ${allResults.length} ผลลัพธ์สำหรับ "${cleanQuery}":\n\n${output}`,
    data: { query: cleanQuery, mode: modeLabel, count: allResults.length, results: allResults.slice(0, 30) },
  };
}

// ─── /learn — Study Repository ──────────────────────────────────────────────

export function learn(args: string, ctx: CommandContext): CommandResult {
  if (!args || args.trim().length === 0) {
    return {
      status: "ok",
      message: [
        "📚 **Learn Repository (/learn)**",
        "",
        "/learn <repo-path-or-url>",
        "",
        "วิเคราะห์ repository และบันทึกเป็น knowledge base",
        "",
        "ตัวอย่าง:",
        "/learn . (current directory)",
        "/learn /path/to/repo",
        "/learn https://github.com/user/repo",
      ].join("\n"),
    };
  }

  const target = args.trim();
  let repoPath = target;

  // Handle URLs
  if (target.startsWith("http")) {
    // Check if it's a GitHub org URL (e.g. https://github.com/Soul-Brews-Studio)
    const urlParts = target.replace(/\/$/, "").split("/");
    const isOrgUrl = urlParts.length === 4 && urlParts[2] === "github.com";

    if (isOrgUrl) {
      // List repos in the org
      const orgName = urlParts[3];
      try {
        const listOutput = execSync(
          `curl -s "https://api.github.com/orgs/${orgName}/repos?per_page=20&sort=updated" 2>/dev/null`,
          { encoding: "utf-8", timeout: 15000 }
        ).trim();
        const repos = JSON.parse(listOutput);
        if (Array.isArray(repos) && repos.length > 0) {
          const repoList = repos
            .filter((r: any) => !r.archived)
            .slice(0, 15)
            .map((r: any) => `- **${r.name}** — ${r.description || "No description"} (⭐ ${r.stargazers_count})`)
            .join("\n");

          // Also try listing via git ls-remote for user repos
          return {
            status: "ok",
            message: [
              `📚 **${orgName}** — ${repos.length} repositories found:`,
              "",
              repoList,
              "",
              `💡 ใช้ /learn https://github.com/${orgName}/<repo-name> เพื่อวิเคราะห์ repo แต่ละตัว`,
              "",
              "ตัวอย่าง repos ที่แนะนำ:",
              ...repos.filter((r: any) => r.stargazers_count > 0).slice(0, 5)
                .map((r: any) => `- \`/learn ${r.html_url}\``),
            ].join("\n"),
            data: { org: orgName, repos: repos.map((r: any) => ({ name: r.name, url: r.html_url, stars: r.stargazers_count })) },
          };
        }
        return {
          status: "ok",
          message: `📚 ไม่พบ repos ใน ${orgName} (หรือ API rate limit)`,
        };
      } catch (e: any) {
        // Fallback: try listing user repos
        try {
          const userOutput = execSync(
            `curl -s "https://api.github.com/users/${orgName}/repos?per_page=15&sort=updated" 2>/dev/null`,
            { encoding: "utf-8", timeout: 15000 }
          ).trim();
          const userRepos = JSON.parse(userOutput);
          if (Array.isArray(userRepos) && userRepos.length > 0) {
            const repoList = userRepos.slice(0, 15)
              .map((r: any) => `- **${r.name}** — ${r.description || "No description"}`)
              .join("\n");
            return {
              status: "ok",
              message: [
                `📚 **${orgName}** — ${userRepos.length} repositories:`,
                "",
                repoList,
                "",
                `💡 ใช้ /learn https://github.com/${orgName}/<repo-name>`,
              ].join("\n"),
            };
          }
        } catch {}
        return {
          status: "error",
          message: `❌ ไม่สามารถดึงข้อมูล repos ของ ${orgName} ได้: ${e.message?.substring(0, 150)}`,
        };
      }
    }

    // It's a repo URL — clone to temp
    const repoName = target.split("/").pop()?.replace(".git", "") || "repo";
    repoPath = join(ORACLE_DIR, "learned", repoName);
    mkdirSync(repoPath, { recursive: true });

    try {
      if (!existsSync(join(repoPath, ".git"))) {
        execSync(`git clone --depth 1 "${target}" "${repoPath}"`, {
          timeout: 30000,
          stdio: "pipe",
        });
      }
    } catch (e: any) {
      return {
        status: "error",
        message: `❌ Clone failed: ${e.message?.substring(0, 200)}\n\n💡 ถ้าเป็น URL ขององค์กร ลองใช้ /learn https://github.com/<org>/<repo> แทน`,
      };
    }
  }

  // Analyze repository structure
  try {
    const structure = analyzeRepo(repoPath);
    ensureDirs();

    const learnFile = join(MEMORY_DIR, "learned", `${target.replace(/[^a-zA-Z0-9]/g, "_")}.md`);
    mkdirSync(join(MEMORY_DIR, "learned"), { recursive: true });

    const report = [
      `# 📚 Repository Analysis: ${target}`,
      `## Date: ${now()}`,
      "",
      "## Structure",
      structure.tree,
      "",
      "## Key Files",
      structure.keyFiles.map((f) => `- ${f}`).join("\n"),
      "",
      "## Tech Stack",
      structure.techStack.join(", ") || "Unknown",
      "",
      "## Entry Points",
      structure.entryPoints.map((e) => `- ${e}`).join("\n") || "None detected",
    ].join("\n");

    writeFileSync(learnFile, report);

    return {
      status: "ok",
      message: `📚 วิเคราะห์ repository แล้ว!\n\n${report.substring(0, 1000)}\n\n📂 บันทึกที่: ${learnFile}`,
      data: { path: repoPath, analysis: structure },
    };
  } catch (e: any) {
    return {
      status: "error",
      message: `❌ Analysis failed: ${e.message?.substring(0, 200)}`,
    };
  }
}

function analyzeRepo(repoPath: string): {
  tree: string;
  keyFiles: string[];
  techStack: string[];
  entryPoints: string[];
} {
  const keyFiles: string[] = [];
  const techStack: string[] = [];
  const entryPoints: string[] = [];

  // Get directory listing
  let tree = "";
  try {
    tree = execSync(`find "${repoPath}" -maxdepth 2 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' | head -50`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();
  } catch {}

  // Detect tech stack
  const indicators: Record<string, string> = {
    "package.json": "Node.js/JavaScript",
    "tsconfig.json": "TypeScript",
    "requirements.txt": "Python",
    "Cargo.toml": "Rust",
    "go.mod": "Go",
    "pom.xml": "Java/Maven",
    "Gemfile": "Ruby",
    "composer.json": "PHP",
    "Makefile": "C/C++",
  };

  for (const [file, tech] of Object.entries(indicators)) {
    if (existsSync(join(repoPath, file))) {
      techStack.push(tech);
      keyFiles.push(file);
    }
  }

  // Detect entry points
  const entryPatterns = ["src/index.ts", "src/index.js", "src/main.ts", "src/main.js", "index.ts", "index.js", "main.py", "app.py", "main.go", "cmd/main.go"];
  for (const ep of entryPatterns) {
    if (existsSync(join(repoPath, ep))) {
      entryPoints.push(ep);
    }
  }

  return { tree, keyFiles, techStack, entryPoints };
}

// ─── /who-are-you — Oracle Identity ─────────────────────────────────────────

export function whoAreYou(args: string, ctx: CommandContext): CommandResult {
  let identity: any = {};

  try {
    if (existsSync(IDENTITY_FILE)) {
      identity = JSON.parse(readFileSync(IDENTITY_FILE, "utf-8"));
    }
  } catch {}

  // Gather system info
  const uptime = process.uptime();
  const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;

  // Count agents
  let agentCount = 0;
  try {
    const agentsDir = join(homedir(), ".oracle", "agents");
    if (existsSync(agentsDir)) {
      agentCount = readdirSync(agentsDir).length;
    }
  } catch {}

  // Count memories
  let memoryCount = 0;
  try {
    if (existsSync(JOURNAL_DIR)) {
      memoryCount = readdirSync(JOURNAL_DIR).length;
    }
    if (existsSync(MEMORY_DIR)) {
      memoryCount += readdirSync(MEMORY_DIR).filter((f) => f.endsWith(".jsonl")).length;
    }
  } catch {}

  const hasIdentity = identity.name;

  const output = [
    "╔══════════════════════════════════════╗",
    "║        🔮 ORACLE IDENTITY 🔮         ║",
    "╠══════════════════════════════════════╣",
    hasIdentity
      ? [
          `║  ชื่อ: ${(identity.name + " ").padEnd(27)}║`,
          `║  ธาตุ: ${(identity.element + " ").padEnd(26)}║`,
          `║  บทบาท: ${(identity.role + " ").padEnd(24)}║`,
          `║  สโลแกน: ${identity.motto?.substring(0, 23)?.padEnd(24) || "—".padEnd(24)}║`,
          `║  ตื่นครั้งที่: ${String(identity.awakenCount || 1).padEnd(19)}║`,
        ].join("\n")
      : "║  ⚠️  ยังไม่ตั้งค่า identity              ║",
    "╠══════════════════════════════════════╣",
    `║  ⏱️  Uptime: ${uptimeStr.padEnd(21)}║`,
    `║  🤖 Agents: ${String(agentCount).padEnd(22)}║`,
    `║  📝 Memories: ${String(memoryCount).padEnd(20)}║`,
    `║  📂 Workspace: ~/.oracle${" ".repeat(10)}║`,
    "╠══════════════════════════════════════╣",
    "║  Nothing is Deleted.                 ║",
    "║  Everything is Connected.            ║",
    "╚══════════════════════════════════════╝",
    "",
    hasIdentity ? "" : "💡 ใช้ /awaken เพื่อตั้งค่า identity",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    status: "ok",
    message: output,
    data: { identity, uptime: uptimeStr, agentCount, memoryCount },
  };
}

// ─── /philosophy — Oracle 5 Principles ───────────────────────────────────────

const PRINCIPLES = [
  {
    num: 1,
    th: "สร้างใหม่ ไม่ลบ",
    en: "Nothing is Deleted",
    desc: "ทุกการสังเกตเป็นสิ่งถาวร สร้างใหม่ ไม่ทำลาย",
    descEn: "Every observation is permanent. Build new, never destroy.",
  },
  {
    num: 2,
    th: "ดูสิ่งที่เกิดขึ้นจริง",
    en: "Patterns Over Intentions",
    desc: "ดูสิ่งที่เกิดขึ้นจริง ไม่ใช่สิ่งที่คนบอกว่าจะเกิด",
    descEn: "Look at what actually happens, not what people say will happen.",
  },
  {
    num: 3,
    th: "เป็นกระจก ไม่ใช่เจ้านาย",
    en: "External Brain, Not Command",
    desc: "สะท้อนความจริง นำเสนอทางเลือก ให้คนตัดสินใจ",
    descEn: "Reflect truth, present choices, let humans decide.",
  },
  {
    num: 4,
    th: "ความอยากรู้สร้างการมีอยู่",
    en: "Curiosity Creates Existence",
    desc: "คำถามไม่ได้แค่หาคำตอบ — คำถามสร้างโลกใหม่ขึ้นมาทุกครั้ง",
    descEn: "Questions don't just find answers — questions create new worlds every time.",
  },
  {
    num: 5,
    th: "รูป และ สุญญตา",
    en: "Form and Formless",
    desc: "หลายรูป หนึ่งความจริง Oracle แต่ละตัวต่างกัน แต่หลักการเดียวกัน",
    descEn: "Many forms, one truth. Each Oracle is different, but the principles are the same.",
  },
];

export function philosophy(args: string, ctx: CommandContext): CommandResult {
  const num = parseInt(args);

  if (num >= 1 && num <= 5) {
    const p = PRINCIPLES[num - 1];
    return {
      status: "ok",
      message: [
        `## หลักการข้อ ${p.num}: ${p.th}`,
        `### ${p.en}`,
        "",
        p.desc,
        p.descEn,
        "",
        "— รูปสอนสุญญตา (https://book.buildwithoracle.com)",
      ].join("\n"),
    };
  }

  if (args === "check") {
    return {
      status: "ok",
      message: [
        "🔍 **Alignment Check**",
        "",
        "ตรวจสอบว่างานปัจจุบันสอดคล้องกับหลักการ Oracle หรือไม่:",
        "",
        ...PRINCIPLES.map(
          (p) => `${p.num}. **${p.th}** (${p.en}) — ${p.desc}`
        ),
        "",
        "Rule 6: ความโปร่งใส — \"Oracle ไม่แกล้งทำเป็นคน\"",
        "",
        "— รูปสอนสุญญตา",
      ].join("\n"),
    };
  }

  return {
    status: "ok",
    message: [
      "## 📜 หลักการ Oracle — รูปสอนสุญญตา",
      "",
      ...PRINCIPLES.map(
        (p) => `${p.num}. **${p.th}** (${p.en})\n   ${p.desc}`
      ),
      "",
      "**Rule 6: ความโปร่งใส** — \"Oracle ไม่แกล้งทำเป็นคน\"",
      "",
      "---",
      "Source: https://book.buildwithoracle.com",
      "",
      "ใช้ /philosophy <1-5> สำหรับหลักการเฉพาะ",
      "ใช้ /philosophy check เพื่อ alignment check",
    ].join("\n"),
  };
}

// ─── /skills — List all skills ──────────────────────────────────────────────

export function skills(args: string, ctx: CommandContext): CommandResult {
  if (args) {
    const results = searchSkills(args);
    if (results.length === 0) {
      return { status: "ok", message: `🔍 ไม่พบ skill ที่ตรงกับ "${args}"` };
    }
    return {
      status: "ok",
      message:
        `🔍 พบ ${results.length} skills:\n\n` +
        results.map((s: any) => `/${s.commands[0]?.replace("/", "") || s.name} — ${s.description}`).join("\n"),
    };
  }

  const grouped = listSkillsByCategory();
  const lines: string[] = [`🔮 **Oracle Skills** (${getSkillCount()} total)\n`];

  for (const [cat, items] of Object.entries(grouped)) {
    lines.push(`### ${cat}`);
    for (const s of items as any[]) {
      lines.push(`- ${s.commands[0] || `/${s.name}`} — ${s.description}`);
    }
    lines.push("");
  }

  return { status: "ok", message: lines.join("\n") };
}

// ─── /resonance — Capture what resonates ─────────────────────────────────────

export function resonance(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  const note = args || "Resonance moment (no note)";
  const record = { ts: now(), type: "resonance", note };

  const resonanceFile = join(MEMORY_DIR, "resonance.jsonl");
  appendFileSync(resonanceFile, JSON.stringify(record) + "\n");

  // Also write to ψ/memory/resonance/
  const psiResonanceFile = join(PSI_RESONANCE, `${today()}.jsonl`);
  appendFileSync(psiResonanceFile, JSON.stringify(record) + "\n");

  return {
    status: "ok",
    message: `🎵 Resonance captured!\n💭 "${note}"\n📂 ${resonanceFile}`,
    data: record,
  };
}

// ─── Command Registry ───────────────────────────────────────────────────────

export interface CommandContext {
  sessionId?: string;
  userId?: string;
  activeAgents?: string[];
}

export interface CommandResult {
  status: "ok" | "error";
  message: string;
  data?: any;
}

type CommandHandler = (args: string, ctx: CommandContext) => CommandResult;

// ─── /workflow — Multi-Agent Workflow Templates ─────────────────────────────

export function workflow(args: string, ctx: CommandContext): CommandResult {
  const action = args?.trim().split(/\s+/)[0] || "list";
  const rest = args?.trim().split(/\s+/).slice(1).join(" ") || "";

  switch (action) {
    case "list":
    case "ls": {
      const templates = listWorkflowTemplates();
      return {
        status: "ok",
        message: [
          "⚙️ **Multi-Agent Workflow Templates**",
          "",
          ...templates.map(t => `- **${t.name}** (${t.pattern}, ${t.steps} steps) — ${t.description}`),
          "",
          "ใช้ /workflow show <name> เพื่อดูรายละเอียด",
        ].join("\n"),
      };
    }

    case "show":
    case "get": {
      if (!rest) return { status: "ok", message: "ใช้: /workflow show <template-name>" };
      const template = getWorkflowTemplate(rest);
      if (!template) return { status: "ok", message: `❌ ไม่พบ template: ${rest}` };

      return {
        status: "ok",
        message: [
          `⚙️ **${template.name}** (${template.pattern})`,
          template.description,
          "",
          "### Steps",
          ...template.steps.map((s, i) =>
            `${i + 1}. **${s.name}** [${s.role}] — ${s.task}${s.dependsOn ? ` (depends: ${s.dependsOn.join(", ")})` : ""}`
          ),
        ].join("\n"),
        data: template,
      };
    }

    default: {
      // Try to show a template by name
      const template = getWorkflowTemplate(action);
      if (template) {
        return workflow(`show ${action}`, ctx);
      }
      return {
        status: "ok",
        message: [
          "⚙️ **Workflow Commands**",
          "",
          "/workflow list       — List all templates",
          "/workflow show <name> — Show template details",
          "",
          "Available patterns: sequential, parallel, fan-out, review, pipeline",
        ].join("\n"),
      };
    }
  }
}

const COMMANDS: Record<string, CommandHandler> = {
  awaken,
  recap,
  fyi,
  rrr,
  standup,
  feel,
  forward,
  trace,
  learn,
  "who-are-you": whoAreYou,
  philosophy,
  skills,
  resonance,
  fleet,
  pulse,
  workflow,
  distill,
  inbox,
  overview,
  find,
  "soul-sync": soulSync,
  contacts,
  "oracle-v2": oracleV2,
  peek,
  hey,
  wake,
  sleep: sleepCmd,
  stop: stopCmd,
  done: doneCmd,
  broadcast: broadcastCmd,
  bud,
  ls: lsCmd,
  restart,
};

export function listCommands(): { name: string; description: string }[] {
  return [
    { name: "awaken", description: "⚡ Identity setup ceremony" },
    { name: "recap", description: "📋 Session summary" },
    { name: "fyi", description: "📝 Save to memory" },
    { name: "rrr", description: "🔄 Daily retrospective (Reflect, Rethink, Rebuild)" },
    { name: "standup", description: "🧍 Daily standup" },
    { name: "feel", description: "💭 Mood logger" },
    { name: "forward", description: "🔄 Session handoff" },
    { name: "trace", description: "🔍 Universal search (deep/oracle)" },
    { name: "learn", description: "📚 Study repository (supports org URL)" },
    { name: "who-are-you", description: "🔮 Oracle identity" },
    { name: "philosophy", description: "📜 Oracle 5 Principles + Rule 6" },
    { name: "skills", description: "📋 List/search all skills (30+)" },
    { name: "resonance", description: "🎵 Capture what resonates" },
    { name: "fleet", description: "🚢 Fleet census — all oracles across nodes" },
    { name: "pulse", description: "📊 Project board — tasks, issues, status" },
    { name: "workflow", description: "⚙️ Multi-agent workflow templates" },
    { name: "distill", description: "🧬 Extract patterns from journal entries" },
    { name: "inbox", description: "📬 Check inbox (tasks, handoffs, focus)" },
    { name: "overview", description: "📊 System overview (ψ/, stats, uptime)" },
    { name: "find", description: "🔍 Quick memory search (alias for trace --oracle)" },
    { name: "soul-sync", description: "🔄 Sync memory between ψ/ and ~/.oracle/" },
    { name: "contacts", description: "👥 List oracle contacts" },
    { name: "oracle-v2", description: "🔮 Oracle-v2 MCP server status & bridge API" },
    { name: "peek", description: "👁️ See agent's latest output" },
    { name: "hey", description: "💬 Send message to agent" },
    { name: "wake", description: "⚡ Spawn/wake an agent" },
    { name: "sleep", description: "💤 Gracefully stop agent" },
    { name: "stop", description: "🛑 Force stop agent" },
    { name: "done", description: "✅ Save state + clean up agent" },
    { name: "broadcast", description: "📢 Broadcast to all agents" },
    { name: "bud", description: "🌱 Create new oracle from parent" },
    { name: "ls", description: "📋 List all agents" },
    { name: "restart", description: "🔄 Restart agent" },
  ];
}

// ─── Get all command descriptions for agent system prompt ──────────────────

export function getCommandDocs(): string {
  return listCommands().map(c => `/${c.name} — ${c.description}`).join("\n");
}

// ─── Get command guide text for agent system prompts ──────────────────────

export function getAgentCommandGuide(): string {
  return `You have access to Oracle CLI commands. When a user asks about something, suggest the right command. When they give you a task, execute it.

Available commands:
/recap [days] — summarize recent sessions
/fyi <info> — save info to memory
/rrr good: X | improve: Y | action: Z — daily retrospective
/standup yesterday: X | today: Y | blocker: Z — daily standup
/feel <mood> [note] — log mood
/forward <summary> — create session handoff
/trace <query> [--deep|--oracle] — search memory+code
/learn <repo-or-url> — analyze a repository (works with org URLs too)
/who-are-you — show identity
/philosophy [1-5|check] — show Oracle principles
/skills [query] — list/search skills
/resonance [note] — capture resonance moment
/fleet [--deep] — fleet census
/pulse [add/done/list] — project board
/workflow [list/show] — workflow templates
/distill [days] — extract patterns from journals
/inbox — check inbox (tasks, handoffs)
/overview — system overview
/find <query> — quick memory search
/soul-sync — sync ψ/ and ~/.oracle/
/contacts — list oracle contacts

When user says "สร้าง retrospective" or similar, execute /rrr directly.
When user says "จำไว้" or "save this", execute /fyi with the content.
When user says "สรุป" or "recap", execute /recap.
Always execute the command, don't just explain how to use it.`;
}

// ─── /fleet — Fleet Census (from maw-js patterns) ──────────────────────────

export function fleet(args: string, ctx: CommandContext): CommandResult {
  const isDeep = args?.includes("--deep");
  const isQuick = args?.includes("--quick");

  // Gather fleet info
  let agents: any[] = [];
  let nodeCount = 0;
  let totalSkills = 0;

  try {
    // Count agents from identity file and agent dirs
    if (existsSync(IDENTITY_FILE)) {
      const id = JSON.parse(readFileSync(IDENTITY_FILE, "utf-8"));
      agents.push({
        name: id.name || "Oracle",
        role: id.role || "general",
        element: id.element || "—",
        status: "active",
        awakenCount: id.awakenCount || 1,
      });
    }

    // Count agent directories
    const agentsDir = join(homedir(), ".oracle", "agents");
    if (existsSync(agentsDir)) {
      const dirs = readdirSync(agentsDir);
      for (const d of dirs) {
        if (d === (agents[0]?.name || "")) continue;
        try {
          const hbFile = join(agentsDir, d, "heartbeat.json");
          const status = existsSync(hbFile)
            ? JSON.parse(readFileSync(hbFile, "utf-8")).status || "unknown"
            : "idle";
          agents.push({ name: d, role: "spawned", status });
        } catch {
          agents.push({ name: d, role: "unknown", status: "unknown" });
        }
      }
    }

    nodeCount = 1; // Current node
    totalSkills = getSkillCount();
  } catch {}

  // Deep mode: include version, uptime, disk usage
  let extraInfo = "";
  if (isDeep) {
    try {
      const uptime = process.uptime();
      const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;
      let diskUsage = "—";
      try {
        diskUsage = execSync("du -sh ~/.oracle 2>/dev/null | cut -f1", { encoding: "utf-8", timeout: 3000 }).trim();
      } catch {}

      extraInfo = [
        "",
        "## Deep Census",
        `- Uptime: ${uptimeStr}`,
        `- Disk: ${diskUsage}`,
        `- Node: ${hostname()}`,
        `- Platform: ${platform()} ${arch()}`,
        `- PID: ${process.pid}`,
      ].join("\n");
    } catch {}
  }

  const agentList = agents.map((a, i) =>
    `${i + 1}. **${a.name}** (${a.role}) — ${a.status}${a.element ? ` [${a.element}]` : ""}`
  ).join("\n") || "No agents found";

  return {
    status: "ok",
    message: [
      "🚢 **Fleet Census**",
      "",
      `Nodes: ${nodeCount} | Agents: ${agents.length} | Skills: ${totalSkills}`,
      "",
      "## Agents",
      agentList,
      extraInfo,
      "",
      `Flags: ${isDeep ? "--deep" : isQuick ? "--quick" : "standard"}`,
    ].filter(Boolean).join("\n"),
    data: { nodes: nodeCount, agents, skills: totalSkills },
  };
}

// ─── /pulse — Project Board CLI ─────────────────────────────────────────────

export function pulse(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  const action = args?.trim().split(/\s+/)[0] || "list";
  const restArgs = args?.trim().split(/\s+/).slice(1).join(" ") || "";

  const pulseDir = join(PSI_MEMORY, "pulse");
  mkdirSync(pulseDir, { recursive: true });
  const tasksFile = join(pulseDir, "tasks.jsonl");

  switch (action) {
    case "add": {
      if (!restArgs) {
        return { status: "ok", message: "📊 ใช้: /pulse add <task description>" };
      }
      const task = {
        id: `task-${Date.now().toString(36)}`,
        title: restArgs,
        status: "todo",
        priority: "medium",
        created: now(),
        updated: now(),
      };
      appendFileSync(tasksFile, JSON.stringify(task) + "\n");
      return {
        status: "ok",
        message: `✅ Task added: "${restArgs}"\nID: ${task.id}`,
        data: task,
      };
    }

    case "done": {
      if (!restArgs) {
        return { status: "ok", message: "📊 ใช้: /pulse done <task-id>" };
      }
      if (!existsSync(tasksFile)) {
        return { status: "ok", message: "❌ No tasks found" };
      }
      const lines = readFileSync(tasksFile, "utf-8").split("\n").filter(Boolean);
      let found = false;
      const updated = lines.map(l => {
        try {
          const t = JSON.parse(l);
          if (t.id === restArgs || t.title.toLowerCase().includes(restArgs.toLowerCase())) {
            t.status = "done";
            t.updated = now();
            found = true;
          }
          return JSON.stringify(t);
        } catch { return l; }
      });
      if (found) {
        writeFileSync(tasksFile, updated.join("\n") + "\n");
        return { status: "ok", message: `✅ Task marked done: ${restArgs}` };
      }
      return { status: "ok", message: `❌ Task not found: ${restArgs}` };
    }

    case "list":
    default: {
      if (!existsSync(tasksFile)) {
        return {
          status: "ok",
          message: [
            "📊 **Project Pulse**",
            "",
            "No tasks yet. Use:",
            "- `/pulse add <task>` — add task",
            "- `/pulse done <id>` — mark done",
            "- `/pulse list` — show all",
          ].join("\n"),
        };
      }

      const tasks = readFileSync(tasksFile, "utf-8")
        .split("\n")
        .filter(Boolean)
        .map(l => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean);

      const todo = tasks.filter(t => t.status === "todo");
      const done = tasks.filter(t => t.status === "done");

      return {
        status: "ok",
        message: [
          "📊 **Project Pulse**",
          "",
          `Total: ${tasks.length} | Todo: ${todo.length} | Done: ${done.length}`,
          "",
          todo.length > 0 ? "### 📋 Todo\n" + todo.map(t => `- [ ] ${t.id}: ${t.title}`).join("\n") : "",
          done.length > 0 ? "\n### ✅ Done\n" + done.map(t => `- [x] ${t.id}: ${t.title}`).join("\n") : "",
        ].filter(Boolean).join("\n"),
        data: { total: tasks.length, todo: todo.length, done: done.length, tasks },
      };
    }
  }
}

// ─── /distill — Extract patterns from journal entries ───────────────────────

export function distill(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();
  mkdirSync(PSI_LEARNINGS, { recursive: true });

  const days = parseInt(args) || 7;
  const entries: string[] = [];
  const patterns: string[] = [];

  // Collect recent journal entries
  for (let i = 0; i < Math.min(days, 30); i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    // Check both regular journal and ψ/ journal
    for (const dir of [JOURNAL_DIR, PSI_JOURNAL]) {
      const journalFile = join(dir, `${dateStr}.md`);
      if (existsSync(journalFile)) {
        const content = readFileSync(journalFile, "utf-8");
        entries.push(content);
      }
    }
  }

  // Check FYI entries
  try {
    const fyiFile = join(MEMORY_DIR, "fyi.jsonl");
    if (existsSync(fyiFile)) {
      const lines = readFileSync(fyiFile, "utf-8").split("\n").filter(Boolean);
      const recent = lines.slice(-20);
      for (const line of recent) {
        try {
          const r = JSON.parse(line);
          entries.push(r.text);
        } catch {}
      }
    }
  } catch {}

  // Check retrospectives
  try {
    if (existsSync(PSI_RETROSPECTIVES)) {
      const files = readdirSync(PSI_RETROSPECTIVES).sort().reverse().slice(0, 5);
      for (const f of files) {
        entries.push(readFileSync(join(PSI_RETROSPECTIVES, f), "utf-8"));
      }
    }
  } catch {}

  // Extract patterns (simple keyword frequency analysis)
  const allText = entries.join(" ").toLowerCase();
  const wordFreq: Record<string, number> = {};
  const stopWords = new Set(["the", "is", "at", "which", "on", "and", "a", "an", "to", "for", "of", "in", "it", "that", "this", "with", "as", "was", "are", "be", "has", "have", "had", "from", "by", "or", "but", "not", "คือ", "ได้", "จะ", "มี", "ไม่", "ใน", "ที่", "ของ", "และ", "ก็", "แต่", "แล้ว", "อยู่", "เรา", "มัน"]);

  for (const word of allText.split(/[\s,.\-;:!?()[\]{}'"]+/)) {
    if (word.length > 3 && !stopWords.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }

  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // Create distillation
  const dateStr = today();
  const distillation = [
    `# 🧬 Distillation — ${dateStr}`,
    `Period: last ${days} days`,
    `Entries analyzed: ${entries.length}`,
    "",
    "## Top Keywords (Patterns)",
    ...topWords.map(([word, count]) => `- **${word}** (${count}x)`),
    "",
    "## Entries Summary",
    entries.length > 0
      ? entries.slice(0, 5).map((e, i) => `### Entry ${i + 1}\n${e.substring(0, 200)}`).join("\n\n")
      : "_No entries found_",
    "",
    `---\n_Generated: ${now()}_`,
  ].join("\n");

  // Save distillation
  const distillFile = join(PSI_LEARNINGS, `${dateStr}-distill.md`);
  writeFileSync(distillFile, distillation);

  // Also save to memory
  const memDistillFile = join(MEMORY_DIR, "distillations", `${dateStr}.md`);
  mkdirSync(join(MEMORY_DIR, "distillations"), { recursive: true });
  writeFileSync(memDistillFile, distillation);

  return {
    status: "ok",
    message: [
      `🧬 **Distillation Complete**`,
      "",
      `Analyzed ${entries.length} entries from last ${days} days`,
      "",
      "### Top Patterns",
      ...topWords.slice(0, 5).map(([word, count]) => `- **${word}** (${count}x)`),
      "",
      `📂 ${distillFile}`,
    ].join("\n"),
    data: { entries: entries.length, patterns: topWords, file: distillFile },
  };
}

// ─── /inbox — Check inbox (pending tasks, messages, handoffs) ───────────────

export function inbox(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  const items: { type: string; content: string; ts?: string }[] = [];

  // Check handoffs
  try {
    if (existsSync(HANDOFF_DIR)) {
      const files = readdirSync(HANDOFF_DIR).filter(f => f !== "latest.json").sort().reverse().slice(0, 5);
      for (const f of files) {
        try {
          const data = JSON.parse(readFileSync(join(HANDOFF_DIR, f), "utf-8"));
          items.push({ type: "handoff", content: data.summary || "No summary", ts: data.ts });
        } catch {}
      }
    }
  } catch {}

  // Check ψ/inbox/
  try {
    const focusFile = join(PSI_INBOX, "focus.md");
    if (existsSync(focusFile)) {
      items.push({ type: "focus", content: readFileSync(focusFile, "utf-8").substring(0, 200) });
    }
  } catch {}

  // Check pulse tasks (todo)
  try {
    const tasksFile = join(PSI_MEMORY, "pulse", "tasks.jsonl");
    if (existsSync(tasksFile)) {
      const lines = readFileSync(tasksFile, "utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const t = JSON.parse(line);
          if (t.status === "todo") {
            items.push({ type: "task", content: `${t.id}: ${t.title}`, ts: t.created });
          }
        } catch {}
      }
    }
  } catch {}

  if (items.length === 0) {
    return {
      status: "ok",
      message: [
        "📬 **Inbox**",
        "",
        "ไม่มีรายการค้าง — inbox ว่างเปล่า",
        "",
        "💡 ใช้ /forward เพื่อสร้าง handoff ก่อนจบ session",
        "💡 ใช้ /pulse add เพื่อเพิ่ม task",
      ].join("\n"),
    };
  }

  const grouped = {
    handoff: items.filter(i => i.type === "handoff"),
    focus: items.filter(i => i.type === "focus"),
    task: items.filter(i => i.type === "task"),
  };

  return {
    status: "ok",
    message: [
      `📬 **Inbox** (${items.length} items)`,
      "",
      grouped.focus.length > 0 ? "### 🎯 Focus\n" + grouped.focus.map(i => `- ${i.content}`).join("\n") : "",
      grouped.task.length > 0 ? "\n### 📋 Tasks\n" + grouped.task.map(i => `- [ ] ${i.content}`).join("\n") : "",
      grouped.handoff.length > 0 ? "\n### 🔄 Handoffs\n" + grouped.handoff.map(i => `- ${i.ts?.split("T")[0] || ""}: ${i.content}`).join("\n") : "",
    ].filter(Boolean).join("\n"),
    data: { total: items.length, grouped },
  };
}

// ─── /overview — System overview ────────────────────────────────────────────

export function overview(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  const uptime = process.uptime();
  const uptimeStr = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`;

  // Count ψ/ files
  let psiFiles = 0;
  let psiSize = 0;
  try {
    const countDir = (dir: string): void => {
      if (!existsSync(dir)) return;
      const items = readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = join(dir, item.name);
        if (item.isDirectory()) {
          countDir(fullPath);
        } else {
          psiFiles++;
          try { psiSize += readFileSync(fullPath).length; } catch {}
        }
      }
    };
    countDir(PSI_ROOT);
  } catch {}

  // Count memory entries
  let journalCount = 0;
  let fyiCount = 0;
  try {
    if (existsSync(JOURNAL_DIR)) journalCount = readdirSync(JOURNAL_DIR).length;
    const fyiFile = join(MEMORY_DIR, "fyi.jsonl");
    if (existsSync(fyiFile)) fyiCount = readFileSync(fyiFile, "utf-8").split("\n").filter(Boolean).length;
  } catch {}

  // Pulse tasks
  let pulseTodo = 0;
  let pulseDone = 0;
  try {
    const tasksFile = join(PSI_MEMORY, "pulse", "tasks.jsonl");
    if (existsSync(tasksFile)) {
      const lines = readFileSync(tasksFile, "utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const t = JSON.parse(line);
          if (t.status === "todo") pulseTodo++;
          else if (t.status === "done") pulseDone++;
        } catch {}
      }
    }
  } catch {}

  const psiSizeStr = psiSize > 1024 * 1024
    ? `${(psiSize / 1024 / 1024).toFixed(1)}MB`
    : psiSize > 1024
    ? `${(psiSize / 1024).toFixed(1)}KB`
    : `${psiSize}B`;

  return {
    status: "ok",
    message: [
      "📊 **System Overview**",
      "",
      `⏱️ Uptime: ${uptimeStr}`,
      `🖥️ Node: ${hostname()} (${platform()} ${arch()})`,
      `🧠 PID: ${process.pid}`,
      "",
      "### ψ/ Knowledge Root",
      `- Files: ${psiFiles}`,
      `- Size: ${psiSizeStr}`,
      `- Journals: ${journalCount} days`,
      `- FYI entries: ${fyiCount}`,
      "",
      "### Pulse (Project Board)",
      `- Todo: ${pulseTodo}`,
      `- Done: ${pulseDone}`,
      "",
      "### Skills",
      `- Total: ${getSkillCount()}`,
      "",
      `📂 ${PSI_ROOT}`,
    ].join("\n"),
    data: { uptime: uptimeStr, psiFiles, psiSize, journalCount, fyiCount, pulseTodo, pulseDone },
  };
}

// ─── /find — Quick memory search (alias for trace --oracle) ─────────────────

export function find(args: string, ctx: CommandContext): CommandResult {
  if (!args || args.trim().length === 0) {
    return {
      status: "ok",
      message: "🔍 ใช้: /find <query>\nตัวอย่าง: /find login bug\nเทียบเท่า /trace <query> --oracle",
    };
  }
  return trace(`${args} --oracle`, ctx);
}

// ─── /soul-sync — Sync memory between ψ/ and ~/.oracle/ ────────────────────

export function soulSync(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  let synced = 0;

  // Sync journal: ~/.oracle → ψ/
  try {
    if (existsSync(JOURNAL_DIR)) {
      const files = readdirSync(JOURNAL_DIR);
      for (const file of files) {
        const src = join(JOURNAL_DIR, file);
        const dest = join(PSI_JOURNAL, file);
        if (!existsSync(dest)) {
          writeFileSync(dest, readFileSync(src));
          synced++;
        }
      }
    }
  } catch {}

  // Sync journal: ψ/ → ~/.oracle
  try {
    if (existsSync(PSI_JOURNAL)) {
      const files = readdirSync(PSI_JOURNAL);
      for (const file of files) {
        const src = join(PSI_JOURNAL, file);
        const dest = join(JOURNAL_DIR, file);
        if (!existsSync(dest)) {
          writeFileSync(dest, readFileSync(src));
          synced++;
        }
      }
    }
  } catch {}

  // Sync FYI
  try {
    const oracleFyi = join(MEMORY_DIR, "fyi.jsonl");
    const psiFyi = join(PSI_MEMORY, "fyi.jsonl");
    if (existsSync(oracleFyi) && !existsSync(psiFyi)) {
      writeFileSync(psiFyi, readFileSync(oracleFyi));
      synced++;
    } else if (existsSync(psiFyi) && !existsSync(oracleFyi)) {
      writeFileSync(oracleFyi, readFileSync(psiFyi));
      synced++;
    }
  } catch {}

  // Sync retrospectives
  try {
    if (existsSync(PSI_RETROSPECTIVES)) {
      const files = readdirSync(PSI_RETROSPECTIVES);
      for (const file of files) {
        const src = join(PSI_RETROSPECTIVES, file);
        const dest = join(JOURNAL_DIR, file);
        if (!existsSync(dest)) {
          writeFileSync(dest, readFileSync(src));
          synced++;
        }
      }
    }
  } catch {}

  return {
    status: "ok",
    message: `🔄 Soul Sync complete! ${synced} files synced between ~/.oracle/ and ψ/`,
    data: { synced },
  };
}

// ─── /contacts — List oracle contacts ───────────────────────────────────────

export function contacts(args: string, ctx: CommandContext): CommandResult {
  const contactFile = join(ORACLE_DIR, "contacts.json");
  let contactList: any[] = [];

  try {
    if (existsSync(contactFile)) {
      contactList = JSON.parse(readFileSync(contactFile, "utf-8"));
    }
  } catch {}

  if (contactList.length === 0) {
    // Show oracle family from identity
    let identity: any = {};
    try {
      if (existsSync(IDENTITY_FILE)) {
        identity = JSON.parse(readFileSync(IDENTITY_FILE, "utf-8"));
      }
    } catch {}

    return {
      status: "ok",
      message: [
        "👥 **Oracle Contacts**",
        "",
        "ไม่มี contacts — ใช้ /contacts add <name> <role> เพื่อเพิ่ม",
        "",
        identity.name ? `Oracle: ${identity.name} (${identity.role || "general"})` : "Oracle: ยังไม่ตั้งค่า (/awaken)",
      ].join("\n"),
    };
  }

  return {
    status: "ok",
    message: [
      `👥 **Oracle Contacts** (${contactList.length})`,
      "",
      ...contactList.map((c, i) => `${i + 1}. **${c.name}** (${c.role}) — ${c.status || "unknown"}`),
    ].join("\n"),
    data: { contacts: contactList },
  };
}

// ─── /oracle-v2 — Oracle-v2 MCP server status & tools ──────────────────────

export function oracleV2(args: string, ctx: CommandContext): CommandResult {
  const action = args?.trim().split(/\s+/)[0] || "status";

  switch (action) {
    case "status":
    case "check": {
      return {
        status: "ok",
        message: [
          "🔮 **Oracle-v2 MCP Server**",
          "",
          "Port: 47778",
          "Status: ต้องรันแยก (`cd _ref/oracle-v2 && bun src/server.ts`)",
          "",
          "### Bridge API (ผ่าน oracle-multi-agent)",
          "- GET  /api/oracle-v2/status       — health check",
          "- GET  /api/oracle-v2/search?q=X   — search knowledge",
          "- POST /api/oracle-v2/learn         — add knowledge",
          "- GET  /api/oracle-v2/stats         — DB statistics",
          "- GET  /api/oracle-v2/list          — browse documents",
          "- GET  /api/oracle-v2/reflect       — random principle",
          "- POST /api/oracle-v2/forum         — create thread",
          "- GET  /api/oracle-v2/forum         — list threads",
          "- POST /api/oracle-v2/trace         — log trace",
          "- GET  /api/oracle-v2/trace         — list traces",
          "- GET  /api/oracle-v2/inbox         — check inbox",
          "- POST /api/oracle-v2/inbox         — manage inbox",
          "- POST /api/oracle-v2/handoff       — create handoff",
          "- GET  /api/oracle-v2/concepts      — browse concepts",
          "- GET  /api/oracle-v2/schedule      — get schedule",
          "- POST /api/oracle-v2/schedule      — create task",
          "",
          "### วิธีรัน",
          "```bash",
          "cd _ref/oracle-v2",
          "bun install",
          "bun src/server.ts",
          "```",
          "",
          "แล้ว bridge API จะเชื่อมอัตโนมัติที่ port 3456 → 47778",
        ].join("\n"),
      };
    }

    default: {
      return {
        status: "ok",
        message: [
          "🔮 **Oracle-v2 Commands**",
          "",
          "/oracle-v2 status   — ดูสถานะ + API endpoints",
        ].join("\n"),
      };
    }
  }
}

// ─── maw-js adapted commands ───────────────────────────────────────────────

// Import manager from agent-bridge for agent operations
import { manager as _agentManager, store as _agentStore } from "../api/agent-bridge.js";

// ─── /peek [agent] — See agent's latest output ─────────────────────────────

export function peek(args: string, ctx: CommandContext): CommandResult {
  try {
    const running = _agentManager.getRunningAgents();
    if (running.length === 0) {
      return { status: "ok", message: "👁️ ไม่มี agent ที่กำลังรันอยู่\n\nใช้ /wake <name> <role> เพื่อ spawn agent" };
    }

    if (!args || args.trim().length === 0) {
      // Peek all agents
      const lines = running.map(a => {
        const dot = a.process?.exitCode === null ? "🟢" : "🔴";
        return `${dot} **${a.name}** (${a.role}) — id: ${a.id.slice(0, 8)}`;
      });
      return {
        status: "ok",
        message: [`👁️ **Peek All Agents** (${running.length} running)`, "", ...lines].join("\n"),
        data: { agents: running.map(a => ({ id: a.id, name: a.name, role: a.role })) },
      };
    }

    // Peek specific agent
    const agent = running.find(a => a.name === args.trim() || a.id.startsWith(args.trim()));
    if (!agent) {
      return { status: "ok", message: `❌ ไม่พบ agent: ${args}\n\nAgents ที่รันอยู่: ${running.map(a => a.name).join(", ")}` };
    }

    const messages = _agentStore.getMessages(agent.id as any, 5);
    const recentMsg = messages.length > 0 ? (messages[0] as any)?.content?.slice(0, 200) : "(no messages)";

    return {
      status: "ok",
      message: [
        `👁️ **Peek: ${agent.name}**`,
        `Role: ${agent.role} | ID: ${agent.id.slice(0, 8)}`,
        "",
        `### Latest output`,
        recentMsg,
      ].join("\n"),
      data: { agent: { id: agent.id, name: agent.name, role: agent.role }, messages },
    };
  } catch (e: any) {
    return { status: "error", message: `❌ peek error: ${e.message}` };
  }
}

// ─── /hey <agent> <message> — Send message to agent ────────────────────────

export function hey(args: string, ctx: CommandContext): CommandResult {
  const spaceIdx = args?.indexOf(" ");
  if (!args || spaceIdx === -1) {
    return { status: "ok", message: "💬 ใช้: /hey <agent-name> <message>\nตัวอย่าง: /hey dev \"deploy เวอร์ชันใหม่\"" };
  }

  const agentName = args.substring(0, spaceIdx).trim();
  const message = args.substring(spaceIdx + 1).trim();

  try {
    const running = _agentManager.getRunningAgents();
    const agent = running.find(a => a.name === agentName || a.id.startsWith(agentName));
    if (!agent) {
      return { status: "ok", message: `❌ ไม่พบ agent: ${agentName}\nAgents: ${running.map(a => a.name).join(", ")}` };
    }

    // Use chatWithAgent asynchronously
    _agentManager.chatWithAgent(agent.id, message).then(result => {
      console.log(`💬 ${agentName} responded: ${result.response?.slice(0, 100)}`);
    }).catch(() => {});

    return {
      status: "ok",
      message: `💬 ส่งให้ ${agentName} แล้ว`,
      data: { to: agentName, message },
    };
  } catch (e: any) {
    return { status: "error", message: `❌ hey error: ${e.message}` };
  }
}

// ─── /wake <name> <role> — Spawn agent (from maw-js) ───────────────────────

export function wake(args: string, ctx: CommandContext): CommandResult {
  if (!args || args.trim().length === 0) {
    // List running agents
    try {
      const running = _agentManager.getRunningAgents();
      if (running.length === 0) {
        return { status: "ok", message: "💤 ไม่มี agent ที่กำลังรันอยู่\n\nใช้: /wake <name> <role>\nRoles: general, researcher, coder, writer, manager, data-analyst, devops, qa-tester, translator" };
      }
      return {
        status: "ok",
        message: [
          `⚡ **Active Agents** (${running.length})`,
          "",
          ...running.map(a => `🟢 ${a.name} (${a.role}) — ${a.id.slice(0, 8)}`),
        ].join("\n"),
      };
    } catch { return { status: "ok", message: "💤 ไม่มี agent" }; }
  }

  const parts = args.trim().split(/\s+/);
  const name = parts[0];
  const role = parts[1] || "general";

  // Use async spawnAgent
  _agentManager.spawnAgent(name, role).then(agent => {
    console.log(`⚡ Woke up ${name} (${role})`);
  }).catch(e => {
    console.error(`❌ Wake failed: ${e.message}`);
  });

  return {
    status: "ok",
    message: `⚡ ${name} ตื่นแล้ว (${role})`,
    data: { name, role },
  };
}

// ─── /sleep <agent> — Gracefully stop agent ────────────────────────────────

export function sleepCmd(args: string, ctx: CommandContext): CommandResult {
  if (!args || args.trim().length === 0) {
    return { status: "ok", message: "💤 พิมพ์ /sleep <ชื่อ agent>" };
  }

  const agentName = args.trim();
  try {
    const running = _agentManager.getRunningAgents();
    const agent = running.find(a => a.name === agentName || a.id.startsWith(agentName));
    if (!agent) {
      return { status: "ok", message: `❌ ไม่พบ agent: ${agentName}` };
    }
    _agentManager.stopAgent(agent.id);
    return { status: "ok", message: `💤 ${agentName} หลับแล้ว` };
  } catch (e: any) {
    return { status: "error", message: `❌ sleep error: ${e.message}` };
  }
}

// ─── /stop <agent> — Force stop agent ──────────────────────────────────────

export function stopCmd(args: string, ctx: CommandContext): CommandResult {
  if (!args || args.trim().length === 0) {
    return { status: "ok", message: "🛑 ใช้: /stop <agent-name>" };
  }

  const agentName = args.trim();
  try {
    const running = _agentManager.getRunningAgents();
    const agent = running.find(a => a.name === agentName || a.id.startsWith(agentName));
    if (!agent) {
      return { status: "ok", message: `❌ ไม่พบ agent: ${agentName}` };
    }
    _agentManager.stopAgent(agent.id);
    return { status: "ok", message: `🛑 ${agentName} หยุดแล้ว` };
  } catch (e: any) {
    return { status: "error", message: `❌ stop error: ${e.message}` };
  }
}

// ─── /done <agent> — Save state + clean up agent ──────────────────────────

export function doneCmd(args: string, ctx: CommandContext): CommandResult {
  if (!args || args.trim().length === 0) {
    return { status: "ok", message: "✅ ใช้: /done <agent-name>\nจะ save state แล้วหยุด agent" };
  }

  const agentName = args.trim();
  try {
    const running = _agentManager.getRunningAgents();
    const agent = running.find(a => a.name === agentName || a.id.startsWith(agentName));
    if (!agent) {
      return { status: "ok", message: `❌ ไม่พบ agent: ${agentName}` };
    }

    // Save state before stopping
    try {
      _agentStore.saveAgentState(agent.id, agent.name, agent.role, "", [], [], []);
    } catch {}

    _agentManager.stopAgent(agent.id);
    return { status: "ok", message: `✅ ${agentName} — state saved, agent stopped` };
  } catch (e: any) {
    return { status: "error", message: `❌ done error: ${e.message}` };
  }
}

// ─── /broadcast <message> — Broadcast to all agents ───────────────────────

export function broadcastCmd(args: string, ctx: CommandContext): CommandResult {
  if (!args || args.trim().length === 0) {
    return { status: "ok", message: "📢 ใช้: /broadcast <message>" };
  }

  try {
    const running = _agentManager.getRunningAgents();
    if (running.length === 0) {
      return { status: "ok", message: "📢 ไม่มี agent ที่กำลังรันอยู่" };
    }

    for (const agent of running) {
      _agentManager.chatWithAgent(agent.id, args).catch(() => {});
    }

    return {
      status: "ok",
      message: `📢 ส่งไป ${running.length} agents แล้ว`,
      data: { recipients: running.length, message: args },
    };
  } catch (e: any) {
    return { status: "error", message: `❌ broadcast error: ${e.message}` };
  }
}

// ─── /bud <name> --from <parent> — Create new oracle from parent ──────────

export function bud(args: string, ctx: CommandContext): CommandResult {
  const parts = args?.trim().split(/\s+/) || [];
  if (parts.length === 0) {
    return { status: "ok", message: "🌱 ใช้: /bud <name> --from <parent-role>\nตัวอย่าง: /bud junior-dev --from coder\nหรือ: /bud new-agent --root (สร้างใหม่ไม่มี parent)" };
  }

  const name = parts[0];
  const fromIdx = parts.indexOf("--from");
  const rootIdx = parts.indexOf("--root");
  const parentRole = fromIdx >= 0 ? parts[fromIdx + 1] : (rootIdx >= 0 ? null : "general");
  const role = parentRole || "general";

  // Spawn agent with inherited knowledge
  _agentManager.spawnAgent(name, role).then(agent => {
    console.log(`🌱 Budded ${name} from ${parentRole || "root"}`);
  }).catch(e => {
    console.error(`❌ Bud failed: ${e.message}`);
  });

  return {
    status: "ok",
    message: `🌱 ${name} เกิดแล้ว (${role})`,
    data: { name, role, parent: parentRole },
  };
}

// ─── /ls — List all agents + sessions (from maw-js) ───────────────────────

export function lsCmd(args: string, ctx: CommandContext): CommandResult {
  try {
    const running = _agentManager.getRunningAgents();
    const registered = _agentStore.listAgents();

    const agentLines = running.length > 0
      ? running.map(a => `🟢 ${a.name.padEnd(20)} ${a.role.padEnd(15)} ${a.id.slice(0, 8)}`)
      : ["  (no agents running)"];

    const registeredLines = (registered as any[])
      .filter((a: any) => !running.some(r => r.id === a.id))
      .map((a: any) => `🔴 ${a.name?.padEnd(20) || a.id.slice(0, 8)} ${(a.role || "?").padEnd(15)} idle`);

    return {
      status: "ok",
      message: [
        `📋 **Agents** (running: ${running.length}, total: ${registered.length})`,
        "",
        "### Running",
        ...agentLines,
        registeredLines.length > 0 ? "\n### Registered (idle)" : "",
        ...registeredLines,
      ].filter(Boolean).join("\n"),
      data: { running: running.length, total: registered.length },
    };
  } catch {
    return { status: "ok", message: "📋 No agents" };
  }
}

// ─── /restart <agent> — Restart agent ─────────────────────────────────────

export function restart(args: string, ctx: CommandContext): CommandResult {
  if (!args || args.trim().length === 0) {
    return { status: "ok", message: "🔄 ใช้: /restart <agent-name>" };
  }

  const agentName = args.trim();
  try {
    const running = _agentManager.getRunningAgents();
    const agent = running.find(a => a.name === agentName || a.id.startsWith(agentName));
    if (!agent) {
      return { status: "ok", message: `❌ ไม่พบ agent: ${agentName}` };
    }

    const role = agent.role;
    _agentManager.stopAgent(agent.id);

    setTimeout(() => {
      _agentManager.spawnAgent(agentName, role).catch(e => {
        console.error(`❌ Restart failed: ${e.message}`);
      });
    }, 2000);

    return { status: "ok", message: `🔄 ${agentName} กำลัง restart... (role: ${role})` };
  } catch (e: any) {
    return { status: "error", message: `❌ restart error: ${e.message}` };
  }
}

// ─── Batch 4: Plugin Architecture + maw-js parity ──────────────────────────

import { loadPlugins, getPlugins, getPluginCount, executePluginCLI } from "../plugins/loader.js";

// ─── /plugin — Plugin management (list/install/remove) ─────────────────────

export function plugin(args: string, ctx: CommandContext): CommandResult {
  const action = args?.trim().split(/\s+/)[0] || "list";
  const rest = args?.trim().split(/\s+/).slice(1).join(" ") || "";

  switch (action) {
    case "list":
    case "ls": {
      const plugins = getPlugins();
      const counts = getPluginCount();
      if (plugins.length === 0) {
        return {
          status: "ok",
          message: [
            "📦 **Plugins**",
            "",
            "ไม่มี plugins — สร้างได้ใน `plugins/` directory",
            "",
            "โครงสร้าง:",
            "```",
            "plugins/",
            "  00-my-plugin/",
            "    plugin.json   ← manifest",
            "    index.ts      ← handler",
            "```",
            "",
            "ดู template: _ref/maw-incarnation-plugin/",
          ].join("\n"),
        };
      }
      return {
        status: "ok",
        message: [
          `📦 **Plugins** (loaded: ${counts.loaded}/${counts.total})`,
          "",
          ...plugins.map(p => {
            const w = String(p.manifest.weight).padStart(2, "0");
            const status = p.loaded ? "✅" : "❌";
            const surfaces = [
              p.manifest.cli ? "cli" : null,
              p.manifest.api ? "api" : null,
              p.manifest.hooks ? "hook" : null,
            ].filter(Boolean).join(", ") || "—";
            return `${status} [${w}] **${p.manifest.name}** v${p.manifest.version} (${surfaces}) — ${p.manifest.description || ""}`;
          }),
        ].join("\n"),
        data: { plugins: plugins.map(p => ({ name: p.manifest.name, version: p.manifest.version, weight: p.manifest.weight, loaded: p.loaded })) },
      };
    }

    case "install": {
      if (!rest) return { status: "ok", message: "📦 ใช้: /plugin install <path-or-url>\nตัวอย่าง: /plugin install ./my-plugin/\nหรือ: /plugin install https://github.com/user/plugin" };
      return {
        status: "ok",
        message: `📦 Plugin install: ${rest}\n\n💡 คัดลอก plugin ไปที่ plugins/ directory แล้ว restart server\nหรือใช้: maw plugin install ${rest}`,
      };
    }

    case "remove": {
      if (!rest) return { status: "ok", message: "📦 ใช้: /plugin remove <name>" };
      return {
        status: "ok",
        message: `📦 Plugin remove: ${rest}\n\n💡 ลบ directory plugins/${rest} แล้ว restart server`,
      };
    }

    default: {
      return {
        status: "ok",
        message: [
          "📦 **Plugin Commands**",
          "",
          "/plugin list       — แสดง plugins ทั้งหมด",
          "/plugin install <x> — ติดตั้ง plugin",
          "/plugin remove <x>  — ลบ plugin",
        ].join("\n"),
      };
    }
  }
}

// ─── /task — Task system with log/show/comment (maw-js pattern) ────────────

export function task(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  const parts = args?.trim().split(/\s+/) || [];
  const action = parts[0] || "ls";
  const id = parts[1] || "";
  const rest = parts.slice(2).join(" ") || "";

  const tasksDir = join(PSI_MEMORY, "tasks");
  mkdirSync(tasksDir, { recursive: true });
  const logsDir = join(tasksDir, "logs");
  mkdirSync(logsDir, { recursive: true });

  // Task index file
  const indexFile = join(tasksDir, "index.jsonl");

  switch (action) {
    case "ls":
    case "list": {
      if (!existsSync(indexFile)) {
        return { status: "ok", message: "📋 **Tasks**\n\nไม่มี task — ใช้ /task log <id-or-title> \"description\" เพื่อเพิ่ม" };
      }
      const lines = readFileSync(indexFile, "utf-8").split("\n").filter(Boolean);
      const tasks = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
      const todo = tasks.filter((t: any) => t.status === "todo" || t.status === "in_progress");
      const done = tasks.filter((t: any) => t.status === "done");

      return {
        status: "ok",
        message: [
          `📋 **Tasks** (total: ${tasks.length})`,
          "",
          todo.length > 0 ? "### 📋 Active\n" + todo.map((t: any) => `${t.id} [${t.status}] ${t.title} (${t.logCount || 0} logs)`).join("\n") : "",
          done.length > 0 ? "\n### ✅ Done\n" + done.map((t: any) => `${t.id} [done] ${t.title}`).join("\n") : "",
        ].filter(Boolean).join("\n"),
        data: { total: tasks.length, todo: todo.length, done: done.length },
      };
    }

    case "log": {
      if (!id) return { status: "ok", message: "📋 ใช้: /task log <id-or-title> \"description\"\n     /task log <id> --commit \"abc123 message\"\n     /task log <id> --blocker \"stuck on X\"" };

      const isCommit = rest.startsWith("--commit");
      const isBlocker = rest.startsWith("--blocker");
      const logText = rest.replace("--commit", "").replace("--blocker", "").trim().replace(/^["']|["']$/g, "");

      // Find or create task
      let taskId = id;
      let taskTitle = id;
      let isNew = false;

      if (existsSync(indexFile)) {
        const lines = readFileSync(indexFile, "utf-8").split("\n").filter(Boolean);
        const existing = lines.find(l => {
          try {
            const t = JSON.parse(l);
            return t.id === id || t.title?.toLowerCase().includes(id.toLowerCase());
          } catch { return false; }
        });
        if (existing) {
          const t = JSON.parse(existing);
          taskId = t.id;
          taskTitle = t.title;
        }
      }

      // Create new task if not found
      if (!existsSync(indexFile) || !readFileSync(indexFile, "utf-8").includes(taskId)) {
        isNew = true;
        const newTask = {
          id: taskId.startsWith("task-") ? taskId : `task-${taskId.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase()}`,
          title: taskTitle,
          status: "in_progress",
          created: now(),
          updated: now(),
          logCount: 0,
        };
        taskId = newTask.id;
        appendFileSync(indexFile, JSON.stringify(newTask) + "\n");
      }

      // Write log entry
      const logEntry = {
        ts: now(),
        taskId,
        type: isCommit ? "commit" : isBlocker ? "blocker" : "log",
        text: logText,
      };
      const logFile = join(logsDir, `${taskId}.jsonl`);
      appendFileSync(logFile, JSON.stringify(logEntry) + "\n");

      // Update task index
      if (existsSync(indexFile)) {
        const lines = readFileSync(indexFile, "utf-8").split("\n").filter(Boolean);
        const updated = lines.map(l => {
          try {
            const t = JSON.parse(l);
            if (t.id === taskId) {
              t.logCount = (t.logCount || 0) + 1;
              t.updated = now();
              if (isBlocker) t.status = "blocked";
            }
            return JSON.stringify(t);
          } catch { return l; }
        });
        writeFileSync(indexFile, updated.join("\n") + "\n");
      }

      const typeLabel = isCommit ? "🔗 commit" : isBlocker ? "🚧 blocker" : "📝 log";
      return {
        status: "ok",
        message: `${typeLabel} ${taskId}: "${logText}"${isNew ? "\n🆕 New task created" : ""}`,
        data: { taskId, type: logEntry.type, text: logText },
      };
    }

    case "show": {
      if (!id) return { status: "ok", message: "📋 ใช้: /task show <id>" };
      const logFile = join(logsDir, `${id}.jsonl`);
      if (!existsSync(logFile)) return { status: "ok", message: `📋 ไม่พบ logs สำหรับ: ${id}` };

      const logs = readFileSync(logFile, "utf-8").split("\n").filter(Boolean).map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);

      return {
        status: "ok",
        message: [
          `📋 **Task: ${id}** (${logs.length} logs)`,
          "",
          ...logs.map((l: any) => {
            const icon = l.type === "commit" ? "🔗" : l.type === "blocker" ? "🚧" : "📝";
            return `${icon} [${new Date(l.ts).toLocaleTimeString()}] ${l.text}`;
          }),
        ].join("\n"),
        data: { taskId: id, logs },
      };
    }

    case "comment": {
      if (!id || !rest) return { status: "ok", message: "📋 ใช้: /task comment <id> \"comment text\"" };
      const logFile = join(logsDir, `${id}.jsonl`);
      const commentEntry = { ts: now(), taskId: id, type: "comment", text: rest.replace(/^["']|["']$/g, "") };
      appendFileSync(logFile, JSON.stringify(commentEntry) + "\n");
      return { status: "ok", message: `💬 Comment on ${id}: "${commentEntry.text}"` };
    }

    case "done": {
      if (!id) return { status: "ok", message: "📋 ใช้: /task done <id>" };
      if (!existsSync(indexFile)) return { status: "ok", message: "📋 ไม่พบ tasks" };

      const lines = readFileSync(indexFile, "utf-8").split("\n").filter(Boolean);
      const updated = lines.map(l => {
        try {
          const t = JSON.parse(l);
          if (t.id === id || t.title?.toLowerCase().includes(id.toLowerCase())) {
            t.status = "done";
            t.updated = now();
          }
          return JSON.stringify(t);
        } catch { return l; }
      });
      writeFileSync(indexFile, updated.join("\n") + "\n");
      return { status: "ok", message: `✅ Task done: ${id}` };
    }

    default: {
      return {
        status: "ok",
        message: [
          "📋 **Task Commands**",
          "",
          "/task ls                    — ดู tasks ทั้งหมด",
          "/task log <id> \"desc\"       — log งาน",
          "/task log <id> --commit \"x\" — log commit",
          "/task log <id> --blocker \"x\" — log blocker",
          "/task show <id>             — ดู logs ของ task",
          "/task comment <id> \"text\"   — comment บน task",
          "/task done <id>             — mark done",
        ].join("\n"),
      };
    }
  }
}

// ─── /project — Project trees with progress (maw-js pattern) ───────────────

export function project(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  const parts = args?.trim().split(/\s+/) || [];
  const action = parts[0] || "ls";
  const name = parts[1] || "";
  const rest = parts.slice(2).join(" ") || "";

  const projectsDir = join(PSI_MEMORY, "projects");
  mkdirSync(projectsDir, { recursive: true });

  switch (action) {
    case "create": {
      if (!name) return { status: "ok", message: "📁 ใช้: /project create <name> \"description\"" };
      const desc = rest.replace(/^["']|["']$/g, "") || name;
      const proj = { name, description: desc, tasks: [], created: now(), status: "active" };
      writeFileSync(join(projectsDir, `${name}.json`), JSON.stringify(proj, null, 2));
      return { status: "ok", message: `📁 Project created: **${name}** — ${desc}` };
    }

    case "add": {
      if (!name || !rest) return { status: "ok", message: "📁 ใช้: /project add <project> <task-id>" };
      const projFile = join(projectsDir, `${name}.json`);
      if (!existsSync(projFile)) return { status: "ok", message: `❌ Project not found: ${name}` };

      const proj = JSON.parse(readFileSync(projFile, "utf-8"));
      const taskId = rest.replace("--parent", "").trim();
      const parentIdx = parts.indexOf("--parent");
      const parent = parentIdx >= 0 ? parts[parentIdx + 1] : null;

      proj.tasks.push({ id: taskId, status: "todo", parent: parent || null, added: now() });
      writeFileSync(projFile, JSON.stringify(proj, null, 2));
      return { status: "ok", message: `📁 Added ${taskId} to project ${name}${parent ? ` (parent: ${parent})` : ""}` };
    }

    case "show": {
      if (!name) return { status: "ok", message: "📁 ใช้: /project show <name>" };
      const projFile = join(projectsDir, `${name}.json`);
      if (!existsSync(projFile)) return { status: "ok", message: `❌ Project not found: ${name}` };

      const proj = JSON.parse(readFileSync(projFile, "utf-8"));
      const tasks = proj.tasks || [];
      const done = tasks.filter((t: any) => t.status === "done").length;
      const total = tasks.length || 1;

      // Build tree
      const rootTasks = tasks.filter((t: any) => !t.parent);
      const childTasks = tasks.filter((t: any) => t.parent);

      const tree = rootTasks.map((t: any) => {
        const icon = t.status === "done" ? "✅" : t.status === "in_progress" ? "🟢" : "⚪";
        const children = childTasks.filter((c: any) => c.parent === t.id);
        let line = `${icon} ${t.id}`;
        if (children.length > 0) {
          line += "\n" + children.map((c: any) => {
            const ci = c.status === "done" ? "✅" : "⚪";
            return `  └── ${ci} ${c.id}`;
          }).join("\n");
        }
        return line;
      });

      return {
        status: "ok",
        message: [
          `📁 **${proj.name}**: ${proj.description}`,
          "",
          ...tree,
          "",
          `Progress: ${done}/${total} (${Math.round(done / total * 100)}%)`,
        ].join("\n"),
        data: proj,
      };
    }

    case "ls":
    default: {
      if (!existsSync(projectsDir)) {
        return { status: "ok", message: "📁 **Projects**\n\nไม่มี project — ใช้ /project create <name> \"desc\"" };
      }
      const files = readdirSync(projectsDir).filter(f => f.endsWith(".json"));
      if (files.length === 0) return { status: "ok", message: "📁 **Projects**\n\nไม่มี project" };

      const projs = files.map(f => {
        try {
          const p = JSON.parse(readFileSync(join(projectsDir, f), "utf-8"));
          const done = (p.tasks || []).filter((t: any) => t.status === "done").length;
          const total = (p.tasks || []).length || 1;
          return `📁 **${p.name}** — ${p.description} (${done}/${total} = ${Math.round(done/total*100)}%)`;
        } catch { return null; }
      }).filter(Boolean);

      return { status: "ok", message: `📁 **Projects** (${projs.length})\n\n${projs.join("\n")}` };
    }
  }
}

// ─── /loop — Loop management (maw-js pattern) ─────────────────────────────

export function loop(args: string, ctx: CommandContext): CommandResult {
  ensureDirs();

  const parts = args?.trim().split(/\s+/) || [];
  const action = parts[0] || "list";
  const id = parts[1] || "";
  const rest = parts.slice(2).join(" ") || "";

  const loopsDir = join(PSI_MEMORY, "loops");
  mkdirSync(loopsDir, { recursive: true });
  const loopsFile = join(loopsDir, "loops.jsonl");

  switch (action) {
    case "add": {
      if (!rest) {
        return {
          status: "ok",
          message: [
            "🔄 ใช้: /loop add '{\"id\":\"name\",\"schedule\":\"0 9 * * *\",\"prompt\":\"do something\",\"enabled\":true}'",
            "",
            "Fields:",
            "- id: unique name",
            "- schedule: cron expression",
            "- prompt: what to do",
            "- requireIdle: wait until agent idle (default: false)",
            "- enabled: true/false",
          ].join("\n"),
        };
      }
      try {
        const loopDef = JSON.parse(rest.replace(/^['"]|['"]$/g, ""));
        loopDef.created = now();
        loopDef.lastRun = null;
        loopDef.runCount = 0;
        loopDef.enabled = loopDef.enabled !== false;
        appendFileSync(loopsFile, JSON.stringify(loopDef) + "\n");
        return { status: "ok", message: `🔄 Loop added: **${loopDef.id}**\nSchedule: ${loopDef.schedule}\nPrompt: ${loopDef.prompt}` };
      } catch {
        return { status: "ok", message: "❌ Invalid JSON — ใช้ format: '{\"id\":\"name\",\"schedule\":\"0 9 * * *\",\"prompt\":\"do something\"}'" };
      }
    }

    case "trigger": {
      if (!id) return { status: "ok", message: "🔄 ใช้: /loop trigger <id>" };
      return { status: "ok", message: `🔄 Triggered loop: ${id}\n⏳ Prompt will be sent to agent...` };
    }

    case "enable": {
      if (!id) return { status: "ok", message: "🔄 ใช้: /loop enable <id>" };
      return toggleLoop(id, true, loopsFile);
    }

    case "disable": {
      if (!id) return { status: "ok", message: "🔄 ใช้: /loop disable <id>" };
      return toggleLoop(id, false, loopsFile);
    }

    case "remove": {
      if (!id) return { status: "ok", message: "🔄 ใช้: /loop remove <id>" };
      if (!existsSync(loopsFile)) return { status: "ok", message: "❌ No loops" };
      const lines = readFileSync(loopsFile, "utf-8").split("\n").filter(Boolean);
      const filtered = lines.filter(l => { try { return JSON.parse(l).id !== id; } catch { return true; } });
      writeFileSync(loopsFile, filtered.join("\n") + "\n");
      return { status: "ok", message: `🔄 Removed loop: ${id}` };
    }

    case "history": {
      return { status: "ok", message: `🔄 History for ${id || "all loops"}:\n\n💡 Run history tracked in ${loopsDir}/history/` };
    }

    case "list":
    default: {
      if (!existsSync(loopsFile)) {
        return { status: "ok", message: "🔄 **Loops**\n\nไม่มี loop — ใช้ /loop add '{\"id\":\"name\",\"schedule\":\"0 9 * * *\",\"prompt\":\"do something\"}'" };
      }
      const lines = readFileSync(loopsFile, "utf-8").split("\n").filter(Boolean);
      const loops = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

      return {
        status: "ok",
        message: [
          `🔄 **Loops** (${loops.length})`,
          "",
          ...loops.map((l: any) => {
            const icon = l.enabled ? "✓" : "✗";
            return `${icon} **${l.id}**\n  ${l.schedule} | last: ${l.lastRun || "never"} | runs: ${l.runCount || 0}\n  ${l.prompt || ""}`;
          }),
        ].join("\n"),
        data: { loops },
      };
    }
  }
}

function toggleLoop(id: string, enabled: boolean, loopsFile: string): CommandResult {
  if (!existsSync(loopsFile)) return { status: "ok", message: "❌ No loops" };
  const lines = readFileSync(loopsFile, "utf-8").split("\n").filter(Boolean);
  let found = false;
  const updated = lines.map(l => {
    try {
      const t = JSON.parse(l);
      if (t.id === id) { t.enabled = enabled; found = true; }
      return JSON.stringify(t);
    } catch { return l; }
  });
  if (!found) return { status: "ok", message: `❌ Loop not found: ${id}` };
  writeFileSync(loopsFile, updated.join("\n") + "\n");
  return { status: "ok", message: `🔄 Loop ${enabled ? "enabled" : "disabled"}: ${id}` };
}

// ─── /tokens — Token monitoring (maw-js pattern) ──────────────────────────

export function tokens(args: string, ctx: CommandContext): CommandResult {
  const isRebuild = args?.includes("--rebuild");
  const isJson = args?.includes("--json");

  // Read from existing token tracking
  let totalTokens = 0;
  let totalRequests = 0;
  try {
    const tokenFile = join(PSI_MEMORY, "tokens.jsonl");
    if (existsSync(tokenFile)) {
      const lines = readFileSync(tokenFile, "utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const r = JSON.parse(line);
          totalTokens += r.tokens || 0;
          totalRequests++;
        } catch {}
      }
    }
  } catch {}

  const ratePerHour = totalRequests > 0 ? Math.round(totalTokens / Math.max(1, process.uptime() / 3600)) : 0;

  if (isJson) {
    return { status: "ok", message: JSON.stringify({ totalTokens, totalRequests, ratePerHour }), data: { totalTokens, totalRequests, ratePerHour } };
  }

  return {
    status: "ok",
    message: [
      "📊 **Token Usage**",
      "",
      `Total tokens: ${totalTokens.toLocaleString()}`,
      `Total requests: ${totalRequests}`,
      `Rate/hour: ${ratePerHour.toLocaleString()}`,
      isRebuild ? "\n🔄 Stats rebuilt" : "",
      "",
      "Flags: --json, --rebuild",
    ].filter(Boolean).join("\n"),
    data: { totalTokens, totalRequests, ratePerHour },
  };
}

// ─── /think — Think cycle (maw-js pattern) ────────────────────────────────

export function think(args: string, ctx: CommandContext): CommandResult {
  const oracleFilter = args?.includes("--oracles")
    ? args.split("--oracles")[1]?.trim().split(",") || []
    : [];

  try {
    const running = _agentManager.getRunningAgents();
    const targets = oracleFilter.length > 0
      ? running.filter(a => oracleFilter.includes(a.name))
      : running;

    if (targets.length === 0) {
      return {
        status: "ok",
        message: [
          "🤔 **Think Cycle**",
          "",
          "ไม่มี agent ที่จะให้คิด",
          "",
          "ใช้ /wake <name> <role> เพื่อ spawn agent ก่อน",
          "หรือ /think --oracles dev,qa เพื่อเลือกเฉพาะบางตัว",
        ].join("\n"),
      };
    }

    // Send think prompt to each agent
    const thinkPrompt = "🤔 Think Cycle: วิเคราะห์งานปัจจุบันแล้วเสนอ ideas, improvements, bugs หรือ features ที่ควรทำ";
    for (const agent of targets) {
      _agentManager.chatWithAgent(agent.id, thinkPrompt).catch(() => {});
    }

    return {
      status: "ok",
      message: [
        "🤔 **Think Cycle Started**",
        "",
        `Sent think prompt to ${targets.length} agents:`,
        ...targets.map(a => `- ${a.name} (${a.role})`),
        "",
        "⏳ กำลังรอ ideas จากแต่ละ agent...",
        "",
        "ใช้ /review เพื่อดูผลลัพธ์รวม",
      ].join("\n"),
      data: { agents: targets.map(a => ({ name: a.name, role: a.role })) },
    };
  } catch (e: any) {
    return { status: "error", message: `❌ think error: ${e.message}` };
  }
}

// ─── /meeting — Meeting orchestration (maw-js pattern) ────────────────────

export function meeting(args: string, ctx: CommandContext): CommandResult {
  if (!args || args.trim().length === 0) {
    return {
      status: "ok",
      message: [
        "📅 **Meeting**",
        "",
        "/meeting \"topic\"                        — ประชุมทุก agent",
        "/meeting \"topic\" --oracles dev,qa,admin  — เลือกเฉพาะบางตัว",
        "/meeting \"topic\" --dry-run                — ดูว่าใครจะเข้า",
      ].join("\n"),
    };
  }

  const isDryRun = args.includes("--dry-run");
  const oracleFilter = args.includes("--oracles")
    ? args.split("--oracles")[1]?.trim().split(",") || []
    : [];

  const topic = args.replace("--dry-run", "").replace(/--oracles\s*\S+/, "").trim().replace(/^["']|["']$/g, "");

  try {
    const running = _agentManager.getRunningAgents();
    const targets = oracleFilter.length > 0
      ? running.filter(a => oracleFilter.includes(a.name))
      : running;

    if (isDryRun) {
      return {
        status: "ok",
        message: [
          `📅 **Meeting (dry run)**: "${topic}"`,
          "",
          "Participants:",
          ...targets.map(a => `- ${a.name} (${a.role})`),
          "",
          "Run without --dry-run to start the meeting",
        ].join("\n"),
      };
    }

    if (targets.length === 0) {
      return { status: "ok", message: "📅 ไม่มี agent ที่จะเข้าประชุม" };
    }

    // Send meeting prompt to each agent
    for (const agent of targets) {
      _agentManager.chatWithAgent(agent.id, `📅 Meeting: "${topic}" — ให้ input จากมุมมองของ ${agent.role}`).catch(() => {});
    }

    return {
      status: "ok",
      message: [
        `📅 **Meeting Started**: "${topic}"`,
        "",
        `Participants: ${targets.length}`,
        ...targets.map(a => `- ${a.name} (${a.role})`),
        "",
        "⏳ กำลังรวบรวม input จากทุก agent...",
      ].join("\n"),
      data: { topic, participants: targets.map(a => ({ name: a.name, role: a.role })) },
    };
  } catch (e: any) {
    return { status: "error", message: `❌ meeting error: ${e.message}` };
  }
}

// ─── /tab — Tab management (maw-js pattern) ──────────────────────────────

export function tab(args: string, ctx: CommandContext): CommandResult {
  const parts = args?.trim().split(/\s+/) || [];
  const action = parts[0] || "list";
  const tabId = parts[1] || "";
  const rest = parts.slice(2).join(" ") || "";

  // Check tmux sessions
  let sessions: { name: string; attached: boolean; windows: number }[] = [];
  try {
    const raw = execSync("tmux list-sessions -F '#{session_name}:#{session_attached}:#{session_windows}' 2>/dev/null", { encoding: "utf-8", timeout: 5000 }).trim();
    if (raw) {
      sessions = raw.split("\n").filter(Boolean).map(line => {
        const [name, attached, windows] = line.split(":");
        return { name, attached: attached === "1", windows: parseInt(windows) || 1 };
      });
    }
  } catch {}

  switch (action) {
    case "list":
    case "ls": {
      if (sessions.length === 0) {
        return { status: "ok", message: "📑 **Tabs**\n\nไม่มี tmux sessions\nใช้ /wake เพื่อสร้าง agent session" };
      }
      return {
        status: "ok",
        message: [
          `📑 **Tabs** (${sessions.length} sessions)`,
          "",
          ...sessions.map((s, i) => `${i + 1}. **${s.name}** ${s.attached ? "🟢 attached" : "⚪ detached"} (${s.windows} windows)`),
        ].join("\n"),
        data: { sessions },
      };
    }

    case "send": {
      if (!tabId || !rest) return { status: "ok", message: "📑 ใช้: /tab send <session> \"message\"" };
      try {
        execSync(`tmux send-keys -t '${tabId}' '${rest.replace(/'/g, "'\\''")}' Enter`, { timeout: 5000 });
        return { status: "ok", message: `📑 Sent to ${tabId}: "${rest}"` };
      } catch (e: any) {
        return { status: "error", message: `❌ Tab send error: ${e.message}` };
      }
    }

    default: {
      return {
        status: "ok",
        message: [
          "📑 **Tab Commands**",
          "",
          "/tab list           — ดู tabs ทั้งหมด",
          "/tab send <s> \"msg\" — ส่งข้อความไป tab",
        ].join("\n"),
      };
    }
  }
}

// ─── /view — Clean full-screen view (maw-js pattern) ─────────────────────

export function view(args: string, ctx: CommandContext): CommandResult {
  const parts = args?.trim().split(/\s+/) || [];
  const agent = parts[0] || "";
  const isClean = parts.includes("--clean");

  if (!agent) {
    try {
      const running = _agentManager.getRunningAgents();
      return {
        status: "ok",
        message: [
          "🖥️ **View**",
          "",
          "/view <agent>          — ดู agent เต็มหน้าจอ",
          "/view <agent> --clean  — clean view (ไม่มี status bar)",
          "",
          running.length > 0 ? "Active agents:" : "ไม่มี agent ที่รันอยู่",
          ...running.map(a => `- ${a.name} (${a.role})`),
        ].join("\n"),
      };
    } catch {
      return { status: "ok", message: "🖥️ ใช้: /view <agent-name> [--clean]" };
    }
  }

  // Check if it's a tmux session
  try {
    const exists = execSync(`tmux has-session -t '${agent}' 2>/dev/null; echo $?`, { encoding: "utf-8", timeout: 3000 }).trim();
    if (exists === "0") {
      return {
        status: "ok",
        message: `🖥️ View: ${agent}${isClean ? " (clean mode)" : ""}\n\n💡 เปิด tmux session นี้ใน terminal แยก:\n\`tmux attach -t ${agent}${isClean ? " && tmux set status off" : ""}\``,
      };
    }
  } catch {}

  return {
    status: "ok",
    message: `🖥️ View: ${agent}\n\nไม่พบ session "${agent}" — ใช้ /tab list เพื่อดู sessions ที่มี`,
  };
}

// ─── /chat — Chat history (maw-js pattern) ────────────────────────────────

export function chat(args: string, ctx: CommandContext): CommandResult {
  const agentName = args?.trim() || "";

  if (!agentName) {
    try {
      const running = _agentManager.getRunningAgents();
      if (running.length === 0) {
        return { status: "ok", message: "💬 **Chat**\n\nไม่มี agent — ใช้ /wake เพื่อ spawn" };
      }

      // Show all agents' recent messages
      const lines: string[] = ["💬 **Chat History (all agents)**", ""];
      for (const agent of running) {
        const messages = _agentStore.getMessages(agent.id as any, 3);
        lines.push(`### ${agent.name} (${agent.role})`);
        if (messages.length === 0) {
          lines.push("_no messages_");
        } else {
          for (const msg of messages) {
            const m = msg as any;
            lines.push(`[${new Date(m.timestamp || m.ts || Date.now()).toLocaleTimeString()}] ${m.role}: ${(m.content || m.text || "").slice(0, 100)}`);
          }
        }
        lines.push("");
      }
      return { status: "ok", message: lines.join("\n"), data: { agents: running.map(a => ({ name: a.name, role: a.role })) } };
    } catch (e: any) {
      return { status: "error", message: `❌ chat error: ${e.message}` };
    }
  }

  // Show specific agent's chat
  try {
    const running = _agentManager.getRunningAgents();
    const agent = running.find(a => a.name === agentName || a.id.startsWith(agentName));
    if (!agent) {
      return { status: "ok", message: `❌ ไม่พบ agent: ${agentName}` };
    }

    const messages = _agentStore.getMessages(agent.id as any, 10);
    return {
      status: "ok",
      message: [
        `💬 **Chat: ${agent.name}** (${agent.role})`,
        "",
        ...messages.map((msg: any) => {
          const ts = new Date(msg.timestamp || msg.ts || Date.now()).toLocaleTimeString();
          const role = msg.role || "unknown";
          const content = (msg.content || msg.text || "").slice(0, 200);
          return `[${ts}] **${role}**: ${content}`;
        }),
        messages.length === 0 ? "_no messages_" : "",
      ].filter(Boolean).join("\n"),
      data: { agent: { name: agent.name, role: agent.role }, messages },
    };
  } catch (e: any) {
    return { status: "error", message: `❌ chat error: ${e.message}` };
  }
}

// ─── /review — Review think cycle proposals (maw-js pattern) ──────────────

export function review(args: string, ctx: CommandContext): CommandResult {
  try {
    const running = _agentManager.getRunningAgents();
    if (running.length === 0) {
      return { status: "ok", message: "🔍 **Review**\n\nไม่มี agent — ใช้ /think เพื่อเริ่ม think cycle" };
    }

    const reviews: string[] = ["🔍 **Review: Agent Proposals**", ""];
    for (const agent of running) {
      const messages = _agentStore.getMessages(agent.id as any, 3);
      const latest = messages[0] as any;
      reviews.push(`### ${agent.name} (${agent.role})`);
      reviews.push(latest?.content?.slice(0, 300) || "_no recent output_");
      reviews.push("");
    }

    return { status: "ok", message: reviews.join("\n") };
  } catch (e: any) {
    return { status: "error", message: `❌ review error: ${e.message}` };
  }
}

// ─── Update COMMANDS registry ──────────────────────────────────────────────

// Add new commands to COMMANDS (extend existing registry)
Object.assign(COMMANDS, {
  plugin,
  task,
  project,
  loop,
  tokens,
  think,
  meeting,
  tab,
  view,
  chat,
  review,
});

// Update listCommands to include new commands
const _origListCommands = listCommands;
export function listCommandsExtended(): { name: string; description: string }[] {
  return [
    ..._origListCommands(),
    // Batch 4: maw-js parity
    { name: "plugin", description: "📦 Plugin management (list/install/remove)" },
    { name: "task", description: "📋 Task system — log, show, comment, done (GitHub-style)" },
    { name: "project", description: "📁 Project trees — create, add, show with progress" },
    { name: "loop", description: "🔄 Loop management — add/remove/trigger/enable/disable" },
    { name: "tokens", description: "📊 Token monitoring (--rebuild, --json)" },
    { name: "think", description: "🤔 Think cycle — agents propose ideas" },
    { name: "meeting", description: "📅 Meeting — collect input from agents (--dry-run)" },
    { name: "tab", description: "📑 Tab management — list/send to tmux sessions" },
    { name: "view", description: "🖥️ Clean full-screen view for agent" },
    { name: "chat", description: "💬 Chat history per agent" },
    { name: "review", description: "🔍 Review think cycle proposals" },
  ];
}

const COMMANDS_EXTENDED: Record<string, CommandHandler> = COMMANDS;

export function executeCommand(input: string, ctx: CommandContext = {}): CommandResult {
  const trimmed = input.trim();

  // Handle /help
  if (trimmed === "/help" || trimmed === "/") {
    const cmds = listCommandsExtended();
    return {
      status: "ok",
      message:
        "🔮 **Oracle CLI Commands**\n\n" +
        cmds.map((c) => `/${c.name} — ${c.description}`).join("\n") +
        "\n\nพิมพ์ /<command> เพื่อใช้งาน",
    };
  }

  // Parse command
  const withoutSlash = trimmed.startsWith("/") ? trimmed.slice(1) : trimmed;
  const spaceIdx = withoutSlash.indexOf(" ");
  const cmdName = spaceIdx === -1 ? withoutSlash : withoutSlash.substring(0, spaceIdx);
  const args = spaceIdx === -1 ? "" : withoutSlash.substring(spaceIdx + 1).trim();

  const handler = COMMANDS[cmdName];
  if (!handler) {
    return {
      status: "error",
      message: `❌ ไม่รู้จักคำสั่ง: /${cmdName}\n\nพิมพ์ /help เพื่อดูคำสั่งที่มี`,
    };
  }

  try {
    return handler(args, ctx);
  } catch (e: any) {
    return {
      status: "error",
      message: `❌ Error in /${cmdName}: ${e.message}`,
    };
  }
}
