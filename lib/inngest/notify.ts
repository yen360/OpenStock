import { inngest } from "@/lib/inngest/client";

// Full Inngest ID of this function (app id + function id). Used to skip our own
// failures so a broken Telegram setup can't trigger an endless notification loop.
const SELF_ID = "openStock-notify-failures-telegram";

const escapeHtml = (value: unknown) =>
    String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Sends a Telegram message whenever any Inngest run fails or is cancelled.
 * Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Vercel.
 */
export const notifyFailuresToTelegram = inngest.createFunction(
    { id: "notify-failures-telegram", retries: 2 },
    [
        { event: "inngest/function.failed", if: `event.data.function_id != '${SELF_ID}'` },
        { event: "inngest/function.cancelled", if: `event.data.function_id != '${SELF_ID}'` },
    ],
    async ({ event, step }) => {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (!token || !chatId) {
            return { skipped: true, reason: "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set" };
        }

        const data = (event.data ?? {}) as {
            function_id?: string;
            run_id?: string;
            error?: { name?: string; message?: string };
            event?: { name?: string };
        };
        const kind = event.name === "inngest/function.cancelled" ? "cancelled" : "failed";
        const icon = kind === "cancelled" ? "⏹️" : "🚨";
        const occurredAt = new Date(event.ts ?? Date.now()).toISOString();

        const lines = [
            `${icon} <b>OpenStock: job ${kind}</b>`,
            `<b>Function:</b> ${escapeHtml(data.function_id ?? "unknown")}`,
            data.event?.name ? `<b>Trigger:</b> ${escapeHtml(data.event.name)}` : null,
            data.error?.message
                ? `<b>Error:</b> ${escapeHtml(data.error.name ? `${data.error.name}: ` : "")}${escapeHtml(String(data.error.message).slice(0, 800))}`
                : null,
            `<b>Time:</b> ${escapeHtml(occurredAt)}`,
            data.run_id
                ? `<a href="https://app.inngest.com/env/production/runs/${encodeURIComponent(data.run_id)}">Open run in Inngest</a>`
                : null,
        ].filter(Boolean);

        const messageId = await step.run("send-telegram-message", async () => {
            const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: lines.join("\n"),
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
        });

        return { sent: true, messageId, functionId: data.function_id ?? "unknown" };
    }
);

// Temporary alias so the route keeps building until it is updated.
export { notifyFailuresToTelegram as notifyFailuresToN8n };
