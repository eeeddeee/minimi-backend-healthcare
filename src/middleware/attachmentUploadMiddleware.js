// middleware/attachmentUploadMiddleware.js
import multer from "multer";
import { StatusCodes } from "http-status-codes";

const storage = multer.memoryStorage();

// Allowed mime-types → map to `type` in Message.attachments
const MIME_MAP = {
  // images
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  // videos
  "video/mp4": "video",
  "video/quicktime": "video",
  // audio
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  // docs
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "document",
  "application/vnd.ms-excel": "document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "document",
  "text/plain": "document"
};

const fileFilter = (req, file, cb) => {
  if (MIME_MAP[file.mimetype]) return cb(null, true);
  const err = new Error("Unsupported file type");
  err.statusCode = StatusCodes.UNSUPPORTED_MEDIA_TYPE;
  cb(err);
};

export const uploadAttachments = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB per file
}).array("attachments", 5); // up to 5 files per message

export const mapMimeToAttachmentType = (mime) => MIME_MAP[mime] || "document";
