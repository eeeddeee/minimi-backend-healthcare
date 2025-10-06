import express from "express";
import * as authController from "../../controllers/authController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../../validation/authValidation.js";

const router = express.Router();

router.post("/login", validate(loginSchema), authController.webLogin);
router.post("/login-mobile", validate(loginSchema), authController.mobileLogin);
router.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  authController.resetPassword
);

router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword
);
router.post("/logout", authenticate, authController.logout);

export default router;
