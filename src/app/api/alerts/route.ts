import { NextRequest, NextResponse } from 'next/server';
import { runAlertCheck, ALERT_RULES } from '@/lib/alert-engine';

export const revalidate = 0;

export async function GET(req: NextRequest) {
  const test = req.nextUrl.searchParams.get('test') === '1';

  if (test) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      return NextResponse.json({ error: 'Telegram not configured' }, { status: 400 });
    }
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ <b>Voxray</b> — Telegram alerts working.\n→ <a href="https://voxray.vercel.app">Open dashboard</a>',
        parse_mode: 'HTML',
      }),
    });
    const data = await res.json();
    return NextResponse.json({ sent: res.ok, telegram: data });
  }

  const fired = await runAlertCheck();
  return NextResponse.json({
    rules: ALERT_RULES,
    fired,
    telegram_configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    webhook_configured: !!process.env.ALERT_WEBHOOK_URL,
  });
}
