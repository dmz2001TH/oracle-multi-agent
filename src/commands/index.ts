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
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { listSkillsByCategory, searchSkills, getSkillCount } from "../skills/registry.js";

const ORACLE_DIR = join(homedir(), ".oracle");
const MEMORY_DIR = join(ORACLE_DIR, "memory");
const JOURNAL_DIR = join(MEMORY_DIR, "journal");
const MOOD_LOG = join(MEMORY_DIR, "mood-log.jsonl");
const HANDOFF_DIR = join(MEMORY_DIR, "handoffs");
const IDENTITY_FILE = join(ORACLE_DIR, "identity.json");

// ψ/ knowledge root (project-relative)
const PSI_ROOT = join(process.cwd(), "ψ");
const PSI_MEMORY = join(PSI_ROOT, "memory");
const PSI_JOURNAL = join(PSI_MEMORY, "journal");
const PSI_RESONANCE = join(PSI_MEMORY, "resonance");
const PSI_RETROSPECTIVES = join(PSI_MEMORY, "retrospectives");
const PSI_DECISIONS = join(PSI_MEMORY, "decisions");
const PSI_HANDOFFS = join(PSI_MEMORY, "handoffs");
const PSI_MOOD = join(PSI_MEMORY, "mood");

function ensureDirs() {
  for (const d of [MEMORY_DIR, JOURNAL_DIR, HANDOFF_DIR,
    PSI_MEMORY, PSI_JOURNAL, PSI_RESONANCE, PSI_RETROSPECTIVES,
    PSI_DECISIONS, PSI_HANDOFFS, PSI_MOOD]) {
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
        "/trace <query>",
        "",
        "ค้นหาใน:",
        "- Journal entries (FYI, RRR, Standup)",
        "- Memory files (.jsonl)",
        "- Handoffs",
        "- Agent definitions",
        "",
        "ตัวอย่าง:",
        "/trace login bug",
        "/trace deploy",
      ].join("\n"),
    };
  }

  const query = args.toLowerCase();
  const results: { source: string; match: string; date?: string }[] = [];

  // Search journal files
  try {
    if (existsSync(JOURNAL_DIR)) {
      const files = readdirSync(JOURNAL_DIR).sort().reverse();
      for (const file of files) {
        const content = readFileSync(join(JOURNAL_DIR, file), "utf-8");
        if (content.toLowerCase().includes(query)) {
          const lines = content.split("\n");
          for (const line of lines) {
            if (line.toLowerCase().includes(query)) {
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

  // Search FYI jsonl
  try {
    const fyiFile = join(MEMORY_DIR, "fyi.jsonl");
    if (existsSync(fyiFile)) {
      const lines = readFileSync(fyiFile, "utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          if (record.text && record.text.toLowerCase().includes(query)) {
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

  // Search handoffs
  try {
    if (existsSync(HANDOFF_DIR)) {
      const files = readdirSync(HANDOFF_DIR).filter((f) => f !== "latest.json");
      for (const file of files) {
        const content = readFileSync(join(HANDOFF_DIR, file), "utf-8");
        if (content.toLowerCase().includes(query)) {
          results.push({
            source: `handoff/${file}`,
            match: "Handoff matches query",
          });
        }
      }
    }
  } catch {}

  if (results.length === 0) {
    return {
      status: "ok",
      message: `🔍 ไม่พบผลลัพธ์สำหรับ: "${args}"`,
    };
  }

  const output = results
    .slice(0, 20)
    .map(
      (r, i) =>
        `${i + 1}. [${r.source}]${r.date ? ` (${r.date})` : ""}\n   ${r.match}`
    )
    .join("\n\n");

  return {
    status: "ok",
    message: `🔍 พบ ${results.length} ผลลัพธ์สำหรับ "${args}":\n\n${output}`,
    data: { query: args, count: results.length, results: results.slice(0, 20) },
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

  // Handle URLs — clone to temp
  if (target.startsWith("http")) {
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
        message: `❌ Clone failed: ${e.message?.substring(0, 200)}`,
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
    { name: "trace", description: "🔍 Universal search" },
    { name: "learn", description: "📚 Study repository" },
    { name: "who-are-you", description: "🔮 Oracle identity" },
    { name: "philosophy", description: "📜 Oracle 5 Principles + Rule 6" },
    { name: "skills", description: "📋 List/search all skills (30+)" },
    { name: "resonance", description: "🎵 Capture what resonates" },
  ];
}

export function executeCommand(input: string, ctx: CommandContext = {}): CommandResult {
  const trimmed = input.trim();

  // Handle /help
  if (trimmed === "/help" || trimmed === "/") {
    const cmds = listCommands();
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
