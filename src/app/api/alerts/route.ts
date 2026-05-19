import { NextResponse } from 'next/server';
import { runAlertCheck, ALERT_RULES } from '@/lib/alert-engine';

export const revalidate = 0;

export async function GET() {
  const fired = await runAlertCheck();
  return NextResponse.json({
    rules: ALERT_RULES,
    fired,
    telegram_configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    webhook_configured: !!process.env.ALERT_WEBHOOK_URL,
  });
}
