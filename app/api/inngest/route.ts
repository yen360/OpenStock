import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { sendWeeklyNewsSummary, sendSignUpEmail, checkStockAlerts, checkInactiveUsers } from "@/lib/inngest/functions";
import { notifyFailuresToN8n } from "@/lib/inngest/notify";

export const { GET, POST, PUT } = serve({
    client: inngest,
    functions: [sendSignUpEmail, sendWeeklyNewsSummary, checkStockAlerts, checkInactiveUsers, notifyFailuresToN8n],
})
