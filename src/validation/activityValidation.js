import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value))
    return helpers.error("any.invalid");
  return value;
}, "ObjectId");

export const createActivitySchema = Joi.object({
  patientId: objectId.required(),
  caregiverId: objectId.optional(),
  name: Joi.string().trim().required(),
  description: Joi.string().allow("", null),
  schedule: Joi.object({
    start: Joi.date().required(),
    end: Joi.date().optional(),
    recurrence: Joi.string()
      .valid("none", "daily", "weekly", "bi-weekly", "monthly")
      .default("none")
  }).required(),
  notes: Joi.string().allow("", null)
});

export const updateActivitySchema = Joi.object({
  name: Joi.string().trim(),
  description: Joi.string().allow("", null),
  schedule: Joi.object({
    start: Joi.date(),
    end: Joi.date(),
    recurrence: Joi.string().valid(
      "none",
      "daily",
      "weekly",
      "bi-weekly",
      "monthly"
    )
  }),
  notes: Joi.string().allow("", null)
}).min(1);

export const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid("scheduled", "in-progress", "completed", "cancelled")
    .required()
});

export const updateOutcomeSchema = Joi.object({
  outcome: Joi.string().valid("excellent", "good", "fair", "poor").required(),
  notes: Joi.string().allow("", null)
});

export const queryActivitiesSchema = Joi.object({
  patientId: objectId.required(),
  status: Joi.string().valid(
    "scheduled",
    "in-progress",
    "completed",
    "cancelled"
  ),
  from: Joi.date(),
  to: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});
