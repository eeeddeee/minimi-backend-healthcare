import Stripe from "stripe";
import { StatusCodes } from "http-status-codes";

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

import Payment from "../models/paymentModel.js";
import User from "../models/userModel.js";

const PRICE_ID = "price_1S8KTOE9a5VG73DdrDo6ddEG"; 

export const proceedToCheckout = async (req, res) => {
  try {
    if (!req.user?.email) {
      return res.status(400).json({ status: 400, message: "User email missing." });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.CLIENT_URL}/hospital/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/hospital/payment-cancel`,
      customer_email: req.user.email,
    });

    await Payment.create({
      user: req.user._id,
      email: req.user.email,
      sessionId: session.id,
      amount: 0,
      currency: "usd",
      status: "PENDING",
    });

 return res.success(
      "Proceeding to subscription checkout...",
      {
        redirectUrl: session.url,
        sessionId: session.id,
      },
      StatusCodes.OK
    );
  } catch (error) {
    console.error("Checkout Error:", error);
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message || "Checkout failed.",
      });
  }
};


export const onCompleteCheckout = async (req, res) => {
  try {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ status: 400, message: "Session ID is required." });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription"],
    });

    if (session.payment_status !== "paid") {
      return res.status(400).json({ status: 400, message: "Payment not completed successfully." });
    }

    let subscription = session.subscription;

    if (typeof subscription === "string") {
      subscription = await stripe.subscriptions.retrieve(subscription);
    }

    const firstItem = subscription.items.data[0];
    const currentPeriodStart = firstItem?.current_period_start;
    const currentPeriodEnd = firstItem?.current_period_end;

    const payment = await Payment.findOneAndUpdate(
      { sessionId: session_id },
      {
        status: "ACTIVE",
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency || "usd",
        subscriptionId: subscription.id,
        startDate: currentPeriodStart
          ? new Date(currentPeriodStart * 1000)
          : null,
        dueDate: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000)
          : null,
      },
      { new: true }
    );

    if (!payment) {
      return res.status(404).json({ status: 404, message: "Payment record not found." });
    }

    const user = await User.findById(payment.user);
    if (user) {
      user.isPayment = true;
      user.subscription = {
        subscriptionId: subscription.id,
        status: subscription.status.toUpperCase() || "ACTIVE",
        currentPeriodEnd: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000)
          : null,
      };
      await user.save();
    }

 return res.success(
      "Subscription successfully created.",
      { session, subscription, payment },
      StatusCodes.OK
    );

  } catch (error) {
    console.error("Complete Checkout Error:", error);
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message || "Failed to complete checkout.",
      });
  }
};

export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user || !user.subscription || !user.subscription.subscriptionId) {
      return res.status(404).json({ status: 404, message: "User has no active subscription." });
    }

    const subscriptionId = user.subscription.subscriptionId;

    const subscription = await stripe.subscriptions.retrieve(subscriptionId).catch(() => null);
    if (!subscription) {
      return res.status(404).json({
        status: 404,
        message: `No such subscription found on Stripe: ${subscriptionId}`,
      });
    }

    const canceled = await stripe.subscriptions.cancel(subscriptionId);

    await Payment.findOneAndUpdate(
      { user: userId, subscriptionId },
      { status: "CANCELLED" },
      { new: true }
    );

    user.subscription.status = "CANCELLED";
    user.subscription.currentPeriodEnd = canceled.current_period_end
      ? new Date(canceled.current_period_end * 1000)
      : new Date();
    user.isPayment = false;
    await user.save();

    res.status(200).json({
      status: 200,
      message: "Subscription successfully cancelled.",
      data: canceled,
    });
  } catch (error) {
    console.error("Cancel Error:", error);
    res.status(500).json({ status: 500, message: "Failed to cancel subscription." });
  }
};

export const getPaymentHistory = async (req, res) => {
  try {
    if (!req.user?._id) {
      return res
        .status(400)
        .json({ status: 400, message: "User ID missing." });
    }

    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let filter = {};

    if (req.user.role === "super_admin") {
      filter = {};
    } else if (req.user.role === "hospital") {
      filter = { user: req.user._id };
    } else {
      return res.status(403).json({
        status: 403,
        message: "You are not authorized to view payment history.",
      });
    }

    const total = await Payment.countDocuments(filter);

    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.success(
      "Payment history fetched successfully.",
      {
        payments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message || "Failed to fetch payment history.",
      });
  }
};


// export const getPaymentHistory = async (req, res) => {
//   try {
//     if (!req.user?._id) {
//       return res.status(400).json({ status: 400, message: "User ID missing." });
//     }

//     let payments;

//     if (req.user.role === "super_admin") {
//       payments = await Payment.find().sort({ createdAt: -1 });
//     } else if (req.user.role === "hospital") {
//       payments = await Payment.find({ user: req.user._id }).sort({ createdAt: -1 });
//     } else {
//       return res.status(403).json({
//         status: 403,
//         message: "You are not authorized to view payment history.",
//       });
//     }

//     return res.success("Payment history fetched successfully.", payments, StatusCodes.OK);

//   } catch (error) {
//     return res
//       .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
//       .json({
//         success: false,
//         message: error.message || "Failed to fetch payment history.",
//       });
//   }
// };