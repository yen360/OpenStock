// Minimal Telegram Bot API helper. Requires TELEGRAM_BOT_TOKEN in the environment.

export const escapeTelegramHtml = (value: unknown) =>
    String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Accepts numeric chat IDs (groups start with "-") or public @channel usernames.
export const isValidTelegramChatId = (chatId: string) => /^(-?\d{5,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/.test(chatId.trim());

export async function sendTelegramMessage(chatId: string, html: string): Promise<number | null> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chat_id: chatId.trim(),
            text: html,
            parse_mode: "HTML",
            disable_web_page_preview: true,
        }),
    });
    const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        description?: string;
        result?: { message_id?: number };
    };
    if (!res.ok || !body.ok) {
        throw new Error(`Telegram API error ${res.status}: ${body.description ?? "unknown"}`);
    }
    return body.result?.message_id ?? null;
}
