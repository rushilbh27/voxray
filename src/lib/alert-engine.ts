/**
 * Alert Engine
 * Evaluates alert rules against recent analyzed calls.
 * Fires Telegram notifications when thresholds are exceeded.
 *
 * Required env vars:
 *   TELEGRAM_BOT_TOKEN  — from @BotFather
 *   TELEGRAM_CHAT_ID    — your personal chat ID (or group ID)
 *
 * Optional:
 *   ALERT_WEBHOOK_URL   — POST JSON to any webhook (Slack, n8n, custom)
 */
import { supabaseAdmin } from './supabase';
import { sendTelegram } from './telegram';
import type { TelegramButton } from './telegram';

export interface AlertRule {
  id: string;
  label: string;
  error_type: string | null;   // null = any critical error
  agent: string | null;        // null = all agents
  threshold: number;           // how many occurrences trigger alert
  window_hours: number;        // look-back window
  severity: 'info' | 'warning' | 'critical';
}

export const ALERT_RULES: AlertRule[] = [
  {
    id: 'garbled_audio_burst',
    label: 'Garbled audio spike',
    error_type: 'accepted_garbled_audio',
    agent: null,
    threshold: 3,
    window_hours: 6,
    severity: 'warning',
  },
  {
    id: 'location_failures',
    label: 'Agent failing to recognize area',
    error_type: 'accepted_unknown_location',
    agent: null,
    threshold: 2,
    window_hours: 6,
    severity: 'warning',
  },
  {
    id: 'no_save_burst',
    label: 'Data loss — calls ending without saveAnswers',
    error_type: 'no_save_answers',
    agent: null,
    threshold: 2,
    window_hours: 6,
    severity: 'critical',
  },
  {
    id: 'no_save_debt_burst',
    label: 'Data loss — calls ending without saveDebt',
    error_type: 'no_save_debt',
    agent: null,
    threshold: 2,
    window_hours: 6,
    severity: 'critical',
  },
  {
    id: 'any_critical',
    label: 'New critical errors detected',
    error_type: null,
    agent: null,
    threshold: 1,
    window_hours: 1,
    severity: 'critical',
  },
  {
    id: 'wrong_opening_cold',
    label: 'Cold outreach using wrong opening',
    error_type: 'wrong_opening',
    agent: 'Cold Outreach',
    threshold: 2,
    window_hours: 12,
    severity: 'warning',
  },
];

export interface FiredAlert {
  rule_id: string;
  label: string;
  severity: string;
  agent: string;
  agent_id?: string;  // for profile page deep-link
  count: number;
  example_call_id: string;
  fired_at: string;
}

async function sendWebhook(payload: FiredAlert): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

function formatTelegramAlert(alerts: FiredAlert[]): { text: string; buttons: TelegramButton[] } {
  const severityIcon = (s: string) => s === 'critical' ? '🔴' : s === 'warning' ? '🟡' : 'ℹ️';
  const base = process.env.VOXRAY_URL ?? 'https://voxray.vercel.app';

  const lines = [
    '<b>⚡ Voxray Alert</b>',
    '',
    ...alerts.map((a) =>
      `${severityIcon(a.severity)} <b>${a.label}</b>\n` +
      `   Agent: ${a.agent}\n` +
      `   Count: ${a.count} times in recent calls\n` +
      `   Example: <code>${a.example_call_id.substring(0, 16)}…</code>`
    ),
    '',
  ];

  const buttons: TelegramButton[] = alerts
    .filter((a, i, arr) => arr.findIndex(x => x.agent_id === a.agent_id) === i) // dedupe by agent
    .filter((a) => !!a.agent_id)
    .map((a) => ({ text: `→ ${a.agent} profile`, url: `${base}/dashboard/${a.agent_id}` }));

  // Fallback button if no agent_ids available
  if (buttons.length === 0) {
    buttons.push({ text: '→ Open Voxray', url: base });
  }

  return { text: lines.join('\n'), buttons };
}

/**
 * Evaluate all alert rules against recent calls.
 * Returns fired alerts and sends notifications.
 */
export async function runAlertCheck(): Promise<FiredAlert[]> {
  const maxWindow = Math.max(...ALERT_RULES.map((r) => r.window_hours));
  const since = new Date(Date.now() - maxWindow * 60 * 60 * 1000).toISOString();

  // Fetch recently analyzed calls with errors
  const { data: recentCalls } = await supabaseAdmin
    .from('ultravox_calls')
    .select('call_id, agent_id, client_name, call_errors, error_count, critical_error_count, created_at, analysis_status')
    .eq('analysis_status', 'complete')
    .gt('created_at', since)
    .gt('error_count', 0)
    .range(0, 999);

  const fired: FiredAlert[] = [];

  for (const rule of ALERT_RULES) {
    const ruleWindow = new Date(Date.now() - rule.window_hours * 60 * 60 * 1000).toISOString();

    if (rule.error_type === null) {
      // Any critical error in window
      const matches = (recentCalls ?? []).filter(
        (c) =>
          c.created_at >= ruleWindow &&
          (c.critical_error_count ?? 0) >= rule.threshold &&
          (!rule.agent || c.client_name === rule.agent)
      );
      if (matches.length >= rule.threshold) {
        // Group by agent
        const byAgent = new Map<string, typeof matches>();
        for (const m of matches) {
          const k = m.client_name as string;
          if (!byAgent.has(k)) byAgent.set(k, []);
          byAgent.get(k)!.push(m);
        }
        for (const [agent, agentMatches] of byAgent) {
          fired.push({
            rule_id: rule.id,
            label: rule.label,
            severity: rule.severity,
            agent,
            agent_id: agentMatches[0].agent_id as string | undefined,
            count: agentMatches.length,
            example_call_id: agentMatches[0].call_id as string,
            fired_at: new Date().toISOString(),
          });
        }
      }
    } else {
      // Specific error type
      const typeMatches: Array<{ call_id: string; agent: string; agent_id: string }> = [];
      for (const call of recentCalls ?? []) {
        if (call.created_at < ruleWindow) continue;
        if (rule.agent && call.client_name !== rule.agent) continue;
        const errors = (call.call_errors as { errors?: Array<{ type: string }> } | null)?.errors ?? [];
        if (errors.some((e) => e.type === rule.error_type)) {
          typeMatches.push({ call_id: call.call_id as string, agent: call.client_name as string, agent_id: call.agent_id as string });
        }
      }

      if (typeMatches.length >= rule.threshold) {
        // Group by agent
        const byAgent = new Map<string, typeof typeMatches>();
        for (const m of typeMatches) {
          if (!byAgent.has(m.agent)) byAgent.set(m.agent, []);
          byAgent.get(m.agent)!.push(m);
        }
        for (const [agent, agentMatches] of byAgent) {
          if (agentMatches.length >= rule.threshold) {
            fired.push({
              rule_id: rule.id,
              label: rule.label,
              severity: rule.severity,
              agent,
              agent_id: agentMatches[0].agent_id,
              count: agentMatches.length,
              example_call_id: agentMatches[0].call_id,
              fired_at: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  // Dedupe — one alert per rule_id + agent combo
  const seen = new Set<string>();
  const deduped = fired.filter((a) => {
    const key = `${a.rule_id}::${a.agent}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Filter out acknowledged alerts
  const { data: activeAcks } = await supabaseAdmin
    .from('alert_acks')
    .select('rule_id, agent')
    .gt('ack_until', new Date().toISOString());

  const ackedKeys = new Set((activeAcks ?? []).map((a) => `${a.rule_id}::${a.agent}`));
  const unacked = deduped.filter((a) => !ackedKeys.has(`${a.rule_id}::${a.agent}`));

  if (unacked.length > 0) {
    const { text, buttons } = formatTelegramAlert(unacked);
    await Promise.allSettled([
      sendTelegram(text, buttons),
      ...unacked.map(sendWebhook),
    ]);
  }

  return deduped; // return all fired (including acked) so dashboard shows full state
}
