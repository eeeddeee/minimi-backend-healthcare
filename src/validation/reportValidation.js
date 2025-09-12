// validation/reportValidation.js
import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((v, h) => {
  if (!mongoose.Types.ObjectId.isValid(v)) return h.error("any.invalid");
  return v;
}, "ObjectId");

export const createReportSchema = Joi.object({
  patientId: objectId.required(),
  type: Joi.string().valid("weekly", "monthly", "custom").required(),
  period: Joi.object({
    start: Joi.date().required(),
    end: Joi.date().required()
  }).required(),
  sharedWith: Joi.array().items(objectId).default([])
});

export const queryReportsSchema = Joi.object({
  patientId: objectId.required(),
  from: Joi.date(), // filter by period.end >= from
  to: Joi.date(), // filter by period.end <= to
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

export const updateReportSchema = Joi.object({
  content: Joi.object({
    summary: Joi.string().allow("", null),
    notes: Joi.string().allow("", null)
  }).unknown(true),
  sharedWith: Joi.array().items(objectId)
}).min(1);

export const shareReportSchema = Joi.object({
  sharedWith: Joi.array().items(objectId).min(1).required()
});
