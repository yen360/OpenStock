import { inngest } from "@/lib/inngest/client";

// Full Inngest ID of this function (app id + function id). Used to skip our own
// failures so a broken webhook can't trigger an endless notification loop.
const SELF_ID = "openStock-notify-failures-n8n";

/**
 * Forwards every failed or cancelled Inngest run to an n8n webhook,
 * which relays it to Telegram. Set N8N_FAILURE_WEBHOOK_URL in Vercel.
 */
export const notifyFailuresToN8n = inngest.createFunction(
    { id: "notify-failures-n8n", retries: 2 },
    [
        { event: "inngest/function.failed", if: `event.data.function_id != '${SELF_ID}'` },
        { event: "inngest/function.cancelled", if: `event.data.function_id != '${SELF_ID}'` },
    ],
    async ({ event, step }) => {
        const webhookUrl = process.env.N8N_FAILURE_WEBHOOK_URL;
        if (!webhookUrl) {
            return { skipped: true, reason: "N8N_FAILURE_WEBHOOK_URL is not set" };
        }

        const data = (event.data ?? {}) as {
            function_id?: string;
            run_id?: string;
            error?: { name?: string; message?: string };
            event?: { name?: string };
        };
        const payload = {
            type: event.name === "inngest/function.cancelled" ? "cancelled" : "failed",
            functionId: data.function_id ?? "unknown",
            runId: data.run_id ?? "unknown",
            errorName: data.error?.name ?? null,
            errorMessage: data.error?.message ?? null,
            triggerEvent: data.event?.name ?? null,
            occurredAt: new Date(event.ts ?? Date.now()).toISOString(),
            runUrl: data.run_id ? `https://app.inngest.com/env/production/runs/${data.run_id}` : null,
            app: "OpenStock",
        };

        const status = await step.run("post-to-n8n", async () => {
            const res = await fetch(webhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`n8n webhook responded ${res.status}`);
            return res.status;
        });

        return { forwarded: true, status, functionId: payload.functionId };
    }
);
