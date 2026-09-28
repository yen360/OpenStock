import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { sendWeeklyNewsSummary, sendSignUpEmail, checkStockAlerts, checkInactiveUsers } from "@/lib/inngest/functions";
import { notifyFailuresToTelegram } from "@/lib/inngest/notify";
import { checkKitConnection } from "@/lib/inngest/kit-check";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [sendSignUpEmail, sendWeeklyNewsSummary, checkStockAlerts, checkInactiveUsers, notifyFailuresToTelegram, checkKitConnection],
})
