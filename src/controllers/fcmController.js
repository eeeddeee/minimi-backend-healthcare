// controllers/fcmController.js
import { StatusCodes } from "http-status-codes";
import User from "../models/userModel.js";
import SystemLog from "../models/systemLogModel.js";
import {
  subscribeToTopic,
  unsubscribeFromTopic,
} from "../services/fcmService.js";

/**
 * Register/Update FCM token for a user
 * POST /api/v1/fcm/register
 */
export const registerFCMToken = async (req, res) => {
  try {
    const { fcmToken } = req.body;
    const userId = req.user._id;

    if (!fcmToken) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: "FCM token is required" });
    }

    // Update user's FCM token
    const user = await User.findByIdAndUpdate(
      userId,
      {
        fcmToken,
        fcmTokenUpdatedAt: new Date(),
      },
      { new: true }
    ).select("_id fcmToken role");

    if (!user) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ success: false, message: "User not found" });
    }

    // Subscribe to role-based topic (optional)
    if (user.role) {
      await subscribeToTopic([fcmToken], `role_${user.role}`);
    }

    // Log the action
    await SystemLog.create({
      action: "fcm_token_registered",
      entityType: "User",
      entityId: userId,
      performedBy: userId,
      metadata: { role: user.role },
    });

    return res.success(
      "FCM token registered successfully",
      { fcmTokenRegistered: true },
      StatusCodes.OK
    );
  } catch (error) {
    console.error("Error registering FCM token:", error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to register FCM token" });
  }
};

/**
 * Remove FCM token for a user (on logout)
 * DELETE /api/v1/fcm/unregister
 */
export const unregisterFCMToken = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get current token before removing
    const user = await User.findById(userId).select("fcmToken role");

    if (user?.fcmToken && user.role) {
      // Unsubscribe from topics
      await unsubscribeFromTopic([user.fcmToken], `role_${user.role}`);
    }

    // Remove FCM token
    await User.findByIdAndUpdate(userId, {
      fcmToken: null,
      fcmTokenUpdatedAt: null,
    });

    await SystemLog.create({
      action: "fcm_token_unregistered",
      entityType: "User",
      entityId: userId,
      performedBy: userId,
    });

    return res.success(
      "FCM token unregistered successfully",
      { fcmTokenUnregistered: true },
      StatusCodes.OK
    );
  } catch (error) {
    console.error("Error unregistering FCM token:", error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to unregister FCM token" });
  }
};

/**
 * Get FCM token status
 * GET /api/v1/fcm/status
 */
export const getFCMTokenStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select(
      "fcmToken fcmTokenUpdatedAt"
    );

    return res.success(
      "FCM token status retrieved",
      {
        hasToken: !!user?.fcmToken,
        lastUpdated: user?.fcmTokenUpdatedAt,
      },
      StatusCodes.OK
    );
  } catch (error) {
    console.error("Error getting FCM token status:", error);
    return res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to get FCM token status" });
  }
};

export default {
  registerFCMToken,
  unregisterFCMToken,
  getFCMTokenStatus,
};
