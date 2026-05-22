/**
 * Shared Telegram notification module.
 * Supports inline keyboard URL buttons — zero callback handling needed.
 */

export interface TelegramButton {
  text: string;
  url: string;
}

export async function sendTelegram(
  message: string,
  buttons?: TelegramButton[],
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
  };

  if (buttons && buttons.length > 0) {
    // Telegram allows max 8 buttons per row; split into rows of 2
    const rows: Array<Array<{ text: string; url: string }>> = [];
    for (let i = 0; i < buttons.length; i += 2) {
      rows.push(
        buttons.slice(i, i + 2).map((b) => ({ text: b.text, url: b.url })),
      );
    }
    body.reply_markup = { inline_keyboard: rows };
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
