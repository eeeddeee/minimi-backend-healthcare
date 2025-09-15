import express from "express";
import * as userController from "../../controllers/userController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import { uploadSingleImage } from "../../middleware/uploadMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  nurseSchema,
  caregiverSchema,
  familyMemberSchema,
  patientSchema,
  hospitalSchema
} from "../../validation/userValidation.js";

const router = express.Router();

router.post(
  "/hospital-admin",
  authenticate,
  authorize(["super_admin"]),
  validate(hospitalSchema),
  userController.registerHospitalAdmin
);

router.post(
  "/nurses",
  authenticate,
  authorize(["hospital"]),
  validate(nurseSchema),
  userController.registerNurse
);

// Caregiver Registration (Hospital Admin or Nurse)
router.post(
  "/caregivers",
  authenticate,
  authorize(["hospital", "nurse"]),
  validate(caregiverSchema),
  userController.registerCaregiver
);

// Patient Registration (Hospital Admin or Nurse)
router.post(
  "/patients",
  authenticate,
  authorize(["hospital", "nurse", "patient"]),
  validate(patientSchema),
  userController.registerPatient
);

// Family Member Registration (Hospital Admin, Nurse, or Patient)
router.post(
  "/family-members",
  authenticate,
  authorize(["hospital", "nurse", "patient"]),
  validate(familyMemberSchema),
  userController.registerFamilyMember
);

router.put(
  "/profile-update",
  authenticate,
  uploadSingleImage,
  userController.updateUserProfile
);

router.get(
  "/stats",
  authenticate,
  authorize(["super_admin", "hospital", "nurse","caregiver"]),
  userController.getUserStatsByRole
);

router.get(
  "/all-stats",
  authenticate,
  authorize(["super_admin"]),
  userController.getUserStatsForAdmin
);

router.get(
  "/hospital-graph-stats",
  authenticate,
  authorize(["super_admin"]),
  userController.getHospitalStatsByDate
);

router.get(
  "/hospital-cards-stats",
  authenticate,
  authorize(["hospital"]),
  userController.getHospitalStats
);

router.get(
  "/nurse-cards-stats",
  authenticate,
  authorize(["nurse"]),
  userController.getNurseStats
);


router.post(
  "/get-nurses",
  authenticate,
  authorize(["super_admin"]),
  userController.getNurses
);
router.post(
  "/get-caregivers",
  authenticate,
  authorize(["super_admin"]),
  userController.getCaregivers
);
router.post(
  "/get-families",
  authenticate,
  authorize(["super_admin"]),
  userController.getFamilies
);
router.post(
  "/get-patients",
  authenticate,
  authorize(["super_admin"]),
  userController.getPatients
);


export default router;
