import express from "express";
import * as systemLogController from "../../controllers/systemLogController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import { queryLogsSchema } from "../../validation/systemLogValidation.js";

const router = express.Router();

// Restrict to super_admin and hospital admins
router.get(
  "/",
  authenticate,
  authorize(["super_admin", "hospital"]),
  validate(queryLogsSchema),
  systemLogController.getLogs
);

router.get(
  "/:id",
  authenticate,
  authorize(["super_admin", "hospital"]),
  systemLogController.getLog
);

export default router;
