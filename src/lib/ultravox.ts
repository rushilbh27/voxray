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
  [key: string]: unknown;
}

export async function fetchAgent(agentId: string): Promise<UltravoxAgent | null> {
  try {
    const res = await fetch(`${ULTRAVOX_API_URL}/agents/${agentId}`, {
      headers: headers(),
      next: { revalidate: 300 }, // cache 5 min — prompts don't change often
    });
    if (!res.ok) return null;
    return res.json();
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
      return [name, agent?.systemPrompt ?? ''] as [string, string];
    })
  );

  return Object.fromEntries(results);
}

export function calcCostUsd(durationSeconds: number): number {
  return (durationSeconds / 60) * 0.05;
}
