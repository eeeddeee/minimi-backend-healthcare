import express from "express";
import * as dailyJournalController from "../../controllers/dailyJournalController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  createJournalSchema,
  updateJournalSchema,
  queryJournalSchema,
  addActivitySchema,
  updateActivitySchema,
  addNoteSchema,
  updateNoteSchema
} from "../../validation/dailyJournalValidation.js";

const router = express.Router();

const CAN_MANAGE = ["super_admin", "hospital", "nurse", "caregiver"];
const CAN_VIEW = [...CAN_MANAGE, "patient", "family"];

// Create
router.post(
  "/",
  authenticate,
  authorize(CAN_MANAGE),
  validate(createJournalSchema),
  dailyJournalController.createJournal
);

// List by patient
router.get(
  "/",
  authenticate,
  authorize(CAN_VIEW),
  validate(queryJournalSchema),
  dailyJournalController.getJournals
);

// Get by id
router.get(
  "/:id",
  authenticate,
  authorize(CAN_VIEW),
  dailyJournalController.getJournal
);

// Update
router.patch(
  "/:id",
  authenticate,
  authorize(CAN_MANAGE),
  validate(updateJournalSchema),
  dailyJournalController.updateJournal
);

// Soft delete
router.delete(
  "/:id",
  authenticate,
  authorize(CAN_MANAGE),
  dailyJournalController.deleteJournal
);

// Sub-updates
router.post(
  "/:id/activities",
  authenticate,
  authorize(CAN_MANAGE),
  validate(addActivitySchema),
  dailyJournalController.addActivity
);

router.patch(
  "/:id/activities/:activityId",
  authenticate,
  authorize(CAN_MANAGE),
  validate(updateActivitySchema),
  dailyJournalController.updateActivity
);

router.post(
  "/:id/notes",
  authenticate,
  authorize(CAN_MANAGE),
  validate(addNoteSchema),
  dailyJournalController.addNote
);

router.patch(
  "/:id/notes/:noteId",
  authenticate,
  authorize(CAN_MANAGE),
  validate(updateNoteSchema),
  dailyJournalController.updateNote
);

export default router;
