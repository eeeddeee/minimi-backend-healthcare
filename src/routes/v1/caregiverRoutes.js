import express from "express";
import * as caregiverController from "../../controllers/caregiverController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import { uploadSingleImage } from "../../middleware/uploadMiddleware.js";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize(["super_admin", "hospital", "nurse"]),
  caregiverController.getCaregivers
);

router.get(
  "/:id",
  authenticate,
  authorize(["super_admin", "hospital", "nurse"]),
  caregiverController.getCaregiver
);

router.put(
  "/:id",
  authenticate,
  authorize(["super_admin", "hospital", "nurse","caregiver"]),
  uploadSingleImage,
  caregiverController.updateCaregiver
);

router.patch(
  "/:id/status",
  authenticate,
  authorize(["super_admin", "hospital"]),
  caregiverController.updateCaregiverStatus
);

router.post(
  "/get-nurse-caregivers",
  authenticate,
  authorize(["nurse"]),
  caregiverController.getCaregiversForNurse
);

// router.put("/caregiver/:id", caregiverController.updateCaregiverProfile);

export default router;
