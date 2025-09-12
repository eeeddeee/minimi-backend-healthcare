// routes/v1/reportRoute.js
import express from "express";
import * as reportController from "../../controllers/reportController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  createReportSchema,
  queryReportsSchema,
  updateReportSchema,
  shareReportSchema
} from "../../validation/reportValidation.js";

const router = express.Router();

// View for all roles with patient access; Create/Update for hospital,nurse,caregiver,super_admin
const CAN_VIEW = [
  "super_admin",
  "hospital",
  "nurse",
  "caregiver",
  "family",
  "patient"
];
const CAN_EDIT = ["super_admin", "hospital", "nurse", "caregiver"];

// Create (generate)
router.post(
  "/",
  authenticate,
  authorize(CAN_EDIT),
  validate(createReportSchema),
  reportController.createReport
);

// List by patient
router.get(
  "/",
  authenticate,
  authorize(CAN_VIEW),
  validate(queryReportsSchema),
  reportController.getReports
);

// Get by id
router.get(
  "/:id",
  authenticate,
  authorize(CAN_VIEW),
  reportController.getReport
);

// Update
router.patch(
  "/:id",
  authenticate,
  authorize(CAN_EDIT),
  validate(updateReportSchema),
  reportController.updateReport
);

// Share
router.patch(
  "/:id/share",
  authenticate,
  authorize(CAN_EDIT),
  validate(shareReportSchema),
  reportController.shareReport
);

// Export PDF
router.get(
  "/:id/export",
  authenticate,
  authorize(CAN_VIEW),
  reportController.exportReport
);

export default router;
