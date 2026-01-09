import type { Env } from "../types";

export interface TelegramClient {
  sendMessage(chatId: number, message: string): Promise<void>;
  answerInlineQuery(
    inlineQueryId: string,
    results: InlineQueryResultArticle[],
    options?: { cacheTime?: number; isPersonal?: boolean }
  ): Promise<void>;
}

export type InlineQueryResultArticle = {
  type: "article";
  id: string;
  title: string;
  description?: string;
  input_message_content: { message_text: string };
};

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

  async answerInlineQuery(
    inlineQueryId: string,
    results: InlineQueryResultArticle[],
    options?: { cacheTime?: number; isPersonal?: boolean }
  ): Promise<void> {
    const url = `${this.env.TELEGRAM_API_BASE}/bot${this.env.TELEGRAM_BOT_TOKEN}/answerInlineQuery`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        inline_query_id: inlineQueryId,
        results,
        cache_time: options?.cacheTime ?? 30,
        is_personal: options?.isPersonal ?? true
      })
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Telegram answerInlineQuery failed: ${res.status} ${t}`);
    }
  }
}
