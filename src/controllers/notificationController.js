// src/controllers/notificationController.js
import mongoose from "mongoose";
import Notification from "../models/notificationModel.js";
import { emitToUser } from "../sockets/sockets.js";

const asObjectId = (id) =>
  mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;

const ok = (res, message, data = {}, status = 200) => {
  // If you already have res.success helper, use that:
  if (typeof res.success === "function")
    return res.success(message, data, status);
  return res.status(status).json({ success: true, message, data });
};

const fail = (res, message = "Request failed", status = 400) => {
  return res.status(status).json({ success: false, message });
};

/**
 * GET /api/notifications
 * Query: page, limit, type, priority, isRead (true/false), since
 * Defaults: latest first, excludes isDeleted=true
 */
export const listNotifications = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return fail(res, "Unauthorized", 401);

    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "20", 10))
    );
    const skip = (page - 1) * limit;

    const filter = {
      userId,
      isDeleted: { $ne: true },
    };

    if (req.query.type) filter.type = req.query.type;
    if (req.query.priority) filter.priority = req.query.priority;

    if (typeof req.query.isRead !== "undefined") {
      filter.isRead = String(req.query.isRead).toLowerCase() === "true";
    }

    if (req.query.since) {
      const since = new Date(req.query.since);
      if (!isNaN(since)) filter.createdAt = { $gte: since };
    }

    const [items, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
    ]);

    return ok(res, "Notifications fetched", {
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    });
  } catch (err) {
    console.error("listNotifications error:", err);
    return fail(res, "Failed to fetch notifications", 500);
  }
};

/**
 * GET /api/notifications/counts
 * Returns unread counts (overall + by type)
 */
export const counts = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return fail(res, "Unauthorized", 401);

    const baseFilter = { userId, isDeleted: { $ne: true } };

    const [overallUnread, byTypeAgg] = await Promise.all([
      Notification.countDocuments({ ...baseFilter, isRead: false }),
      Notification.aggregate([
        { $match: { ...baseFilter, isRead: false } },
        { $group: { _id: "$type", count: { $sum: 1 } } },
      ]),
    ]);

    const byType = byTypeAgg.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    return ok(res, "Counts fetched", { overallUnread, byType });
  } catch (err) {
    console.error("counts error:", err);
    return fail(res, "Failed to fetch counts", 500);
  }
};

/**
 * PATCH /api/notifications/:id/read
 * Body: { isRead?: boolean }
 */
export const markRead = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    const oid = asObjectId(id);
    if (!userId) return fail(res, "Unauthorized", 401);
    if (!oid) return fail(res, "Invalid notification id");

    const isRead =
      typeof req.body?.isRead === "boolean" ? req.body.isRead : true;
    const update = {
      isRead,
      readAt: isRead ? new Date() : null,
    };

    const doc = await Notification.findOneAndUpdate(
      { _id: oid, userId, isDeleted: { $ne: true } },
      { $set: update },
      { new: true }
    ).lean();

    if (!doc) return fail(res, "Notification not found", 404);

    // Emit a small event so UI updates in real-time
    emitToUser(String(userId), "notification:updated", {
      _id: doc._id,
      isRead: doc.isRead,
      readAt: doc.readAt,
    });

    return ok(res, "Notification updated", { notification: doc });
  } catch (err) {
    console.error("markRead error:", err);
    return fail(res, "Failed to update notification", 500);
  }
};

/**
 * PATCH /api/notifications/read-all
 * Marks all as read for current user (optionally filter by type/priority)
 * Body: { type?, priority? }
 */
export const markAllRead = async (req, res) => {
  try {
    const rawUser = req.user?.id || req.user?._id;
    if (!rawUser) return fail(res, "Unauthorized", StatusCodes.UNAUTHORIZED);

    // Cast to ObjectId, but also support legacy string-stored userIds just in case
    const userIdObj = new mongoose.Types.ObjectId(String(rawUser));
    const userIdClause = { $in: [userIdObj, String(userIdObj)] };

    // Optional scoping
    const extra = {};
    if (req.body?.type) extra.type = req.body.type;
    if (req.body?.priority) extra.priority = req.body.priority;

    // Build filter (cover false OR missing isRead)
    const filter = {
      userId: userIdClause,
      isDeleted: { $ne: true },
      $or: [{ isRead: false }, { isRead: { $exists: false } }],
      ...extra,
    };

    const now = new Date();

    // Update with strong writeConcern to avoid reading stale data right after
    const result = await Notification.updateMany(
      filter,
      { $set: { isRead: true, readAt: now, updatedAt: now } },
      { writeConcern: { w: "majority" } }
    );

    // How many remain unread (for sanity + UI)
    const unreadLeft = await Notification.countDocuments({
      userId: userIdClause,
      isDeleted: { $ne: true },
      isRead: false,
      ...extra,
    });

    // Notify client to refresh badges/lists
    emitToUser(String(userIdObj), "notification:bulk-updated", {
      type: req.body?.type || null,
      priority: req.body?.priority || null,
      all: true,
      unreadLeft,
    });

    return ok(res, "All matching notifications marked as read", {
      matched: result.matchedCount ?? result.n,
      modified: result.modifiedCount ?? result.nModified,
      unreadLeft,
    });
  } catch (err) {
    console.error("markAllRead error:", err);
    return fail(
      res,
      "Failed to mark all as read",
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
};

/**
 * PATCH /api/notifications/:id/ack
 * Acknowledge explicitly (separate from read)
 */
export const acknowledge = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    const oid = asObjectId(id);
    if (!userId) return fail(res, "Unauthorized", 401);
    if (!oid) return fail(res, "Invalid notification id");

    const update = {
      isAcknowledged: true,
      acknowledgedAt: new Date(),
    };

    const doc = await Notification.findOneAndUpdate(
      { _id: oid, userId, isDeleted: { $ne: true } },
      { $set: update },
      { new: true }
    ).lean();

    if (!doc) return fail(res, "Notification not found", 404);

    emitToUser(String(userId), "notification:updated", {
      _id: doc._id,
      isAcknowledged: true,
      acknowledgedAt: doc.acknowledgedAt,
    });

    return ok(res, "Notification acknowledged", { notification: doc });
  } catch (err) {
    console.error("acknowledge error:", err);
    return fail(res, "Failed to acknowledge notification", 500);
  }
};

/**
 * DELETE /api/notifications/:id
 * Soft delete
 */
export const removeNotification = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    const { id } = req.params;
    const oid = asObjectId(id);
    if (!userId) return fail(res, "Unauthorized", 401);
    if (!oid) return fail(res, "Invalid notification id");

    const doc = await Notification.findOneAndUpdate(
      { _id: oid, userId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, updatedAt: new Date() } },
      { new: true }
    ).lean();

    if (!doc) return fail(res, "Notification not found", 404);

    emitToUser(String(userId), "notification:deleted", { _id: doc._id });

    return ok(res, "Notification deleted", { _id: doc._id });
  } catch (err) {
    console.error("removeNotification error:", err);
    return fail(res, "Failed to delete notification", 500);
  }
};

/**
 * GET /api/notifications/ai-risk/daily
 * Query:
 *  - date=YYYY-MM-DD (optional; default: today, UTC day window)
 *  - page (default 1)
 *  - limit (default 20, max 100)
 *  - patientId (optional: ek patient ke hisaab se filter)
 */
export const listDailyAIRisk = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return fail(res, "Unauthorized", 401);

    // Pagination
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "20", 10))
    );
    const skip = (page - 1) * limit;

    // Parse date (UTC day)
    const dateStr = (req.query.date || "").trim(); // YYYY-MM-DD
    let startUTC;
    if (dateStr) {
      const d = new Date(dateStr);
      if (isNaN(d)) return fail(res, "Invalid date (use YYYY-MM-DD)");
      startUTC = new Date(
        Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          0,
          0,
          0,
          0
        )
      );
    } else {
      const now = new Date();
      startUTC = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          0,
          0,
          0,
          0
        )
      );
    }
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

    // Optional patient filter
    const filter = {
      userId,
      type: "ai_risk",
      isDeleted: { $ne: true },
      createdAt: { $gte: startUTC, $lt: endUTC },
    };
    if (
      req.query.patientId &&
      mongoose.Types.ObjectId.isValid(req.query.patientId)
    ) {
      filter.patientId = new mongoose.Types.ObjectId(req.query.patientId);
    }

    const [items, total] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-__v")
        .lean(),
      Notification.countDocuments(filter),
    ]);

    return ok(res, "Daily AI risk notifications", {
      date: startUTC.toISOString().slice(0, 10),
      items,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + items.length < total,
    });
  } catch (err) {
    console.error("listDailyAIRisk error:", err);
    return fail(res, "Failed to fetch daily AI risk notifications", 500);
  }
};

// // controllers/notificationController.js
// import { StatusCodes } from "http-status-codes";
// import * as notificationService from "../services/notificationService.js";
// import { ensureAccessToPatient } from "../utils/accessControl.js";

// const error = (res, e, msg) =>
//   res.status(e.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
//     success: false,
//     message: e.message || msg
//   });

// // System/internal create (optionally exposed for admins)
// export const create = async (req, res) => {
//   try {
//     if (req.body.patientId) {
//       await ensureAccessToPatient(req.user, req.body.patientId);
//     }
//     const saved = await notificationService.createNotification(
//       req.body,
//       req.user._id
//     );
//     return res.success(
//       "Notification created.",
//       { notification: saved },
//       StatusCodes.CREATED
//     );
//   } catch (e) {
//     return error(res, e, "Failed to create notification");
//   }
// };

// // GET /notifications?patientId=&type=&unread=&from=&to=&page=&limit=
// export const list = async (req, res) => {
//   try {
//     if (req.query.patientId) {
//       await ensureAccessToPatient(req.user, req.query.patientId);
//     }
//     const result = await notificationService.listNotifications(
//       req.user._id,
//       req.query,
//       parseInt(req.query.page),
//       parseInt(req.query.limit)
//     );
//     return res.success(
//       "Notifications fetched successfully.",
//       result,
//       StatusCodes.OK
//     );
//   } catch (e) {
//     return error(res, e, "Failed to fetch notifications");
//   }
// };

// // GET /notifications/:id
// export const getOne = async (req, res) => {
//   try {
//     const n = await notificationService.getById(req.params.id, req.user._id);
//     if (n.patientId) await ensureAccessToPatient(req.user, n.patientId);
//     return res.success(
//       "Notification fetched successfully.",
//       { notification: n },
//       StatusCodes.OK
//     );
//   } catch (e) {
//     return error(res, e, "Failed to fetch notification");
//   }
// };

// // PATCH /notifications/:id/read
// export const setRead = async (req, res) => {
//   try {
//     const updated = await notificationService.markRead(
//       req.params.id,
//       req.user._id,
//       req.body.isRead
//     );
//     return res.success(
//       "Notification read state updated.",
//       { notification: updated },
//       StatusCodes.OK
//     );
//   } catch (e) {
//     return error(res, e, "Failed to update read state");
//   }
// };

// // PATCH /notifications/read-all
// export const setAllRead = async (req, res) => {
//   try {
//     // optional filters: patientId, type
//     if (req.body.patientId)
//       await ensureAccessToPatient(req.user, req.body.patientId);
//     const result = await notificationService.markAllRead(
//       req.user._id,
//       req.body || {}
//     );
//     return res.success(
//       "All notifications marked as read.",
//       result,
//       StatusCodes.OK
//     );
//   } catch (e) {
//     return error(res, e, "Failed to mark all read");
//   }
// };

// // PATCH /notifications/:id/ack
// export const acknowledge = async (req, res) => {
//   try {
//     const updated = await notificationService.acknowledge(
//       req.params.id,
//       req.user._id
//     );
//     return res.success(
//       "Notification acknowledged.",
//       { notification: updated },
//       StatusCodes.OK
//     );
//   } catch (e) {
//     return error(res, e, "Failed to acknowledge");
//   }
// };

// // DELETE /notifications/:id
// export const remove = async (req, res) => {
//   try {
//     const updated = await notificationService.softDelete(
//       req.params.id,
//       req.user._id
//     );
//     return res.success(
//       "Notification deleted.",
//       { notification: updated },
//       StatusCodes.OK
//     );
//   } catch (e) {
//     return error(res, e, "Failed to delete notification");
//   }
// };
