/**
 * Oracle Skills Registry — adapted from oracle-skills-cli
 *
 * 30+ skills mapped to CLI commands + agent capabilities.
 * Each skill has: name, description, category, commands, agentTools
 */

export interface Skill {
  name: string;
  description: string;
  category: string;
  commands: string[];
  agentTools?: string[];
  source?: string;
}

export const SKILLS: Skill[] = [
  // ─── Memory & Identity ───────────────────────────────────────────────────
  {
    name: "awaken",
    description: "⚡ Guided Oracle birth and awakening ritual",
    category: "identity",
    commands: ["/awaken"],
    source: "oracle-skills-cli",
  },
  {
    name: "who-are-you",
    description: "🔮 Know ourselves — identity, model, session stats",
    category: "identity",
    commands: ["/who-are-you"],
    source: "oracle-skills-cli",
  },
  {
    name: "philosophy",
    description: "📜 Oracle 5 Principles + Rule 6",
    category: "identity",
    commands: ["/philosophy"],
    source: "รูปสอนสุญญตา",
  },

  // ─── Session Management ──────────────────────────────────────────────────
  {
    name: "recap",
    description: "📋 Session orientation and awareness",
    category: "session",
    commands: ["/recap"],
    source: "oracle-skills-cli",
  },
  {
    name: "standup",
    description: "🧍 Daily standup check",
    category: "session",
    commands: ["/standup"],
    source: "oracle-skills-cli",
  },
  {
    name: "rrr",
    description: "🔄 Session retrospective (Reflect, Rethink, Rebuild)",
    category: "session",
    commands: ["/rrr"],
    source: "oracle-skills-cli",
  },
  {
    name: "forward",
    description: "📤 Handoff to next session",
    category: "session",
    commands: ["/forward"],
    source: "oracle-skills-cli",
  },
  {
    name: "snapshot",
    description: "📸 Save current session state",
    category: "session",
    commands: ["/snapshot"],
    source: "oracle-v3",
  },

  // ─── Memory & Knowledge ──────────────────────────────────────────────────
  {
    name: "fyi",
    description: "📝 Save information to memory",
    category: "memory",
    commands: ["/fyi"],
    agentTools: ["memory_save"],
  },
  {
    name: "recall",
    description: "🔍 Recall from memory",
    category: "memory",
    commands: ["/recall"],
    agentTools: ["memory_recall"],
  },
  {
    name: "trace",
    description: "🔍 Universal search across everything",
    category: "memory",
    commands: ["/trace"],
    source: "oracle-skills-cli",
  },
  {
    name: "learn",
    description: "📚 Study and analyze repository",
    category: "memory",
    commands: ["/learn"],
    source: "oracle-skills-cli",
    agentTools: ["Bash", "Read", "Write"],
  },
  {
    name: "vault",
    description: "🔐 Connect external knowledge bases",
    category: "memory",
    commands: ["/vault"],
    source: "oracle-skills-cli",
  },
  {
    name: "dig",
    description: "⛏️ Deep session mining and history search",
    category: "memory",
    commands: ["/dig"],
    source: "oracle-skills-cli",
  },
  {
    name: "mine",
    description: "💎 Extract patterns from conversation",
    category: "memory",
    commands: ["/mine"],
    source: "oracle-skills-cli",
  },

  // ─── Emotional Intelligence ──────────────────────────────────────────────
  {
    name: "feel",
    description: "💭 System emotional intelligence",
    category: "emotion",
    commands: ["/feel"],
    source: "oracle-skills-cli",
  },
  {
    name: "resonance",
    description: "🎵 Capture what resonates",
    category: "emotion",
    commands: ["/resonance"],
    source: "oracle-skills-cli",
  },
  {
    name: "dream",
    description: "🌙 Cross-repo pattern discovery",
    category: "emotion",
    commands: ["/dream"],
    source: "oracle-skills-cli",
  },
  {
    name: "i-believed",
    description: "💭 Log assumption that was wrong",
    category: "emotion",
    commands: ["/i-believed"],
    source: "oracle-skills-cli",
  },

  // ─── Development ─────────────────────────────────────────────────────────
  {
    name: "go",
    description: "🚀 Quick project navigation",
    category: "dev",
    commands: ["/go"],
    source: "oracle-skills-cli",
  },
  {
    name: "workon",
    description: "🔧 Start working on a project",
    category: "dev",
    commands: ["/workon"],
    source: "oracle-skills-cli",
  },
  {
    name: "worktree",
    description: "🌳 Git worktree management",
    category: "dev",
    commands: ["/worktree"],
    source: "oracle-skills-cli",
  },
  {
    name: "incubate",
    description: "🥚 Start new project from scratch",
    category: "dev",
    commands: ["/incubate"],
    source: "oracle-skills-cli",
  },
  {
    name: "alpha-feature",
    description: "🧪 Experimental feature development",
    category: "dev",
    commands: ["/alpha-feature"],
    source: "oracle-skills-cli",
  },
  {
    name: "harden",
    description: "🛡️ Security hardening",
    category: "dev",
    commands: ["/harden"],
    source: "oracle-skills-cli",
  },

  // ─── GitHub & CI/CD ──────────────────────────────────────────────────────
  {
    name: "new-issue",
    description: "📋 Create GitHub issue with context",
    category: "github",
    commands: ["/new-issue"],
    source: "oracle-skills-cli",
    agentTools: ["Bash"],
  },
  {
    name: "list-issues-pr-pulse",
    description: "📊 List issues, PRs, and project pulse",
    category: "github",
    commands: ["/pulse"],
    source: "oracle-skills-cli",
    agentTools: ["Bash"],
  },
  {
    name: "release",
    description: "🏷️ Create release",
    category: "github",
    commands: ["/release"],
    source: "oracle-skills-cli",
    agentTools: ["Bash"],
  },

  // ─── Team & Multi-Agent ──────────────────────────────────────────────────
  {
    name: "team-agents",
    description: "🤖 Team agent operations",
    category: "team",
    commands: ["/team"],
    source: "oracle-skills-cli",
    agentTools: ["Bash"],
  },
  {
    name: "talk-to",
    description: "💬 Talk to another agent",
    category: "team",
    commands: ["/talk-to"],
    source: "oracle-skills-cli",
  },
  {
    name: "fleet",
    description: "🚢 Fleet management",
    category: "team",
    commands: ["/fleet"],
    source: "oracle-skills-cli",
  },
  {
    name: "machines",
    description: "🖥️ Machine management",
    category: "team",
    commands: ["/machines"],
    source: "oracle-skills-cli",
  },
  {
    name: "inbox",
    description: "📬 Unified inbox",
    category: "team",
    commands: ["/inbox"],
    source: "oracle-skills-cli",
  },
  {
    name: "mailbox",
    description: "📮 Agent mailbox",
    category: "team",
    commands: ["/mailbox"],
    source: "oracle-skills-cli",
  },

  // ─── Research & Analysis ─────────────────────────────────────────────────
  {
    name: "deep-research",
    description: "🔬 Deep multi-source research",
    category: "research",
    commands: ["/deep-research"],
    source: "oracle-skills-cli",
    agentTools: ["Bash", "Read", "Write"],
  },
  {
    name: "xray",
    description: "🩻 System x-ray — deep inspection",
    category: "research",
    commands: ["/xray"],
    source: "oracle-skills-cli",
  },
  {
    name: "wormhole",
    description: "🕳️ Cross-repo connections",
    category: "research",
    commands: ["/wormhole"],
    source: "oracle-skills-cli",
  },
  {
    name: "where-we-are",
    description: "📍 Where are we in the project",
    category: "research",
    commands: ["/where-we-are"],
    source: "oracle-skills-cli",
  },
  {
    name: "what-we-done",
    description: "✅ What have we accomplished",
    category: "research",
    commands: ["/what-we-done"],
    source: "oracle-skills-cli",
  },
  {
    name: "whats-next",
    description: "🔮 What should we do next",
    category: "research",
    commands: ["/whats-next"],
    source: "oracle-skills-cli",
  },

  // ─── Automation ──────────────────────────────────────────────────────────
  {
    name: "schedule",
    description: "⏰ Schedule tasks",
    category: "automation",
    commands: ["/schedule"],
    agentTools: ["memory_schedule"],
  },
  {
    name: "watch",
    description: "👁️ Watch for changes",
    category: "automation",
    commands: ["/watch"],
    source: "oracle-skills-cli",
  },
  {
    name: "warp",
    description: "🌀 Time warp — undo/redo state",
    category: "automation",
    commands: ["/warp"],
    source: "oracle-skills-cli",
  },
  {
    name: "handover",
    description: "🤝 Complete handover to human",
    category: "automation",
    commands: ["/handover"],
    source: "oracle-skills-cli",
  },
  {
    name: "auto-retrospective",
    description: "🔄 Auto retrospective at session end",
    category: "automation",
    commands: ["/auto-rrr"],
    source: "oracle-skills-cli",
  },

  // ─── Meta ────────────────────────────────────────────────────────────────
  {
    name: "about-oracle",
    description: "ℹ️ About Oracle ecosystem",
    category: "meta",
    commands: ["/about"],
    source: "oracle-skills-cli",
  },
  {
    name: "skills-list",
    description: "📋 List all available skills",
    category: "meta",
    commands: ["/skills"],
    source: "oracle-skills-cli",
  },
  {
    name: "oracle-soul-sync-update",
    description: "🔄 Sync Oracle soul files",
    category: "meta",
    commands: ["/soul-sync"],
    source: "oracle-skills-cli",
  },
  {
    name: "contacts",
    description: "👥 Contact management",
    category: "meta",
    commands: ["/contacts"],
    source: "oracle-skills-cli",
  },
  {
    name: "speak",
    description: "🗣️ Text to speech",
    category: "meta",
    commands: ["/speak"],
    source: "oracle-skills-cli",
  },
  {
    name: "gemini",
    description: "💎 Gemini integration",
    category: "meta",
    commands: ["/gemini"],
    source: "oracle-skills-cli",
  },
  {
    name: "create-shortcut",
    description: "⚡ Create command shortcut",
    category: "meta",
    commands: ["/shortcut"],
    source: "oracle-skills-cli",
  },
];

// ─── Utility Functions ─────────────────────────────────────────────────────

export function listSkillsByCategory(): Record<string, Skill[]> {
  const grouped: Record<string, Skill[]> = {};
  for (const skill of SKILLS) {
    if (!grouped[skill.category]) grouped[skill.category] = [];
    grouped[skill.category].push(skill);
  }
  return grouped;
}

export function findSkill(nameOrCommand: string): Skill | undefined {
  const query = nameOrCommand.replace(/^\//, "").toLowerCase();
  return SKILLS.find(
    (s) =>
      s.name.toLowerCase() === query ||
      s.commands.some((c) => c.replace("/", "").toLowerCase() === query)
  );
}

export function searchSkills(query: string): Skill[] {
  const q = query.toLowerCase();
  return SKILLS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
  );
}

export function getSkillCount(): number {
  return SKILLS.length;
}

export function getCategories(): string[] {
  return [...new Set(SKILLS.map((s) => s.category))];
}
