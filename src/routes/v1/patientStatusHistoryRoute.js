// routes/v1/patientStatusHistoryRoute.js
import express from "express";
import * as patientStatusHistoryController from "../../controllers/patientStatusHistoryController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
// If your validate middleware supports params, you can enable it
// import validate from "../../middleware/validateMiddleware.js";
// import { queryStatusHistorySchema } from "../../validation/patientStatusHistoryValidation.js";

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

router.get(
  "/patients/:id/status-history",
  authenticate,
  authorize(CAN_VIEW),
  // validate(queryStatusHistorySchema),
  patientStatusHistoryController.getPatientStatusHistory
);

export default router;
