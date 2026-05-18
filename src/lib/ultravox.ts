const ULTRAVOX_API_URL = 'https://api.ultravox.ai/api';

export interface UltravoxCall {
  id: string;
  agentId: string;
  ended: boolean;
  endedReason?: string;
  durationSeconds?: number;
  created: string;
  [key: string]: unknown;
}

export interface UltravoxMessage {
  role: string;
  text: string;
  ordinal: number;
  created: string;
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
  return data.results;
}

export function getClientName(agentId: string): string {
  const id = agentId.toLowerCase();
  if (id.includes('ramco')) return 'Ramco Gas';
  if (id.includes('edifice')) return 'Edifice Properties';
  if (id.includes('davansh')) return 'Davansh Investment';
  return 'Unknown';
}

export function calcCostUsd(durationSeconds: number): number {
  return (durationSeconds / 60) * 0.05;
}
