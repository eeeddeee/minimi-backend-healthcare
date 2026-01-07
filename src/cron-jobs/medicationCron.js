import cron from "node-cron";
import { sendScheduledMedicationNotifications } from "../services/medicationService.js";

/**
 * Run every minute to check for medication reminders
 */
export const startMedicationCron = () => {
  // Run every 1 minute
  cron.schedule("* * * * *", async () => {
    console.log("\n⏰ Running medication reminder cron job...");
    try {
      const result = await sendScheduledMedicationNotifications();
      console.log(`✅ Medication cron completed:`, result);
    } catch (error) {
      console.error("❌ Medication cron error:", error);
    }
  });

  console.log("✅ Medication reminder cron job started (runs every 1 minute)");
};
