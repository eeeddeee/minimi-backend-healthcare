import express from "express";
import * as patientDashboardController from "../../controllers/dashboardController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";

const router = express.Router();

// Roles allowed to access patient dashboard
const ALLOWED_ROLES = [
  "super_admin",
  "hospital",
  "nurse",
  "caregiver",
  "family",
  "patient",
];

// Get specific patient dashboard
router.get(
  "/",
  authenticate,
  authorize(ALLOWED_ROLES),
  patientDashboardController.getUserDashboard
);

router.get(
  "/:patientId/daily",
  authenticate,
  authorize(ALLOWED_ROLES),
  patientDashboardController.getPatientDailyTracking
);

// // Get dashboard for all assigned patients (for caregivers/family)
// router.get(
//   "/",
//   authenticate,
//   authorize(["caregiver", "family"]),
//   patientDashboardController.getAssignedPatientsDashboard
// );

export default router;
