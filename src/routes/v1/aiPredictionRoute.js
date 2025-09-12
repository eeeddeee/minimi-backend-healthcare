import express from "express";
import * as aiController from "../../controllers/aiPredictionController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  createPredictionSchema,
  queryPredictionsSchema,
  updatePredictionSchema
} from "../../validation/aiPredictionValidation.js";

const router = express.Router();

const CAN_WRITE = ["super_admin", "hospital", "nurse", "caregiver"];
const CAN_VIEW = [...CAN_WRITE, "family", "patient"];

router.post(
  "/",
  authenticate,
  authorize(CAN_WRITE),
  validate(createPredictionSchema),
  aiController.createPrediction
);
router.get(
  "/",
  authenticate,
  authorize(CAN_VIEW),
  validate(queryPredictionsSchema),
  aiController.getPredictions
);
router.get(
  "/:id",
  authenticate,
  authorize(CAN_VIEW),
  aiController.getPrediction
);
router.patch(
  "/:id",
  authenticate,
  authorize(CAN_WRITE),
  validate(updatePredictionSchema),
  aiController.updatePrediction
);
router.patch(
  "/:id/notify",
  authenticate,
  authorize(CAN_WRITE),
  aiController.markNotified
);
router.get(
  "/latest/:patientId",
  authenticate,
  authorize(CAN_VIEW),
  aiController.getLatest
);

export default router;
