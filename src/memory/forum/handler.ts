/**
 * Forum Handler — stub for oracle tools
 * Exports match arra-oracle-v3/src/forum/handler.ts interface
 */

export async function handleThreadMessage(_threadId: number, _role: string, _content: string, _opts?: any): Promise<any> {
  return { id: Date.now(), threadId: _threadId, role: _role, content: _content };
}

export async function listThreads(_opts?: any): Promise<{ threads: any[]; total: number }> {
  return { threads: [], total: 0 };
}

export async function getFullThread(_threadId: number): Promise<any> {
  return null;
}

export async function getMessages(_threadId: number, _opts?: any): Promise<any[]> {
  return [];
}

export async function updateThreadStatus(_threadId: number, _status: string): Promise<any> {
  return null;
}

export async function createThread(_title: string, _opts?: any): Promise<any> {
  return { id: Date.now(), title: _title };
}

export async function addMessage(_threadId: number, _role: string, _content: string, _opts?: any): Promise<any> {
  return { id: Date.now(), threadId: _threadId };
}

export async function readThread(_threadId: number): Promise<any> {
  return null;
}

export async function updateThread(_threadId: number, _updates: any): Promise<any> {
  return null;
}
