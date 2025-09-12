import express from "express";
import * as incidentController from "../../controllers/incidentController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import { uploadAttachments } from "../../middleware/attachmentUploadMiddleware.js";

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize(["nurse", "caregiver", "hospital", "super_admin"]),
  incidentController.createIncident
);
router.get(
  "/",
  authenticate,
  authorize([
    "nurse",
    "caregiver",
    "hospital",
    "super_admin",
    "patient",
    "family"
  ]),
  incidentController.getIncidents
);
router.get(
  "/:id",
  authenticate,
  authorize([
    "nurse",
    "caregiver",
    "hospital",
    "super_admin",
    "patient",
    "family"
  ]),
  incidentController.getIncident
);
router.patch(
  "/:id",
  authenticate,
  authorize(["nurse", "caregiver", "hospital", "super_admin"]),
  incidentController.updateIncident
);
router.patch(
  "/:id/status",
  authenticate,
  authorize(["nurse", "caregiver", "hospital", "super_admin"]),
  incidentController.updateIncidentStatus
);
router.post(
  "/:id/attachments",
  authenticate,
  authorize(["nurse", "caregiver", "hospital", "super_admin"]),
  uploadAttachments,
  incidentController.addAttachments
);

export default router;
