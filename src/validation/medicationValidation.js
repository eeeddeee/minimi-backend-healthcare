import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((value, helpers) => {
  if (!mongoose.Types.ObjectId.isValid(value))
    return helpers.error("any.invalid");
  return value;
}, "ObjectId");

const HH_MM = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

export const createReminderSchema = Joi.object({
  patientId: objectId.required(),
  medicationName: Joi.string().trim().min(1).required(),
  dosage: Joi.string().trim().min(1).required(),
  frequency: Joi.string()
    .valid("daily", "weekly", "bi-weekly", "monthly", "as needed")
    .required(),
  specificTimes: Joi.array().items(Joi.string().pattern(HH_MM)).default([]),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref("startDate")).optional(),
  notes: Joi.string().allow("", null),
  status: Joi.string().valid("active", "completed", "cancelled").optional()
});

export const updateReminderSchema = Joi.object({
  medicationName: Joi.string().trim().min(1),
  dosage: Joi.string().trim().min(1),
  frequency: Joi.string().valid(
    "daily",
    "weekly",
    "bi-weekly",
    "monthly",
    "as needed"
  ),
  specificTimes: Joi.array().items(Joi.string().pattern(HH_MM)),
  startDate: Joi.date(),
  endDate: Joi.date(),
  notes: Joi.string().allow("", null)
}).min(1);

export const updateStatusSchema = Joi.object({
  status: Joi.string().valid("active", "completed", "cancelled").required()
});

export const queryRemindersSchema = Joi.object({
  patientId: objectId.required(),
  status: Joi.string().valid("active", "completed", "cancelled"),
  from: Joi.date(),
  to: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

export const addLogSchema = Joi.object({
  date: Joi.date().required(),
  time: Joi.string().pattern(HH_MM).required(),
  status: Joi.string()
    .valid("taken", "missed", "skipped", "partial")
    .required(),
  notes: Joi.string().allow("", null)
});

export const updateLogSchema = Joi.object({
  status: Joi.string().valid("taken", "missed", "skipped", "partial"),
  notes: Joi.string().allow("", null)
}).min(1);

export const queryLogsSchema = Joi.object({
  status: Joi.string().valid("taken", "missed", "skipped", "partial"),
  from: Joi.date(),
  to: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});
