import Notification from "../models/notificationModel.js";
import User from "../models/userModel.js";
import { emitToUsers } from "../sockets/sockets.js";

export const notifyUsers = async ({
  userIds = [],
  type = "system",
  title,
  message,
  data = {},
  priority = "normal",
  emitEvent = "notification:new",
  emitCount = true,
}) => {
  if (!userIds.length) return [];

  const docs = userIds.map((id) => ({
    userId: id,
    type,
    title,
    message,
    data,
    priority,
  }));

  const created = await Notification.insertMany(docs, { ordered: false });

  userIds.forEach((uid, i) => {
    emitToUsers([uid], emitEvent, created[i]);

    if (emitCount) {
      emitToUsers([uid], "notification:count", { delta: 1 });
    }
  });

  return created;
};

export const notifySuperAdmins = async ({
  type = "system",
  title,
  message,
  data = {},
  priority = "normal",
  emitEvent = "notification:new",
}) => {
  const supers = await User.find({
    role: "super_admin",
    isDeleted: { $ne: true },
  })
    .select("_id")
    .lean();

  const ids = supers.map((u) => u._id);
  if (!ids.length) return [];

  return notifyUsers({
    userIds: ids,
    type,
    title,
    message,
    data,
    priority,
    emitEvent,
  });
};
