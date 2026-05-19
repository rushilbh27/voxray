/**
 * Cron endpoint — runs every hour via Vercel Cron
 * 1. Syncs latest 100 calls from Ultravox
 * 2. Auto-analyzes new calls
 * 3. Runs alert rule check
 * 4. Returns summary
 *
 * Secured by CRON_SECRET env var (set in Vercel dashboard).
 * Vercel sends Authorization: Bearer <CRON_SECRET> on cron invocations.
 */
import { NextResponse } from 'next/server';
import { runAlertCheck } from '@/lib/alert-engine';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  // Verify Vercel cron secret
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Trigger sync (which also auto-analyzes new calls)
  const baseUrl = process.env.VOXRAY_URL ?? 'https://voxray.vercel.app';
  const syncRes = await fetch(`${baseUrl}/api/sync`, { method: 'POST' }).catch(() => null);
  const syncData = syncRes ? await syncRes.json().catch(() => ({})) : {};

  // Run standalone alert check (catches patterns across older calls too)
  const alerts = await runAlertCheck().catch(() => []);

  return NextResponse.json({
    ok: true,
    ran_at: new Date().toISOString(),
    sync: syncData,
    alerts_fired: alerts.length,
    alerts: alerts.map((a) => ({ rule: a.rule_id, agent: a.agent, count: a.count, severity: a.severity })),
  });
}
