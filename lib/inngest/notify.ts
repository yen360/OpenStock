import { inngest } from "@/lib/inngest/client";
import { escapeTelegramHtml as escapeHtml, sendTelegramMessage } from "@/lib/telegram";

// Full Inngest ID of this function (app id + function id). Used to skip our own
// failures so a broken Telegram setup can't trigger an endless notification loop.
const SELF_ID = "openStock-notify-failures-telegram";

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
        const chatId = process.env.TELEGRAM_CHAT_ID;
        if (!process.env.TELEGRAM_BOT_TOKEN || !chatId) {
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

        const messageId = await step.run("send-telegram-message", () =>
            sendTelegramMessage(chatId, lines.join("\n"))
        );

        return { sent: true, messageId, functionId: data.function_id ?? "unknown" };
    }
);
