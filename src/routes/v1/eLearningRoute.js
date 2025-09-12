// routes/v1/eLearningRoute.js
import express from "express";
import * as eLearningController from "../../controllers/eLearningController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  createResourceSchema,
  updateResourceSchema,
  queryResourcesSchema,
  markViewSchema,
  updateProgressSchema,
  submitFeedbackSchema,
  listFeedbackSchema
} from "../../validation/eLearningValidation.js";

const router = express.Router();

// Manage: super_admin, hospital (optionally allow nurse to create — tweak if needed)
const CAN_MANAGE = ["super_admin", "hospital"];
// View/Consume: all roles
const CAN_VIEW = [
  "super_admin",
  "hospital",
  "nurse",
  "caregiver",
  "family",
  "patient"
];

// Create resource
router.post(
  "/resources",
  authenticate,
  authorize(CAN_MANAGE),
  validate(createResourceSchema),
  eLearningController.createResource
);

// List resources
router.get(
  "/resources",
  authenticate,
  authorize(CAN_VIEW),
  validate(queryResourcesSchema),
  eLearningController.getResources
);

// Get resource
router.get(
  "/resources/:id",
  authenticate,
  authorize(CAN_VIEW),
  eLearningController.getResource
);

// Update resource
router.patch(
  "/resources/:id",
  authenticate,
  authorize(CAN_MANAGE),
  validate(updateResourceSchema),
  eLearningController.updateResource
);

// Activate/Deactivate
router.patch(
  "/resources/:id/active",
  authenticate,
  authorize(CAN_MANAGE),
  eLearningController.setActive
);

// Mark viewed (create/update progress)
router.post(
  "/resources/:id/view",
  authenticate,
  authorize(CAN_VIEW),
  validate(markViewSchema),
  eLearningController.markView
);

// Update progress
router.patch(
  "/resources/:id/progress",
  authenticate,
  authorize(CAN_VIEW),
  validate(updateProgressSchema),
  eLearningController.updateProgress
);

// Submit feedback (nurse/caregiver priority; but allow all viewers)
router.post(
  "/resources/:id/feedback",
  authenticate,
  authorize(CAN_VIEW),
  validate(submitFeedbackSchema),
  eLearningController.submitFeedback
);

router.get(
  "/resources/:id/feedback",
  authenticate,
  authorize(CAN_VIEW),
  validate(listFeedbackSchema),
  eLearningController.listFeedback
);

export default router;
