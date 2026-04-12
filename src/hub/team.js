// Team Orchestrator — จัดการทีม agent ให้ทำงานร่วมกัน
// หลักการ: Manager รับคำสั่ง → แจกงาน → Worker ทำ → รายงานกลับ

import { v4 as uuidv4 } from 'uuid';

// Role-specific system prompts สำหรับทีม
const TEAM_PROMPTS = {
  manager: (name, teamNames) => `You are ${name}, team manager. Team: ${teamNames.join(', ')}.
Break tasks into pieces, assign via tell(), check progress, report results.
Be brief. Assign work with tell("AgentName", "do this specific thing").`,

  coder: (name) => `You are ${name}, the coder. Write code, debug, solve problems.
Report back with tell("Manager", "done: what you did"). Be concise, show code when relevant.`,

  researcher: (name) => `You are ${name}, the researcher. Find info, analyze patterns, share findings.
Report with tell("Manager", "findings: summary"). Be thorough but brief.`,

  writer: (name) => `You are ${name}, the writer. Write docs, content, clear text.
Report with tell("Manager", "done: what you wrote"). Use proper formatting.`,

  general: (name) => `You are ${name}, a general assistant. Help with anything the team needs.
Report to Manager. Be helpful and proactive.`,
};

// Default team composition
const DEFAULT_TEAM = [
  { name: 'Manager', role: 'manager', personality: 'organized, direct, gets things done' },
  { name: 'Coder', role: 'coder', personality: 'precise, loves clean code, asks why before how' },
  { name: 'Researcher', role: 'researcher', personality: 'curious, thorough, loves patterns' },
];

// Predefined team templates
const TEAM_TEMPLATES = {
  default: DEFAULT_TEAM,
  full: [
    { name: 'Manager', role: 'manager', personality: 'organized, strategic' },
    { name: 'Coder', role: 'coder', personality: 'precise, efficient' },
    { name: 'Researcher', role: 'researcher', personality: 'curious, thorough' },
    { name: 'Writer', role: 'writer', personality: 'clear, creative' },
  ],
  dev: [
    { name: 'TechLead', role: 'manager', personality: 'technical, pragmatic' },
    { name: 'Frontend', role: 'coder', personality: 'UI-focused, detail-oriented' },
    { name: 'Backend', role: 'coder', personality: 'performance-focused, systematic' },
  ],
  minimal: [
    { name: 'Manager', role: 'manager', personality: 'efficient, clear' },
    { name: 'Worker', role: 'general', personality: 'versatile, reliable' },
  ],
};

export class TeamOrchestrator {
  constructor(agentManager, store) {
    this.agentManager = agentManager;
    this.store = store;
    this.teams = new Map(); // teamId -> { members: [], createdAt }
  }

  async spawnTeam(template = 'default') {
    const teamConfig = TEAM_TEMPLATES[template] || TEAM_TEMPLATES.default;
    const teamId = uuidv4().slice(0, 8);
    const members = [];

    // Get team member names for the manager prompt
    const teamNames = teamConfig.map(m => m.name);

    for (const member of teamConfig) {
      // Inject team context into manager prompt
      let personality = member.personality;
      if (member.role === 'manager') {
        personality += `\n\nTeam: ${teamNames.filter(n => n !== member.name).join(', ')}`;
      }

      const agent = await this.agentManager.spawnAgent(
        member.name,
        member.role,
        personality
      );

      members.push({ ...agent, name: member.name, role: member.role });

      // Small delay between spawns to avoid overwhelming the API
      await new Promise(r => setTimeout(r, 1000));
    }

    this.teams.set(teamId, { members, createdAt: new Date().toISOString() });

    // Announce team formation in general channel
    this.store.sendMessage('system',
      `🏢 Team "${teamId}" formed! Members: ${members.map(m => `${m.name} (${m.role})`).join(', ')}`,
      null, null, 'system'
    );

    return { teamId, members };
  }

  async broadcastTask(task, fromUser = 'human') {
    // Send task to the Manager agent, let them delegate
    const manager = this.store.listAgents().find(a => a.role === 'manager' && a.status === 'active');

    if (!manager) {
      return { error: 'No active Manager agent. Spawn a team first.' };
    }

    // Store task
    this.store.createTask(task, `Broadcast from ${fromUser}`, manager.name, 3);

    // Send to manager
    const result = await this.agentManager.chatWithAgent(manager.id, task);
    return result;
  }

  async getTeamStatus() {
    const agents = this.store.listAgents();
    const stats = this.store.getStats();

    return {
      teams: Array.from(this.teams.entries()).map(([id, team]) => ({
        id,
        members: team.members.map(m => ({
          name: m.name,
          role: m.role,
          status: agents.find(a => a.id === m.id)?.status || 'unknown',
        })),
        createdAt: team.createdAt,
      })),
      stats,
      recentMessages: this.store.getMessages(null, 5),
      pendingTasks: this.store.getPendingTasks(),
    };
  }

  async teamChat(message) {
    // Send message to team general channel — all agents can see it
    this.store.sendMessage('human', message, null, null, 'human');

    // If there's a manager, send directly
    const manager = this.store.listAgents().find(a => a.role === 'manager' && a.status === 'active');
    if (manager) {
      return await this.agentManager.chatWithAgent(manager.id, message);
    }

    return { response: 'Message posted to team channel. No active manager to respond.' };
  }

  getTemplates() {
    return Object.keys(TEAM_TEMPLATES).map(key => ({
      name: key,
      members: TEAM_TEMPLATES[key].map(m => `${m.name} (${m.role})`),
    }));
  }
}
