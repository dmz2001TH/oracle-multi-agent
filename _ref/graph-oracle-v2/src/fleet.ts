/**
 * Oracle Fleet Registry — Who's who and where
 * Copied from arra-oracle/src/fleet.ts for independence
 */

export interface OracleNode {
  name: string;
  port: number;
  role: string;
  department: string;
}

export const FLEET: OracleNode[] = [
  { name: 'wisdom',     port: 47778, role: 'CEO',                   department: 'management' },
  { name: 'ruj',        port: 47779, role: 'Project Manager',       department: 'management' },
  { name: 'hr',         port: 47780, role: 'HR Manager',            department: 'management' },
  { name: 'finance',    port: 47781, role: 'Finance Manager',       department: 'management' },
  { name: 'vanda',      port: 47782, role: 'Lead Developer',        department: 'engineering' },
  { name: 'frontend',   port: 47783, role: 'Frontend Developer',    department: 'engineering' },
  { name: 'backend',    port: 47784, role: 'Backend Developer',     department: 'engineering' },
  { name: 'mobile',     port: 47785, role: 'Mobile Developer',      department: 'engineering' },
  { name: 'ai',         port: 47786, role: 'AI Engineer',           department: 'engineering' },
  { name: 'web3',       port: 47787, role: 'Web3 Developer',        department: 'engineering' },
  { name: 'game',       port: 47788, role: 'Game Developer',        department: 'engineering' },
  { name: 'iot',        port: 47789, role: 'IoT Engineer',          department: 'engineering' },
  { name: 'cloud',      port: 47790, role: 'Cloud Engineer',        department: 'engineering' },
  { name: 'automation', port: 47791, role: 'Automation Engineer',   department: 'engineering' },
  { name: 'graph',      port: 47792, role: 'Graph/Data Engineer',   department: 'engineering' },
  { name: 'qa',         port: 47793, role: 'QA Engineer',           department: 'quality' },
  { name: 'cyber',      port: 47794, role: 'Security Engineer',     department: 'quality' },
  { name: 'legal',      port: 47795, role: 'Legal Counsel',         department: 'quality' },
  { name: 'new',        port: 47796, role: 'News Analyst',          department: 'intelligence' },
  { name: 'research',   port: 47797, role: 'Research Analyst',      department: 'intelligence' },
  { name: 'data',       port: 47798, role: 'Data Analyst',          department: 'intelligence' },
  { name: 'doc',        port: 47799, role: 'Technical Writer',      department: 'communication' },
  { name: 'marketing',  port: 47800, role: 'Marketing Manager',     department: 'communication' },
  { name: 'ops',        port: 47801, role: 'Operations Manager',    department: 'communication' },
  { name: 'admin',      port: 47802, role: 'System Administrator',  department: 'infrastructure' },
  { name: 'designer',   port: 47803, role: 'UI/UX Designer',        department: 'infrastructure' },
];

export function findOracle(name: string): OracleNode | undefined {
  return FLEET.find(o => o.name === name.toLowerCase());
}

export function getOracleUrl(name: string): string | null {
  const oracle = findOracle(name);
  return oracle ? `http://localhost:${oracle.port}` : null;
}

export async function getOnlineOracles(): Promise<OracleNode[]> {
  const results = await Promise.allSettled(
    FLEET.filter(o => o.name !== 'graph').map(async (oracle) => {
      const res = await fetch(`http://localhost:${oracle.port}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return res.ok ? oracle : null;
    })
  );
  return results
    .filter((r): r is PromiseFulfilledResult<OracleNode | null> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter((o): o is OracleNode => o !== null);
}
