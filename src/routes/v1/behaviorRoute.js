// routes/v1/behaviorRoute.js
import express from "express";
import * as behaviorController from "../../controllers/behaviorController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  createBehaviorLogSchema,
  updateBehaviorLogSchema,
  queryBehaviorLogsSchema
} from "../../validation/behaviorValidation.js";

const router = express.Router();

const CAN_MANAGE = ["super_admin", "hospital", "nurse", "caregiver"];
const CAN_VIEW = [...CAN_MANAGE, "patient", "family"];

// Create
router.post(
  "/",
  authenticate,
  authorize(CAN_MANAGE),
  validate(createBehaviorLogSchema),
  behaviorController.createBehaviorLog
);

// List (patient-wise + filters)
router.get(
  "/",
  authenticate,
  authorize(CAN_VIEW),
  validate(queryBehaviorLogsSchema),
  behaviorController.getBehaviorLogs
);

// Get by id
router.get(
  "/:id",
  authenticate,
  authorize(CAN_VIEW),
  behaviorController.getBehaviorLog
);

// Update
router.patch(
  "/:id",
  authenticate,
  authorize(CAN_MANAGE),
  validate(updateBehaviorLogSchema),
  behaviorController.updateBehaviorLog
);

// INCIDENTS
router.post(
  "/:id/incidents",
  authenticate,
  authorize(CAN_MANAGE),
  behaviorController.addIncident
);

router.patch(
  "/:id/incidents/:incidentId",
  authenticate,
  authorize(CAN_MANAGE),
  behaviorController.updateIncident
);

// MEALS
router.post(
  "/:id/meals",
  authenticate,
  authorize(CAN_MANAGE),
  behaviorController.addMeal
);

router.patch(
  "/:id/meals/:mealId",
  authenticate,
  authorize(CAN_MANAGE),
  behaviorController.updateMeal
);

// ACTIVITIES
router.post(
  "/:id/activities",
  authenticate,
  authorize(CAN_MANAGE),
  behaviorController.addActivity
);

router.patch(
  "/:id/activities/:activityId",
  authenticate,
  authorize(CAN_MANAGE),
  behaviorController.updateActivity
);

export default router;
