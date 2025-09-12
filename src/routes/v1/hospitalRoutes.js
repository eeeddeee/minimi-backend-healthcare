import express from "express";
import * as hospitalController from "../../controllers/hospitalController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import { uploadSingleImage } from "../../middleware/uploadMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  createHospitalSchema,
  updateHospitalSchema
} from "../../validation/hospitalValidation.js";

const router = express.Router();

// router.use(authenticate);
// router.use(authorize("super_admin"));

router.get(
  "/",
  authenticate,
  authorize(["super_admin"]),
  hospitalController.getHospitals
);
router.get("/:id",authenticate,
  authorize(["super_admin", "hospital"]), hospitalController.getHospital);

  router.put(
    "/:id",
    authenticate,
    authorize(["super_admin", "hospital"]),
    uploadSingleImage, // for profile_image
    // validate(updateHospital) // optional if schema exists
    hospitalController.updateHospital
  );

  router.patch(
    "/:id/status",
    authenticate,
    authorize(["super_admin"]),
    hospitalController.updateHospitalStatus
  );

// router.put("/hospital/:id", hospitalController.updateHospitalProfile);



// router.patch(
//   "/:id",
//   authenticate,
//   authorize(["super_admin", "hospital"]),
//   validate(updateHospitalSchema),
//   hospitalController.updateHospital
// );

// router.patch(
//   "/deactivate/:id",
//   authenticate,
//   authorize(["super_admin"]),
//   hospitalController.deleteHospital
// );



export default router;
