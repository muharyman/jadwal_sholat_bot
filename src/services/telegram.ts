import type { Env } from "../types";

export interface TelegramClient {
  sendMessage(chatId: number, message: string): Promise<void>;
}

export class TelegramApiClient implements TelegramClient {
  constructor(private env: Env) {}

  async sendMessage(chatId: number, message: string): Promise<void> {
    const url = `${this.env.TELEGRAM_API_BASE}/bot${this.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Telegram sendMessage failed: ${res.status} ${t}`);
    }
  }
}
