/**
 * Ultravox webhook — fires immediately when a call ends.
 * Responds 204 fast, processes in background via after().
 * Pipeline: sync call + messages → analyze → alert check
 */
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { analyzeCall } from '@/lib/call-analyzer';
import { runAlertCheck } from '@/lib/alert-engine';
import { fetchCallMessages } from '@/lib/ultravox';

const WEBHOOK_URL = `${process.env.VOXRAY_URL ?? 'https://voxray.vercel.app'}/api/webhook/transcript`;

// Optional HMAC signature verification
async function verifySignature(req: NextRequest, body: string): Promise<boolean> {
  const secret = process.env.ULTRAVOX_WEBHOOK_SECRET;
  if (!secret) return true; // skip if not configured

  const sig = req.headers.get('x-ultravox-signature');
  if (!sig) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const sigBytes = Uint8Array.from(Buffer.from(sig, 'hex'));
  const bodyBytes = new TextEncoder().encode(body);
  return crypto.subtle.verify('HMAC', key, sigBytes, bodyBytes);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!(await verifySignature(req, rawBody))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: { event?: string; call?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (payload.event !== 'call.ended') {
    return new NextResponse(null, { status: 204 });
  }

  const callId = payload.call?.callId as string | undefined;
  if (!callId) return new NextResponse(null, { status: 204 });

  // Respond immediately — Ultravox wants fast ACK
  after(async () => {
    try {
      const call = payload.call!;

      // 1. Upsert call record
      await supabaseAdmin.from('ultravox_calls').upsert({
        call_id:              callId,
        agent_id:             call.agentId ?? null,
        status:               'ended',
        created_at:           call.created ?? new Date().toISOString(),
        ended_at:             call.ended ?? null,
        duration_seconds:     call.billedDuration
          ? Math.round(parseFloat((call.billedDuration as string).replace('s', '')))
          : null,
        cost_usd:             null,
        ended_reason:         null,
        client_name:          null, // will be set by getClientName later
        analysis_status:      'pending',
      }, { onConflict: 'call_id', ignoreDuplicates: false });

      // 2. Fetch + upsert messages
      const messages = await fetchCallMessages(callId);
      if (messages.length > 0) {
        await supabaseAdmin.from('ultravox_messages').upsert(
          messages.map((m) => ({
            call_id: callId,
            role:    m.role,
            text:    m.text,
            ordinal: (m as never as {ordinal: number})?.ordinal ?? m.callStageMessageIndex ?? 0,
          })),
          { onConflict: 'call_id,ordinal', ignoreDuplicates: true }
        );
      }

      // 3. Resolve client_name — use agent.name from payload as fallback (auto-detects new agents)
      const { getClientName } = await import('@/lib/ultravox');
      const agentNameFromPayload = (call.agent as Record<string, string> | null)?.name ?? null;
      const clientName = getClientName(call.agentId as string | null, agentNameFromPayload, null);
      await supabaseAdmin
        .from('ultravox_calls')
        .update({ client_name: clientName })
        .eq('call_id', callId);

      // 4. Analyze — skip very short / unjoined calls
      if (messages.length >= 4) {
        const { analysis } = await analyzeCall({
          callId,
          agentId: call.agentId as string | null ?? null,
          clientName,
          messages: messages.map((m) => ({ role: m.role, text: m.text, ordinal: (m as never as {ordinal: number})?.ordinal ?? m.callStageMessageIndex ?? 0 })),
          webhookUrl: WEBHOOK_URL,
        });

        await supabaseAdmin
          .from('ultravox_calls')
          .update({
            call_errors:           analysis,
            analysis_status:       'complete',
            error_count:           analysis.error_count,
            critical_error_count:  analysis.critical_error_count,
          })
          .eq('call_id', callId);
      } else {
        await supabaseAdmin
          .from('ultravox_calls')
          .update({ analysis_status: 'skipped' })
          .eq('call_id', callId);
      }

      // 5. Run alert check — catches new critical errors immediately
      await runAlertCheck();
    } catch (err) {
      console.error('[webhook/call-ended] error:', err);
      await supabaseAdmin
        .from('ultravox_calls')
        .update({ analysis_status: 'error' })
        .eq('call_id', callId)
        .then(() => null, () => null);
    }
  });

  return new NextResponse(null, { status: 204 });
}
