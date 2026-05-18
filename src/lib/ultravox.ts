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

export async function fetchCallDetails(callId: string): Promise<UltravoxCall> {
  const res = await fetch(`${ULTRAVOX_API_URL}/calls/${callId}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to fetch call ${callId}: ${res.status}`);
  return res.json();
}

export async function fetchCallMessages(callId: string): Promise<UltravoxMessage[]> {
  const res = await fetch(`${ULTRAVOX_API_URL}/calls/${callId}/messages`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Failed to fetch messages for ${callId}: ${res.status}`);
  const data = await res.json();
  return data.results;
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
  agentName?: string | null
): string {
  // Check by agentId first (exact UUID match — configure these once known)
  const knownAgents: Record<string, string> = {
    // Add UUID → client mappings here as you identify them
    // '65ae3d7d-5a1f-4880-89f4-1ce690efae89': 'Ramco Gas',
  };
  if (agentId && knownAgents[agentId]) return knownAgents[agentId];

  // Fallback: check agent name string
  const name = agentName?.toLowerCase() ?? '';
  if (name.includes('ramco')) return 'Ramco Gas';
  if (name.includes('edifice')) return 'Edifice Properties';
  if (name.includes('davansh')) return 'Davansh Investment';
  if (name.includes('debt')) return 'Debt Collector';
  if (name.includes('sales')) return 'Sales AI';
  if (name.includes('cold')) return 'Cold Outreach';

  // Use agent name as-is if available
  if (agentName) return agentName;
  return 'Unknown';
}

export function calcCostUsd(durationSeconds: number): number {
  return (durationSeconds / 60) * 0.05;
}
