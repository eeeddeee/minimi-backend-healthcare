import express from "express";
import * as messagingController from "../../controllers/messagingController.js";
import { authenticate, authorize } from "../../middleware/authMiddleware.js";
import validate from "../../middleware/validateMiddleware.js";
import {
  createThreadSchema,
  queryThreadsSchema,
  getThreadSchema,
  postMessageSchema,
  paginateMessagesSchema,
  markReadSchema
} from "../../validation/messagingValidation.js";
import { uploadAttachments } from "../../middleware/attachmentUploadMiddleware.js";

const router = express.Router();

// Roles allowed to use messaging
// Super admin, hospital, nurse, caregiver, family, patient (all can participate)
const CAN_USE = [
  "super_admin",
  "hospital",
  "nurse",
  "caregiver",
  "family",
  "patient"
];

// Create new thread
router.post(
  "/",
  authenticate,
  authorize(CAN_USE),
  validate(createThreadSchema),
  messagingController.createThread
);

// List my threads (optional per patient)
router.get(
  "/",
  authenticate,
  authorize(CAN_USE),
  validate(queryThreadsSchema),
  messagingController.listThreads
);

// Get a thread
router.get(
  "/:id",
  authenticate,
  authorize(CAN_USE),
  // validate(getThreadSchema),
  messagingController.getThread
);

// Send a message to a thread
router.post(
  "/:id/messages",
  authenticate,
  authorize(CAN_USE),
  validate(postMessageSchema),
  messagingController.postMessage
);

// List messages in a thread
router.get(
  "/:id/messages",
  authenticate,
  authorize(CAN_USE),
  validate(paginateMessagesSchema),
  messagingController.listMessages
);

// Mark thread read
router.patch(
  "/:id/read",
  authenticate,
  authorize(CAN_USE),
  validate(markReadSchema),
  messagingController.markThreadRead
);

router.post(
  "/:id/attachments",
  authenticate,
  authorize(CAN_USE),
  uploadAttachments,
  messagingController.postAttachmentsMessage
);

router.delete(
  "/:conversationId/messages/:messageId",
  authenticate,
  authorize(CAN_USE),
  messagingController.deleteMessage
);

router.post(
  "/get-users",
  authenticate,
  authorize(CAN_USE),
  messagingController.getAvailableChatUsers
);

export default router;
