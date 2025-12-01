// cron-jobs/activityScheduler.js
import cron from "node-cron";
import { sendScheduledActivityNotifications } from "../services/activityService.js";

/**
 * Cron job to check and send notifications for scheduled activities
 * Runs every 5 minutes
 */
export const scheduleActivityNotifications = () => {
  // Run every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    const now = new Date().toLocaleTimeString();
    console.log(`\n⏰ [${now}] Running activity scheduler...`);

    try {
      await sendScheduledActivityNotifications();
    } catch (error) {
      console.error("❌ Activity scheduler error:", error);
    }
  });

  console.log(
    "✅ Activity notification scheduler started (runs every 5 minutes)"
  );
};

/**
 * Optional: Run immediately on server start to catch any missed notifications
 */
export const runInitialActivityCheck = async () => {
  console.log("\n🔄 Running initial activity notification check...");
  try {
    await sendScheduledActivityNotifications();
    console.log("✅ Initial activity check completed");
  } catch (error) {
    console.error("❌ Initial activity check failed:", error);
  }
};

export default {
  scheduleActivityNotifications,
  runInitialActivityCheck,
};
