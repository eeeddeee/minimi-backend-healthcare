import { StatusCodes } from "http-status-codes";
import * as messagingService from "../services/messagingService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";
import { ensureParticipantAccess } from "../utils/messagingAccess.js";
// import { uploadBufferToS3, buildMessageKey } from "../utils/s3.js";
// import { mapMimeToAttachmentType } from "../middleware/attachmentUploadMiddleware.js";

const errorResponse = (res, error, fallback) =>
  res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || fallback,
  });

// POST /messages/threads
export const createThread = async (req, res) => {
  try {
    // creator must have access to patient & be allowed role (route enforces role, here patient access)
    // await ensureAccessToPatient(req.user, req.body.patientId);

    const thread = await messagingService.createThread({
      subject: req.body.subject,
      participantUserIds: req.body.participantUserIds,
      creatorId: req.user._id,
    });

    return res.success(
      "Conversation created successfully.",
      { thread },
      StatusCodes.CREATED
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to create conversation");
  }
};

// GET /messages/threads
export const listThreads = async (req, res) => {
  try {
    const result = await messagingService.listThreads({
      userId: req.user._id,
      // page: parseInt(req.query.page),
      // limit: parseInt(req.query.limit)
    });

    return res.success(
      "Conversations fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch conversations");
  }
};

// GET /messages/threads/:id
export const getThread = async (req, res) => {
  try {
    await ensureParticipantAccess(req.user, req.params.id);
    const { thread } = await messagingService.getThreadById(req.params.id);
    return res.success(
      "Conversation fetched successfully.",
      { thread },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch conversation");
  }
};

// POST /messages/threads/:id/messages
export const postMessage = async (req, res) => {
  try {
    await ensureParticipantAccess(req.user, req.params.id);

    const message = await messagingService.postMessage({
      conversationId: req.params.id,
      senderId: req.user._id,
      content: req.body.content,
    });

    return res.success(
      "Message sent successfully.",
      { message },
      StatusCodes.CREATED
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to send message");
  }
};

// // POST /messages/threads/:id/attachments  (multipart)
export const postAttachmentsMessage = async (req, res) => {
  try {
    await ensureParticipantAccess(req.user, req.params.id);

    const files = req.files || [];
    const content = req.body.content || ""; // optional caption text

    if (!files.length && !content.trim()) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Either attachments or content is required",
      });
    }

    // upload each file to S3
    const attachments = [];
    for (const f of files) {
      const key = buildMessageKey(req.params.id, f.originalname);
      await uploadBufferToS3({
        buffer: f.buffer,
        key,
        contentType: f.mimetype,
      });
      attachments.push({
        type: mapMimeToAttachmentType(f.mimetype),
        key,
        originalName: f.originalname,
        size: f.size,
        mimeType: f.mimetype,
      });
    }

    const message = await messagingService.postMessage({
      conversationId: req.params.id,
      senderId: req.user._id,
      content,
      attachments,
    });

    return res.success(
      "Message with attachments sent successfully.",
      { message },
      StatusCodes.CREATED
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message || "Failed to send attachments",
      });
  }
};

// GET /messages/threads/:id/messages
export const listMessages = async (req, res) => {
  try {
    await ensureParticipantAccess(req.user, req.params.id);

    const result = await messagingService.listMessages({
      conversationId: req.params.id,
      page: parseInt(req.query.page),
      limit: parseInt(req.query.limit),
    });

    return res.success(
      "Messages fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch messages");
  }
};

// PATCH /conversations/:id/read
export const markThreadRead = async (req, res) => {
  try {
    await ensureParticipantAccess(req.user, req.params.id);

    const updated = await messagingService.markThreadRead({
      conversationId: req.params.id,
      userId: req.user._id,
      // at: req.body.at
    });

    return res.success(
      "Conversation marked as read.",
      { thread: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to mark as read");
  }
};

export const deleteMessage = async (req, res) => {
  try {
    await ensureParticipantAccess(req.user, req.params.conversationId);

    const deletedMessage = await messagingService.softDeleteMessage({
      messageId: req.params.messageId,
      userId: req.user._id,
      conversationId: req.params.conversationId,
    });

    return res.success(
      "Message deleted successfully.",
      { message: deletedMessage },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to delete message");
  }
};

export const getAvailableChatUsers = async (req, res) => {
  try {
    const users = await messagingService.getAvailableUsersForChat(req.user);

    return res.success(
      "Available users for chat fetched successfully.",
      { users },
      StatusCodes.OK
    );
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch available users for chat",
    });
  }
};

// // GET /messages/threads/:id/messages On Scrolling Up for Older Messages
// export const listMessages = async (req, res) => {
//   try {
//     await ensureParticipantAccess(req.user, req.params.id);

//     const result = await messagingService.listMessages({
//       conversationId: req.params.id,
//       limit: parseInt(req.query.limit) || 20,
//       before: req.query.before // ISO timestamp for loading older messages
//     });

//     return res.success(
//       "Messages fetched successfully.",
//       result,
//       StatusCodes.OK
//     );
//   } catch (error) {
//     return errorResponse(res, error, "Failed to fetch messages");
//   }
// };

//
//
// export const getAssociatedUsers = async (req, res) => {
//   try {
//     const users = await messagingService.getAssociatedUsers(
//       req.user._id,
//       req.user.role
//     );

//     return res.success(
//       "Associated users fetched successfully.",
//       { users },
//       StatusCodes.OK
//     );
//   } catch (error) {
//     return errorResponse(res, error, "Failed to fetch associated users");
//   }
// };

// // export const listAvailableUsers = async (req, res) => {
//   try {
//     const users = await messagingService.getAvailableUsersForMessaging(
//       req.user
//     );

//     return res.success(
//       "Available users fetched successfully.",
//       { users },
//       StatusCodes.OK
//     );
//   } catch (error) {
//     return res
//       .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
//       .json({
//         success: false,
//         message: error.message || "Failed to fetch available users"
//       });
//   }
// };

// export const getAssociatedUsers = async (req, res) => {
//   try {
//     const users = await messagingService.getAssociatedUsers(
//       req.user._id,
//       req.user.role
//     );

//     return res.success(
//       "Associated users fetched successfully.",
//       { users },
//       StatusCodes.OK
//     );
//   } catch (error) {
//     return errorResponse(res, error, "Failed to fetch associated users");
//   }
// };
