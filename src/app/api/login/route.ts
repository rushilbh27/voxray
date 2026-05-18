import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body || {};

    const demoEmail = process.env.DEMO_USER_EMAIL;
    const demoPass = process.env.DEMO_USER_PASSWORD;

    // Simple demo fallback using env vars (fast, low-friction)
    if (demoEmail && demoPass && email === demoEmail && password === demoPass) {
      const cookie = `voxray_access_token=demo; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 8}`;
      return NextResponse.json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
    }

    if (!email || !password) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data?.session) {
      return NextResponse.json({ error: error?.message ?? 'Invalid credentials' }, { status: 401 });
    }

    const token = data.session.access_token;
    const cookie = `voxray_access_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 8}; Secure`;
    return NextResponse.json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
  } catch (err) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
