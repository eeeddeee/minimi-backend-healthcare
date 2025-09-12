import express from "express";
import * as adminStatsController from "../../controllers/adminStatsController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";

const router = express.Router();

// Restrict to super_admin + hospital admins (you can add 'hospital' role)
router.get(
  "/overview",
  authenticate,
  authorize(["super_admin", "hospital"]),
  adminStatsController.getOverview
);

export default router;
