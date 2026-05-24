const ULTRAVOX_API_URL = 'https://api.ultravox.ai/api';

export interface UltravoxCall {
  callId: string;          // API field name (not "id")
  agentId: string | null;
  ended: string | null;    // ISO datetime string when ended, null if active
  endReason?: string | null;
  billedDuration?: string | null; // e.g. "120.5s"
  created: string;
  agent?: { agentId: string; name: string } | null;
  shortSummary?: string | null;
  [key: string]: unknown;
}

export interface UltravoxMessage {
  role: string;                    // MESSAGE_ROLE_USER, MESSAGE_ROLE_AGENT, etc.
  text: string;
  callStageMessageIndex?: number;  // actual ordinal field from API
  medium?: string;
  callStageId?: string;
}

export interface UltravoxTool {
  name: string;
  parameters?: unknown;
  result?: unknown;
  invocationTime: string;
  errorMessage?: string;
}

function headers() {
  return { 'X-API-Key': process.env.ULTRAVOX_API_KEY! };
}

export async function fetchCalls(limit = 100): Promise<UltravoxCall[]> {
  const res = await fetch(
    `${ULTRAVOX_API_URL}/calls?limit=${limit}&ordering=-created`,
    { headers: headers(), next: { revalidate: 60 } }
  );
  if (!res.ok) throw new Error(`Ultravox API error: ${res.status}`);
  const data = await res.json();
  return data.results;
}

export async function fetchAllCalls(): Promise<UltravoxCall[]> {
  const all: UltravoxCall[] = [];
  let url: string | null = `${ULTRAVOX_API_URL}/calls?limit=100&ordering=-created`;
  while (url) {
    const res: Response = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`Ultravox API error: ${res.status}`);
    const data = await res.json();
    all.push(...data.results);
    url = data.next as string | null;
  }
  return all;
}

export async function fetchCallDetails(callId: string): Promise<UltravoxCall> {
  const res = await fetch(`${ULTRAVOX_API_URL}/calls/${callId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to fetch call ${callId}: ${res.status}`);
  return res.json();
}

export async function fetchCallMessages(callId: string): Promise<UltravoxMessage[]> {
  const all: UltravoxMessage[] = [];
  let url: string | null = `${ULTRAVOX_API_URL}/calls/${callId}/messages?limit=100`;
  while (url) {
    const res: Response = await fetch(url, { headers: headers() });
    if (!res.ok) throw new Error(`Failed to fetch messages for ${callId}: ${res.status}`);
    const data = await res.json();
    all.push(...(data.results ?? []));
    url = data.next as string | null;
  }
  return all;
}

export async function fetchCallRecordingUrl(callId: string): Promise<string | null> {
  const res = await fetch(`${ULTRAVOX_API_URL}/calls/${callId}/recording`, {
    headers: headers(),
    redirect: 'manual',
  });
  if (res.status === 302 || res.status === 301) {
    return res.headers.get('location');
  }
  if (res.ok) return `${ULTRAVOX_API_URL}/calls/${callId}/recording`;
  return null;
}

export async function fetchCallTools(callId: string): Promise<UltravoxTool[]> {
  const res = await fetch(`${ULTRAVOX_API_URL}/calls/${callId}/tools`, {
    headers: headers(),
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

export function getClientName(
  agentId: string | null | undefined,
  agentName?: string | null,
  systemPrompt?: string | null
): string {
  const knownAgents: Record<string, string> = {
    '65ae3d7d-5a1f-4880-89f4-1ce690efae89': 'Sales AI',
    '52db715f-fc68-4265-a354-7f64a27cd3b9': 'Debt Collector',
    '428d7591-3ba5-4b60-8aa5-a92012d12451': 'NECTOR Demo',
    '74c435db-0382-45d4-8f84-65343c0dde5f': 'Cold Outreach',
    '0a5b5ccc-4f75-456c-94c8-f9e7293f9d81': 'Davansh Investment',
    'bfea3820-a447-4444-bd41-53ff919bbfe3': 'Edifice Properties',
    '5da7bc3e-e653-4dd6-9402-bbe9b5b3a7b1': 'Ramco Gas',
    'efecb97c-2937-4507-a550-8db5e8882c82': 'Real Estate AI',
    '4be98966-7c89-4149-8f10-e2ac16291f66': 'Debt Collection 2',
    '3983f5c0-4a95-42e3-a95a-9dbe57e11c78': 'Follow-Up Debt Bot',
    '2dfe90c6-569f-49e0-84f4-e67d9e770255': 'Debt Welcome Bot',
  };
  if (agentId && knownAgents[agentId]) return knownAgents[agentId];

  const name = agentName?.toLowerCase() ?? '';
  if (name.includes('debt')) return 'Debt Collector';
  if (name.includes('sales')) return 'Sales AI';
  if (name.includes('cold')) return 'Cold Outreach';
  if (name.includes('nector')) return 'NECTOR Demo';

  if (agentName) return agentName;

  // No agent — extract company from systemPrompt
  if (systemPrompt) {
    const match = systemPrompt.match(/receptionist for ([^.]+)/i);
    if (match) return match[1].trim();
  }

  return 'Unknown';
}

export interface UltravoxAgent {
  agentId: string;
  name: string;
  systemPrompt?: string | null;
  callTemplate?: {
    systemPrompt?: string | null;
  };
  [key: string]: unknown;
}

export async function fetchAgents(): Promise<UltravoxAgent[]> {
  const all: UltravoxAgent[] = [];
  let url: string | null = `${ULTRAVOX_API_URL}/agents?limit=100`;
  while (url) {
    const res: Response = await fetch(url, { headers: headers(), cache: 'no-store' });
    if (!res.ok) break;
    const data = await res.json();
    for (const a of data.results ?? []) {
      const prompt = a?.callTemplate?.systemPrompt ?? a?.systemPrompt ?? null;
      all.push({ ...a, systemPrompt: prompt });
    }
    url = data.next as string | null;
  }
  return all;
}

export async function fetchAgent(agentId: string): Promise<UltravoxAgent | null> {
  try {
    const res = await fetch(`${ULTRAVOX_API_URL}/agents/${agentId}`, {
      headers: headers(),
      cache: 'no-store', // always fresh — prompts change after patches
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Ultravox stores systemPrompt nested under callTemplate, not at root level
    const prompt = data?.callTemplate?.systemPrompt ?? data?.systemPrompt ?? null;
    return { ...data, systemPrompt: prompt };
  } catch {
    return null;
  }
}

export async function fetchAgentPrompts(): Promise<Record<string, string>> {
  const agentIds: Record<string, string> = {
    'Sales AI':              '65ae3d7d-5a1f-4880-89f4-1ce690efae89',
    'Debt Collector':        '52db715f-fc68-4265-a354-7f64a27cd3b9',
    'Cold Outreach':         '74c435db-0382-45d4-8f84-65343c0dde5f',
    'NECTOR Demo':           '428d7591-3ba5-4b60-8aa5-a92012d12451',
  };

  const results = await Promise.all(
    Object.entries(agentIds).map(async ([name, id]) => {
      const agent = await fetchAgent(id);
      const prompt = agent?.systemPrompt || agent?.callTemplate?.systemPrompt || '';
      return [name, prompt] as [string, string];
    })
  );

  return Object.fromEntries(results);
}

export interface AgentPromptInfo {
  prompt: string;
  agentId: string;
  agentName: string;
}

export async function fetchAllAgentPrompts(): Promise<Record<string, AgentPromptInfo>> {
  const { supabaseAdmin } = await import('@/lib/supabase');
  const { data: rows } = await supabaseAdmin
    .from('ultravox_calls')
    .select('agent_id, client_name')
    .not('agent_id', 'is', null)
    .limit(2000);

  const agentMap = new Map<string, string>();
  for (const row of rows ?? []) {
    if (row.agent_id && row.client_name && !agentMap.has(row.agent_id)) {
      agentMap.set(row.agent_id, row.client_name);
    }
  }

  const results = await Promise.all(
    [...agentMap.entries()].map(async ([agentId, clientName]) => {
      const agent = await fetchAgent(agentId);
      const prompt = agent?.systemPrompt || agent?.callTemplate?.systemPrompt || '';
      return [clientName, { prompt, agentId, agentName: clientName }] as [string, AgentPromptInfo];
    })
  );

  return Object.fromEntries(results);
}

export function calcCostUsd(durationSeconds: number): number {
  return (durationSeconds / 60) * 0.05;
}
