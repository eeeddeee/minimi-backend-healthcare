import express from "express";
import * as nurseController from "../../controllers/nurseController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import { uploadSingleImage } from "../../middleware/uploadMiddleware.js";
// import validate from "../../middleware/validateMiddleware.js";
// import {
//   createNurseSchema,
//   updateNurseSchema
// } from "../../validation/nurseValidation.js";

const router = express.Router();

// GET all nurses (paginated)
router.get(
  "/",
  authenticate,
  authorize(["super_admin", "hospital"]),
  nurseController.getNurses
);

// GET single nurse by id
router.get(
  "/:id",
  authenticate,
  authorize(["super_admin", "hospital","nurse"]),
  nurseController.getNurse
);

router.put(
  "/:id",
  authenticate,
  authorize(["super_admin", "hospital","nurse"]),
  uploadSingleImage,
  nurseController.updateNurse
);

router.patch(
  "/:id/status",
  authenticate,
  authorize(["super_admin", "hospital"]),
  nurseController.updateNurseStatus
);

// router.patch(
//   "/:id/status",
//   authenticate,
//   authorize(["super_admin", "hospital"]),
//   nurseController.toggleNurseStatus
// );

// router.put("/nurse/:id", nurseController.updateNurseProfile);

// // UPDATE nurse
// router.patch(
//   "/:id",
//   authenticate,
//   authorize(["super_admin", "hospital"]),
//   validate(updateNurseSchema),
//   nurseController.updateNurse
// );

// // DEACTIVATE nurse (soft delete)
// router.patch(
//   "/deactivate/:id",
//   authenticate,
//   authorize(["super_admin", "hospital"]),
//   nurseController.deactivateNurse
// );

export default router;
