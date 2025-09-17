import express from "express";
import * as paymentController from "../../controllers/paymentController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";

const router = express.Router();

router.post(
  "/checkout",
  authenticate,
  authorize(["hospital"]),
  paymentController.proceedToCheckout
);

router.post(
  "/complete",
  authenticate,
  authorize(["hospital"]),
  paymentController.onCompleteCheckout
);

router.post(
  "/cancel-subscription",
  authenticate,
  authorize(["hospital"]),
  paymentController.cancelSubscription
);

router.get(
  "/history",
  authenticate,
  authorize(["super_admin","hospital"]),
  paymentController.getPaymentHistory
);

export default router;
