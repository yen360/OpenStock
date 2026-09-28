import { inngest } from "@/lib/inngest/client";

/**
 * Read-only check that OpenStock's Kit (ConvertKit) keys work.
 * Invoke it manually from the Inngest dashboard. It never sends email:
 * it only reads the account, forms and subscriber count.
 */
export const checkKitConnection = inngest.createFunction(
    { id: "kit-health-check", retries: 0 },
    { event: "app/kit.health-check" },
    async ({ step }) => {
        return await step.run("check-kit-api", async () => {
            const apiKey = process.env.KIT_API_KEY;
            const apiSecret = process.env.KIT_API_SECRET;
            const result: Record<string, unknown> = {
                hasApiKey: Boolean(apiKey),
                hasApiSecret: Boolean(apiSecret),
            };
            if (!apiKey || !apiSecret) {
                throw new Error("KIT_API_KEY or KIT_API_SECRET is not set in Vercel");
            }

            const get = async (path: string, params: Record<string, string>) => {
                const url = `https://api.convertkit.com/v3/${path}?${new URLSearchParams(params)}`;
                const res = await fetch(url, { headers: { Accept: "application/json" } });
                const body = await res.json().catch(() => ({}));
                return { ok: res.ok, status: res.status, body };
            };

            // API secret: account details
            const account = await get("account", { api_secret: apiSecret });
            result.secretCheck = account.ok
                ? { ok: true, accountName: account.body.name, primaryEmail: account.body.primary_email_address }
                : { ok: false, status: account.status, error: account.body.error ?? account.body.message };

            // API key: list forms
            const forms = await get("forms", { api_key: apiKey });
            result.keyCheck = forms.ok
                ? { ok: true, forms: (forms.body.forms ?? []).length }
                : { ok: false, status: forms.status, error: forms.body.error ?? forms.body.message };

            // API secret: subscriber count (what the weekly newsletter reaches)
            const subs = await get("subscribers", { api_secret: apiSecret });
            result.subscribers = subs.ok ? subs.body.total_subscribers : { status: subs.status };

            if (!account.ok || !forms.ok) {
                throw new Error(`Kit check failed: ${JSON.stringify(result)}`);
            }
            return result;
        });
    }
);
