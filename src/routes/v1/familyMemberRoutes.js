import express from "express";
import * as familyMemberController from "../../controllers/familyMemberController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import { uploadSingleImage } from "../../middleware/uploadMiddleware.js";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorize(["super_admin", "hospital"]),
  familyMemberController.getFamilyMembers
);

router.get(
  "/:id",
  authenticate,
  authorize(["super_admin", "hospital"]),
  familyMemberController.getFamilyMember
);

router.put(
  "/:id",
  authenticate,
  authorize(["super_admin", "hospital", "nurse", "patient"]),
  uploadSingleImage,
  familyMemberController.updateFamilyMember
);

router.patch(
  "/:id/status",
  authenticate,
  authorize(["super_admin", "hospital"]),
  familyMemberController.updateFamilyMemberStatus
);

export default router;
