// routes/v1/patientStatusRoute.js
import express from "express";
import * as patientStatusController from "../../controllers/patientStatusController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  getPatientStatusSchema,
  updatePatientStatusSchema
} from "../../validation/patientStatusValidation.js";

const router = express.Router();

// View allowed to: super_admin, hospital, nurse, caregiver, family, patient
const CAN_VIEW = [
  "super_admin",
  "hospital",
  "nurse",
  "caregiver",
  "family",
  "patient"
];
// Update allowed to: super_admin, hospital, nurse
const CAN_UPDATE = ["super_admin", "hospital", "nurse"];

router.get(
  "/patients/:id/status",
  authenticate,
  authorize(CAN_VIEW),
  // validate(getPatientStatusSchema)  // if your validate middleware supports params, enable it
  patientStatusController.getPatientStatus
);

router.patch(
  "/patients/:id/status",
  authenticate,
  authorize(CAN_UPDATE),
  validate(updatePatientStatusSchema),
  patientStatusController.updatePatientStatus
);

export default router;
