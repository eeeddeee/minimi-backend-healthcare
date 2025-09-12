import express from "express";
import * as medicationController from "../../controllers/medicationController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  createReminderSchema,
  updateReminderSchema,
  updateStatusSchema,
  queryRemindersSchema,
  addLogSchema,
  queryLogsSchema,
  updateLogSchema
} from "../../validation/medicationValidation.js";

const router = express.Router();

// Roles allowed on medication endpoints
const CAN_MANAGE = [
  "super_admin",
  "hospital",
  "nurse",
  "caregiver",
  "patient",
  "family"
];

// Create plan
router.post(
  "/reminders",
  authenticate,
  authorize(CAN_MANAGE),
  validate(createReminderSchema),
  medicationController.createReminder
);

// List plans (by patient)
router.get(
  "/reminders",
  authenticate,
  authorize(CAN_MANAGE),
  validate(queryRemindersSchema),
  medicationController.getReminders
);

// Get single
router.get(
  "/reminders/:id",
  authenticate,
  authorize(CAN_MANAGE),
  medicationController.getReminder
);

// Update plan
router.patch(
  "/reminders/:id",
  authenticate,
  authorize(CAN_MANAGE),
  validate(updateReminderSchema),
  medicationController.updateReminder
);

// Update status
router.patch(
  "/reminders/:id/status",
  authenticate,
  authorize(CAN_MANAGE),
  validate(updateStatusSchema),
  medicationController.updateReminderStatus
);

// Add log
router.post(
  "/reminders/:id/logs",
  authenticate,
  authorize(CAN_MANAGE),
  validate(addLogSchema),
  medicationController.addReminderLog
);

// Get logs (paginated)
router.get(
  "/reminders/:id/logs",
  authenticate,
  authorize(CAN_MANAGE),
  validate(queryLogsSchema),
  medicationController.getReminderLogs
);

// Update a log
router.patch(
  "/reminder-logs/:logId",
  authenticate,
  authorize(CAN_MANAGE),
  validate(updateLogSchema),
  medicationController.updateReminderLog
);

export default router;
