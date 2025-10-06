// services/notificationService.js
import Notification from "../models/notificationModel.js";
import SystemLog from "../models/systemLogModel.js";
import { sendEmail } from "../utils/emailService.js";
import {} from "../sockets/sockets.js";

export const createNotification = async (payload, createdBy) => {
  const doc = await Notification.create([{ ...payload }]);
  const saved = doc[0].toObject();

  await SystemLog.create({
    action: "notification_created",
    entityType: "Notification",
    entityId: saved._id,
    performedBy: createdBy || saved.userId,
    metadata: { type: saved.type, priority: saved.priority },
  });

  // optional email channel
  if (payload.channels?.email) {
    try {
      await sendEmail({
        to: payload.toEmail || undefined,
        subject: `[${saved.type.toUpperCase()}] ${saved.title}`,
        html: `<p>${saved.message}</p><pre>${JSON.stringify(saved.data || {}, null, 2)}</pre>`,
      });
    } catch (_) {
      // swallow email errors; in-app is primary channel
    }
  }

  return saved;
};

export const listNotifications = async (
  userId,
  filters = {},
  page = 1,
  limit = 20
) => {
  const skip = (page - 1) * limit;
  const q = { isDeleted: false, userId };

  if (filters.patientId) q.patientId = filters.patientId;
  if (filters.type) q.type = filters.type;
  if (typeof filters.unread === "boolean")
    q.isRead = !filters.unread ? undefined : false;
  if (filters.from || filters.to) {
    q.createdAt = {};
    if (filters.from) q.createdAt.$gte = new Date(filters.from);
    if (filters.to) q.createdAt.$lte = new Date(filters.to);
  }

  const [items, total] = await Promise.all([
    Notification.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .lean(),
    Notification.countDocuments(q),
  ]);

  await SystemLog.create({
    action: "notifications_viewed",
    entityType: "Notification",
    performedBy: userId,
    metadata: { filters, page, limit, count: items.length },
  });

  return {
    notifications: items,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

export const getById = async (id, userId) => {
  const n = await Notification.findOne({ _id: id, userId, isDeleted: false })
    .select("-__v")
    .lean();
  if (!n) throw { statusCode: 404, message: "Notification not found" };
  return n;
};

export const markRead = async (id, userId, isRead) => {
  const updated = await Notification.findOneAndUpdate(
    { _id: id, userId, isDeleted: false },
    {
      $set: { isRead, readAt: isRead ? new Date() : null },
      $currentDate: { updatedAt: true },
    },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated) throw { statusCode: 404, message: "Notification not found" };

  await SystemLog.create({
    action: isRead ? "notification_read" : "notification_unread",
    entityType: "Notification",
    entityId: id,
    performedBy: userId,
  });

  return updated;
};

export const markAllRead = async (userId, filters = {}) => {
  const q = { isDeleted: false, userId, isRead: false };
  if (filters.patientId) q.patientId = filters.patientId;
  if (filters.type) q.type = filters.type;

  const res = await Notification.updateMany(q, {
    $set: { isRead: true, readAt: new Date() },
    $currentDate: { updatedAt: true },
  });

  await SystemLog.create({
    action: "notifications_mark_all_read",
    entityType: "Notification",
    performedBy: userId,
    metadata: { matched: res.matchedCount, modified: res.modifiedCount },
  });

  return { matched: res.matchedCount, modified: res.modifiedCount };
};

export const acknowledge = async (id, userId) => {
  const updated = await Notification.findOneAndUpdate(
    { _id: id, userId, isDeleted: false },
    {
      $set: { isAcknowledged: true, acknowledgedAt: new Date() },
      $currentDate: { updatedAt: true },
    },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated) throw { statusCode: 404, message: "Notification not found" };

  await SystemLog.create({
    action: "notification_acknowledged",
    entityType: "Notification",
    entityId: id,
    performedBy: userId,
  });

  return updated;
};

export const softDelete = async (id, userId) => {
  const updated = await Notification.findOneAndUpdate(
    { _id: id, userId, isDeleted: false },
    { $set: { isDeleted: true }, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated) throw { statusCode: 404, message: "Notification not found" };

  await SystemLog.create({
    action: "notification_deleted",
    entityType: "Notification",
    entityId: id,
    performedBy: userId,
  });

  return updated;
};
