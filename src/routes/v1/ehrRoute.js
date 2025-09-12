import express from "express";
import * as ehrController from "../../controllers/ehrController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import { importFhirSchema } from "../../validation/ehrValidation.js";

const router = express.Router();
const CAN_USE = ["super_admin", "hospital", "nurse"]; // reading/export for clinical; add caregiver if needed
const CAN_VIEW = [
  "super_admin",
  "hospital",
  "nurse",
  "caregiver",
  "family",
  "patient"
]; // export view response too

router.get(
  "/patients/:patientId/fhir",
  authenticate,
  authorize(CAN_VIEW),
  ehrController.exportFhir
);
router.post(
  "/patients/:patientId/fhir",
  authenticate,
  authorize(CAN_USE),
  validate(importFhirSchema),
  ehrController.importFhir
);

export default router;
