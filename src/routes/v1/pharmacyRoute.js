import express from "express";
import * as pharmacyController from "../../controllers/pharmacyController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  searchMedSchema,
  createRxSchema
} from "../../validation/pharmacyValidation.js";

const router = express.Router();
const CAN_USE = ["super_admin", "hospital", "nurse", "caregiver"];

router.get(
  "/meds/search",
  authenticate,
  authorize(CAN_USE),
  validate(searchMedSchema),
  pharmacyController.searchMeds
);
router.post(
  "/prescriptions",
  authenticate,
  authorize(CAN_USE),
  validate(createRxSchema),
  pharmacyController.createOrder
);
router.get(
  "/prescriptions/:id",
  authenticate,
  authorize(CAN_USE),
  pharmacyController.getOrder
);

export default router;
