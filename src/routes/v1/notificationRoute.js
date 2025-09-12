// routes/v1/notificationRoute.js
import express from "express";
import * as notificationController from "../../controllers/notificationController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  createNotificationSchema,
  queryNotificationsSchema,
  markReadSchema,
  acknowledgeSchema
} from "../../validation/notificationValidation.js";

const router = express.Router();

// All roles can view their own notifications
const CAN_VIEW = [
  "super_admin",
  "hospital",
  "nurse",
  "caregiver",
  "family",
  "patient"
];

// Create (optionally restrict to admins if exposing publicly)
router.post(
  "/",
  authenticate,
  authorize(["super_admin", "hospital"]),
  validate(createNotificationSchema),
  notificationController.create
);

// List my notifications
router.get(
  "/",
  authenticate,
  authorize(CAN_VIEW),
  validate(queryNotificationsSchema),
  notificationController.list
);

// Get one
router.get(
  "/:id",
  authenticate,
  authorize(CAN_VIEW),
  notificationController.getOne
);

// Mark read/unread
router.patch(
  "/:id/read",
  authenticate,
  authorize(CAN_VIEW),
  validate(markReadSchema),
  notificationController.setRead
);

// Mark all read (optional filter in body)
router.patch(
  "/read-all",
  authenticate,
  authorize(CAN_VIEW),
  notificationController.setAllRead
);

// Acknowledge
router.patch(
  "/:id/ack",
  authenticate,
  authorize(CAN_VIEW),
  validate(acknowledgeSchema),
  notificationController.acknowledge
);

// Soft delete
router.delete(
  "/:id",
  authenticate,
  authorize(CAN_VIEW),
  notificationController.remove
);

export default router;
