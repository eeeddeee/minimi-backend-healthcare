// validation/notificationValidation.js
import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((v, h) => {
  if (!mongoose.Types.ObjectId.isValid(v)) return h.error("any.invalid");
  return v;
}, "ObjectId");

export const createNotificationSchema = Joi.object({
  userId: objectId.required(),
  patientId: objectId.optional(),
  type: Joi.string()
    .valid(
      "ai_risk",
      "medication",
      "behavior",
      "activity",
      "incident",
      "message",
      "report",
      "system"
    )
    .required(),
  title: Joi.string().trim().required(),
  message: Joi.string().trim().required(),
  data: Joi.object().default({}),
  priority: Joi.string()
    .valid("low", "normal", "high", "critical")
    .default("normal"),
  channels: Joi.object({
    inApp: Joi.boolean().default(true),
    email: Joi.boolean().default(false)
  }).default({ inApp: true, email: false })
});

export const queryNotificationsSchema = Joi.object({
  patientId: objectId.optional(),
  type: Joi.string().valid(
    "ai_risk",
    "medication",
    "behavior",
    "activity",
    "incident",
    "message",
    "report",
    "system"
  ),
  unread: Joi.boolean().optional(),
  from: Joi.date(),
  to: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20)
});

export const markReadSchema = Joi.object({
  isRead: Joi.boolean().required() // true/false (allow mark unread if needed)
});

export const acknowledgeSchema = Joi.object({
  acknowledge: Joi.boolean().default(true)
});
