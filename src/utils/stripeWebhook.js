import Stripe from "stripe";
import User from "../models/userModel.js";
import Payment from "../models/paymentModel.js";
import { notifyUser } from "./notify.js";

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const stripeWebhook = async (req, res) => {
  let event;
  const sig = req.headers["stripe-signature"];

  try {
    event = stripe.webhooks.constructEvent(
      req.rawBody, // must use express.raw()
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Stripe webhook signature verify failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;
        if (invoice.billing_reason !== "subscription_cycle") break;

        const subscriptionId = invoice.subscription;

        const user =
          (await User.findOne({
            "subscription.subscriptionId": subscriptionId,
          })) ||
          (await Payment.findOne({ subscriptionId }).populate("user")).user;

        if (user) {
          const line = invoice.lines?.data?.[0];
          const periodEnd = line?.period?.end
            ? new Date(line.period.end * 1000)
            : user.subscription?.currentPeriodEnd;

          const amount = (invoice.amount_paid || 0) / 100;
          const currency = (invoice.currency || "usd").toUpperCase();

          await notifyUser({
            userId: user._id,
            type: "system",
            title: "Subscription auto-renewed",
            message: `Your subscription renewed successfully. Next renewal on ${
              periodEnd ? periodEnd.toDateString() : "—"
            }.`,
            priority: "normal",
            data: {
              kind: "subscription_renewed",
              subscriptionId,
              invoiceId: invoice.id,
              amount,
              currency,
              periodStart: line?.period?.start
                ? new Date(line.period.start * 1000)
                : null,
              periodEnd,
            },
          });

          if (periodEnd) {
            user.subscription.currentPeriodEnd = periodEnd;
            user.subscription.dueDate = periodEnd;
            await user.save();
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        if (invoice.billing_reason !== "subscription_cycle") break;

        const subscriptionId = invoice.subscription;
        const user = await User.findOne({
          "subscription.subscriptionId": subscriptionId,
        });
        if (user) {
          const amount = (invoice.amount_due || 0) / 100;
          const currency = (invoice.currency || "usd").toUpperCase();

          await notifyUser({
            userId: user._id,
            type: "system",
            title: "Auto-renewal failed",
            message: `We couldn't renew your subscription. Please update your payment method.`,
            priority: "high",
            data: {
              kind: "subscription_renew_failed",
              subscriptionId,
              invoiceId: invoice.id,
              amount,
              currency,
              nextAction: "update_payment_method",
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const user = await User.findOne({
          "subscription.subscriptionId": sub.id,
        });
        if (user) {
          user.subscription.cancelAtPeriodEnd = !!sub.cancel_at_period_end;
          user.subscription.currentPeriodEnd = sub.current_period_end
            ? new Date(sub.current_period_end * 1000)
            : user.subscription.currentPeriodEnd;
          await user.save();
        }
        break;
      }

      default:
        break;
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("stripeWebhook handler error:", err);
    return res.status(500).json({ success: false });
  }
};

export default stripeWebhook;
