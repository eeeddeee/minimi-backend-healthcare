// src/services/fcmService.js
import { getFirebaseAdmin, isFCMAvailable } from "../config/fcmConfig.js";
import User from "../models/userModel.js";
import SystemLog from "../models/systemLogModel.js";

/**
 * Send FCM notification to a single device
 */
export const sendFCMToDevice = async (fcmToken, notification, data = {}) => {
  if (!isFCMAvailable()) {
    console.warn("FCM not available, skipping notification");
    return null;
  }

  if (!fcmToken) {
    console.warn("No FCM token provided");
    return null;
  }

  try {
    const admin = getFirebaseAdmin();

    const message = {
      token: fcmToken,
      notification: {
        title: notification.title,
        body: notification.message || notification.body,
      },
      data: {
        ...data,
        // Convert all data values to strings (FCM requirement)
        ...(data.notificationId && {
          notificationId: String(data.notificationId),
        }),
        ...(data.type && { type: String(data.type) }),
        ...(data.priority && { priority: String(data.priority) }),
        clickAction:
          data.deeplink || data.clickAction || "FLUTTER_NOTIFICATION_CLICK",
      },
      // Android specific config
      android: {
        priority: data.priority === "high" ? "high" : "normal",
        notification: {
          sound: "default",
          channelId: "minimi_notifications",
          priority: data.priority === "high" ? "high" : "default",
        },
      },
      // iOS specific config
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log("✅ FCM sent successfully:", response);
    return response;
  } catch (error) {
    console.error("❌ Error sending FCM:", error.message);

    // Handle invalid tokens
    if (
      error.code === "messaging/invalid-registration-token" ||
      error.code === "messaging/registration-token-not-registered"
    ) {
      console.log("Invalid FCM token, should remove from user");
      return { error: "invalid_token" };
    }

    return null;
  }
};

/**
 * Send FCM notification to multiple devices
 */
export const sendFCMToMultipleDevices = async (
  fcmTokens,
  notification,
  data = {}
) => {
  if (!isFCMAvailable() || !fcmTokens?.length) {
    return { success: 0, failure: 0 };
  }

  try {
    const admin = getFirebaseAdmin();

    const message = {
      tokens: fcmTokens,
      notification: {
        title: notification.title,
        body: notification.message || notification.body,
      },
      data: {
        ...data,
        notificationId: data.notificationId ? String(data.notificationId) : "",
        type: String(data.type || "system"),
        priority: String(data.priority || "normal"),
        clickAction: data.deeplink || "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: data.priority === "high" ? "high" : "normal",
        notification: {
          sound: "default",
          channelId: "minimi_notifications",
        },
      },
      apns: {
        payload: {
          aps: {
            sound: "default",
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(
      `✅ FCM multicast sent: ${response.successCount} success, ${response.failureCount} failed`
    );

    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(fcmTokens[idx]);
          console.error(`Failed token ${idx}:`, resp.error?.message);
        }
      });
    }

    return {
      success: response.successCount,
      failure: response.failureCount,
      responses: response.responses,
    };
  } catch (error) {
    console.error("❌ Error sending multicast FCM:", error.message);
    return { success: 0, failure: fcmTokens.length, error: error.message };
  }
};

/**
 * Send FCM to user(s) by fetching their FCM tokens from DB
 */
export const sendFCMToUsers = async (userIds = [], notification, data = {}) => {
  if (!userIds.length) return { success: 0, failure: 0 };

  try {
    // Fetch FCM tokens for all users
    const users = await User.find({
      _id: { $in: userIds },
      fcmToken: { $exists: true, $ne: null, $ne: "" },
      isDeleted: { $ne: true },
    })
      .select("_id fcmToken")
      .lean();

    if (!users.length) {
      console.log("No users with FCM tokens found");
      return { success: 0, failure: 0 };
    }

    const fcmTokens = users.map((u) => u.fcmToken).filter(Boolean);

    if (!fcmTokens.length) {
      console.log("No valid FCM tokens found");
      return { success: 0, failure: 0 };
    }

    const result = await sendFCMToMultipleDevices(
      fcmTokens,
      notification,
      data
    );

    // Log the notification send
    await SystemLog.create({
      action: "fcm_notification_sent",
      entityType: "FCM",
      performedBy: userIds[0], // first user as reference
      metadata: {
        userIds,
        title: notification.title,
        success: result.success,
        failure: result.failure,
      },
    });

    return result;
  } catch (error) {
    console.error("Error sending FCM to users:", error);
    return { success: 0, failure: userIds.length };
  }
};

/**
 * Send FCM notification to a single user
 */
export const sendFCMToUser = async (userId, notification, data = {}) => {
  if (!userId) return null;

  try {
    const user = await User.findById(userId).select("fcmToken").lean();

    if (!user?.fcmToken) {
      console.log(`User ${userId} has no FCM token`);
      return null;
    }

    return await sendFCMToDevice(user.fcmToken, notification, data);
  } catch (error) {
    console.error("Error sending FCM to user:", error);
    return null;
  }
};

/**
 * Subscribe user to topic (for bulk notifications)
 */
export const subscribeToTopic = async (fcmTokens, topic) => {
  if (!isFCMAvailable() || !fcmTokens?.length) return null;

  try {
    const admin = getFirebaseAdmin();
    const response = await admin.messaging().subscribeToTopic(fcmTokens, topic);
    console.log(`✅ Subscribed to topic ${topic}:`, response);
    return response;
  } catch (error) {
    console.error("Error subscribing to topic:", error);
    return null;
  }
};

/**
 * Unsubscribe user from topic
 */
export const unsubscribeFromTopic = async (fcmTokens, topic) => {
  if (!isFCMAvailable() || !fcmTokens?.length) return null;

  try {
    const admin = getFirebaseAdmin();
    const response = await admin
      .messaging()
      .unsubscribeFromTopic(fcmTokens, topic);
    console.log(`✅ Unsubscribed from topic ${topic}:`, response);
    return response;
  } catch (error) {
    console.error("Error unsubscribing from topic:", error);
    return null;
  }
};

/**
 * Send notification to a topic (e.g., all nurses, all hospitals)
 */
export const sendFCMToTopic = async (topic, notification, data = {}) => {
  if (!isFCMAvailable()) return null;

  try {
    const admin = getFirebaseAdmin();

    const message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.message || notification.body,
      },
      data: {
        ...data,
        type: String(data.type || "system"),
        clickAction: data.deeplink || "FLUTTER_NOTIFICATION_CLICK",
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ FCM sent to topic ${topic}:`, response);
    return response;
  } catch (error) {
    console.error("Error sending FCM to topic:", error);
    return null;
  }
};

export default {
  sendFCMToDevice,
  sendFCMToMultipleDevices,
  sendFCMToUsers,
  sendFCMToUser,
  subscribeToTopic,
  unsubscribeFromTopic,
  sendFCMToTopic,
};
