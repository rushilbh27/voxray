import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST — acknowledge an alert rule for N hours (default 24h)
// Body: { rule_id, agent, hours?, note? }
export async function POST(req: NextRequest) {
  const { rule_id, agent, hours = 24, note } = await req.json();

  if (!rule_id || !agent) {
    return NextResponse.json({ error: 'rule_id and agent required' }, { status: 400 });
  }

  const ack_until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('alert_acks')
    .insert({ rule_id, agent, ack_until, note: note ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ack: data, suppressed_until: ack_until });
}

// GET — list active acks
export async function GET() {
  const { data } = await supabaseAdmin
    .from('alert_acks')
    .select('*')
    .gt('ack_until', new Date().toISOString())
    .order('created_at', { ascending: false });

  return NextResponse.json({ acks: data ?? [] });
}
