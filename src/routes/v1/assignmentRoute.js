// routes/v1/assignmentRoute.js
import express from "express";
import * as assignmentController from "../../controllers/assignmentController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  assignCaregiverSchema,
  assignFamilyMemberSchema,
  unassignCaregiverSchema,
  unassignFamilyMemberSchema,
  listAssignmentsSchema,
  assignNurseSchema,
  unassignNurseSchema,
  assignCaregiverToNurseSchema,
  unassignCaregiverFromNurseSchema,
} from "../../validation/assignmentValidation.js";

const router = express.Router();

// Only within same hospital: hospital admin & nurses allowed (super_admin allowed too)
const ALLOWED = ["super_admin", "hospital", "nurse"];

// Nurse <-> Patient
router.post(
  "/nurse",
  authenticate,
  authorize(ALLOWED),
  validate(assignNurseSchema), // validation add below
  assignmentController.assignNurse
);

// Caregiver <-> Nurse
router.post(
  "/caregiver/assign-nurse",
  authenticate,
  authorize(ALLOWED),
  validate(assignCaregiverToNurseSchema),
  assignmentController.assignCaregiverToNurse
);

// Assign caregiver to patient
router.post(
  "/caregiver",
  authenticate,
  authorize(ALLOWED),
  validate(assignCaregiverSchema),
  assignmentController.assignCaregiver
);

// Assign family member to patient
router.post(
  "/family-member",
  authenticate,
  authorize(ALLOWED),
  validate(assignFamilyMemberSchema),
  assignmentController.assignFamilyMember
);

// Unassign caregiver
router.post(
  "/caregiver/unassign",
  authenticate,
  authorize(ALLOWED),
  validate(unassignCaregiverSchema),
  assignmentController.unassignCaregiver
);

// Unassign family member
router.post(
  "/family-member/unassign",
  authenticate,
  authorize(ALLOWED),
  validate(unassignFamilyMemberSchema),
  assignmentController.unassignFamilyMember
);

router.post(
  "/nurse/unassign",
  authenticate,
  authorize(ALLOWED),
  validate(unassignNurseSchema),
  assignmentController.unassignNurse
);

router.post(
  "/caregiver/unassign-nurse",
  authenticate,
  authorize(ALLOWED),
  validate(unassignCaregiverFromNurseSchema),
  assignmentController.unassignCaregiverFromNurse
);

// List all assignments for a patient
router.get(
  "/patient",
  authenticate,
  authorize(ALLOWED),
  validate(listAssignmentsSchema),
  assignmentController.listAssignments
);

export default router;
