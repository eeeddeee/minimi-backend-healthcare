import express from "express";
import * as patientController from "../../controllers/patientController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import { uploadSingleImage } from "../../middleware/uploadMiddleware.js";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize(["super_admin", "hospital", "nurse"]),
  patientController.getPatients
);

router.get(
  "/:id",
  authenticate,
  authorize(["super_admin", "hospital", "nurse"]),
  patientController.getPatient
);

router.put(
  "/:id",
  authenticate,
  authorize(["super_admin", "hospital", "nurse"]),
  uploadSingleImage,
  patientController.updatePatient
);

router.patch(
  "/:id/status",
  authenticate,
  authorize(["super_admin", "hospital", "nurse"]),
  patientController.updatePatientStatus
);

router.post(
  "/get-nurse-patients",
  authenticate,
  authorize(["nurse"]),
  patientController.getNursePatients
);

router.post(
  "/get-caregiver-patients",
  authenticate,
  authorize(["caregiver"]),
  patientController.getCaregiverPatients
);

router.post(
  "/get-familymember-patients",
  authenticate,
  authorize(["family"]),
  patientController.getFamilyMemberPatients
);

export default router;
