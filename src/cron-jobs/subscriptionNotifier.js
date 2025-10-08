import User from "../models/userModel.js";
import Notification from "../models/notificationModel.js";
import { notifyUser } from "../utils/notify.js";
import cron from "node-cron";

/**
 * Find hospital admins whose subscription ends in N days.
 */
const findEndingInDays = async (days) => {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const target = new Date(start);
  target.setUTCDate(target.getUTCDate() + days);

  const startOfTarget = new Date(target);
  const endOfTarget = new Date(target);
  endOfTarget.setUTCHours(23, 59, 59, 999);

  // Assuming role: "hospital" is your hospital admin role
  return User.find({
    role: "hospital",
    isDeleted: { $ne: true },
    "subscription.currentPeriodEnd": { $gte: startOfTarget, $lte: endOfTarget },
    "subscription.status": { $in: ["ACTIVE", "ACTIVE".toUpperCase()] },
  })
    .select("_id email subscription")
    .lean();
};

const ensureNotDuplicate = async (userId, periodEnd, tag) => {
  const exists = await Notification.findOne({
    userId,
    "data.kind": tag,
    "data.periodEnd": new Date(periodEnd),
    isDeleted: { $ne: true },
  }).lean();
  return !exists;
};

export const runExpirySweepOnce = async (daysList = [7, 3, 1]) => {
  for (const d of daysList) {
    const users = await findEndingInDays(d);
    for (const u of users) {
      const periodEnd =
        u.subscription?.currentPeriodEnd || u.subscription?.dueDate;
      if (!periodEnd) continue;

      const tag = `subscription_expiring_${d}d`;
      const ok = await ensureNotDuplicate(u._id, periodEnd, tag);
      if (!ok) continue;

      const autoRenew = u.subscription?.cancelAtPeriodEnd ? false : true;
      const title = autoRenew
        ? `Subscription renews in ${d} day(s)`
        : `Subscription expires in ${d} day(s)`;

      const message = autoRenew
        ? `Your subscription will auto-renew on ${new Date(periodEnd).toDateString()}.`
        : `Your subscription will expire on ${new Date(periodEnd).toDateString()}. Renew to continue service.`;

      await notifyUser({
        userId: u._id,
        type: "system",
        title,
        message,
        priority: d <= 3 ? "high" : "normal",
        data: {
          kind: tag,
          periodEnd: new Date(periodEnd),
          autoRenew,
          subscriptionId: u.subscription?.subscriptionId,
        },
      });
    }
  }
};

/**
 * Schedule daily at 09:00 Asia/Karachi
 */
export const scheduleExpirySweep = () => {
  // '0 9 * * *' is 09:00 every day server time; if your server is UTC,
  // adjust or use a TZ env: process.env.TZ = 'Asia/Karachi'
  cron.schedule("0 9 * * *", async () => {
    try {
      await runExpirySweepOnce([7, 3, 1]);
    } catch (e) {
      console.error("expiry sweep failed", e);
    }
  });
};

// export const scheduleExpirySweep = () => {
//   // This runs every 2 minutes continuously
//   cron.schedule("*/2 * * * *", async () => {
//     try {
//       await runExpirySweepOnce([7, 3, 1]);
//       console.log("✅ Expiry sweep executed (every 2 minutes)");
//     } catch (e) {
//       console.error("❌ Expiry sweep failed", e);
//     }
//   });
// };
