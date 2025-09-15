import express from "express";
import * as activityController from "../../controllers/activityController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  createActivitySchema,
  updateActivitySchema,
  updateStatusSchema,
  updateOutcomeSchema,
  queryActivitiesSchema
} from "../../validation/activityValidation.js";

const router = express.Router();
const CAN_MANAGE = ["super_admin", "hospital", "nurse", "caregiver"];
const CAN_VIEW = [...CAN_MANAGE, "patient", "family"];

router.post(
  "/",
  authenticate,
  authorize(CAN_MANAGE),
  validate(createActivitySchema),
  activityController.createActivity
);

router.get(
  "/",
  authenticate,
  authorize(CAN_VIEW),
  validate(queryActivitiesSchema),
  activityController.getActivities
);

router.get(
  "/:id",
  authenticate,
  authorize(CAN_VIEW),
  activityController.getActivity
);

router.patch(
  "/:id",
  authenticate,
  authorize(CAN_MANAGE),
  validate(updateActivitySchema),
  activityController.updateActivity
);

router.patch(
  "/:id/status",
  authenticate,
  authorize(CAN_MANAGE),
  validate(updateStatusSchema),
  activityController.updateActivityStatus
);

router.patch(
  "/:id/outcome",
  authenticate,
  authorize(CAN_MANAGE),
  validate(updateOutcomeSchema),
  activityController.updateActivityOutcome
);

router.post(
  "/latest-activities-stats",
  authenticate,
  authorize(["hospital", "nurse"]),
  activityController.getHospitalLatestActivities
);

export default router;
