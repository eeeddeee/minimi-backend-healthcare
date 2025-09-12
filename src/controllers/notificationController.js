// controllers/notificationController.js
import { StatusCodes } from "http-status-codes";
import * as notificationService from "../services/notificationService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";

const error = (res, e, msg) =>
  res.status(e.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: e.message || msg
  });

// System/internal create (optionally exposed for admins)
export const create = async (req, res) => {
  try {
    if (req.body.patientId) {
      await ensureAccessToPatient(req.user, req.body.patientId);
    }
    const saved = await notificationService.createNotification(
      req.body,
      req.user._id
    );
    return res.success(
      "Notification created.",
      { notification: saved },
      StatusCodes.CREATED
    );
  } catch (e) {
    return error(res, e, "Failed to create notification");
  }
};

// GET /notifications?patientId=&type=&unread=&from=&to=&page=&limit=
export const list = async (req, res) => {
  try {
    if (req.query.patientId) {
      await ensureAccessToPatient(req.user, req.query.patientId);
    }
    const result = await notificationService.listNotifications(
      req.user._id,
      req.query,
      parseInt(req.query.page),
      parseInt(req.query.limit)
    );
    return res.success(
      "Notifications fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (e) {
    return error(res, e, "Failed to fetch notifications");
  }
};

// GET /notifications/:id
export const getOne = async (req, res) => {
  try {
    const n = await notificationService.getById(req.params.id, req.user._id);
    if (n.patientId) await ensureAccessToPatient(req.user, n.patientId);
    return res.success(
      "Notification fetched successfully.",
      { notification: n },
      StatusCodes.OK
    );
  } catch (e) {
    return error(res, e, "Failed to fetch notification");
  }
};

// PATCH /notifications/:id/read
export const setRead = async (req, res) => {
  try {
    const updated = await notificationService.markRead(
      req.params.id,
      req.user._id,
      req.body.isRead
    );
    return res.success(
      "Notification read state updated.",
      { notification: updated },
      StatusCodes.OK
    );
  } catch (e) {
    return error(res, e, "Failed to update read state");
  }
};

// PATCH /notifications/read-all
export const setAllRead = async (req, res) => {
  try {
    // optional filters: patientId, type
    if (req.body.patientId)
      await ensureAccessToPatient(req.user, req.body.patientId);
    const result = await notificationService.markAllRead(
      req.user._id,
      req.body || {}
    );
    return res.success(
      "All notifications marked as read.",
      result,
      StatusCodes.OK
    );
  } catch (e) {
    return error(res, e, "Failed to mark all read");
  }
};

// PATCH /notifications/:id/ack
export const acknowledge = async (req, res) => {
  try {
    const updated = await notificationService.acknowledge(
      req.params.id,
      req.user._id
    );
    return res.success(
      "Notification acknowledged.",
      { notification: updated },
      StatusCodes.OK
    );
  } catch (e) {
    return error(res, e, "Failed to acknowledge");
  }
};

// DELETE /notifications/:id
export const remove = async (req, res) => {
  try {
    const updated = await notificationService.softDelete(
      req.params.id,
      req.user._id
    );
    return res.success(
      "Notification deleted.",
      { notification: updated },
      StatusCodes.OK
    );
  } catch (e) {
    return error(res, e, "Failed to delete notification");
  }
};
