// routes/v1/fcmRoutes.js
import express from "express";
import { authenticate } from "../../middleware/authMiddleware.js";
import {
  registerFCMToken,
  unregisterFCMToken,
  getFCMTokenStatus,
} from "../../controllers/fcmController.js";
import validate from "../../middleware/validateMiddleware.js";
import Joi from "joi";

const router = express.Router();

// Validation schemas
const registerTokenSchema = Joi.object({
  fcmToken: Joi.string().required().min(10).max(500),
});

// Register FCM token
router.post(
  "/register",
  authenticate,
  validate(registerTokenSchema),
  registerFCMToken
);

// Unregister FCM token
router.delete("/unregister", authenticate, unregisterFCMToken);

// Get FCM token status
router.get("/status", authenticate, getFCMTokenStatus);

export default router;
