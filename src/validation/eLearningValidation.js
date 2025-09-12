// validation/eLearningValidation.js
import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((v, h) => {
  if (!mongoose.Types.ObjectId.isValid(v)) return h.error("any.invalid");
  return v;
}, "ObjectId");

export const createResourceSchema = Joi.object({
  title: Joi.string().trim().required(),
  description: Joi.string().allow("", null),
  content: Joi.string().allow("", null), // HTML or URL
  language: Joi.string()
    .valid("en", "es", "hi", "bn", "ta", "zh")
    .default("en"),
  categories: Joi.array()
    .items(
      Joi.string().valid(
        "dementia-care",
        "first-aid",
        "medication-management",
        "nutrition",
        "behavior-management",
        "stress-relief",
        "legal-issues"
      )
    )
    .default([]),
  difficulty: Joi.string()
    .valid("beginner", "intermediate", "advanced")
    .default("beginner"),
  duration: Joi.number().min(1).optional() // minutes
});

export const updateResourceSchema = Joi.object({
  title: Joi.string().trim(),
  description: Joi.string().allow("", null),
  content: Joi.string().allow("", null),
  language: Joi.string().valid("en", "es", "hi", "bn", "ta", "zh"),
  categories: Joi.array().items(
    Joi.string().valid(
      "dementia-care",
      "first-aid",
      "medication-management",
      "nutrition",
      "behavior-management",
      "stress-relief",
      "legal-issues"
    )
  ),
  difficulty: Joi.string().valid("beginner", "intermediate", "advanced"),
  duration: Joi.number().min(1),
  isActive: Joi.boolean()
}).min(1);

export const queryResourcesSchema = Joi.object({
  search: Joi.string().allow("", null),
  language: Joi.string().valid("en", "es", "hi", "bn", "ta", "zh"),
  category: Joi.string().valid(
    "dementia-care",
    "first-aid",
    "medication-management",
    "nutrition",
    "behavior-management",
    "stress-relief",
    "legal-issues"
  ),
  difficulty: Joi.string().valid("beginner", "intermediate", "advanced"),
  isActive: Joi.boolean().default(true),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

export const markViewSchema = Joi.object({
  completionPercentage: Joi.number().min(0).max(100).default(0)
});

export const updateProgressSchema = Joi.object({
  completionPercentage: Joi.number().min(0).max(100).required()
});

export const submitFeedbackSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow("", null)
});

export const listFeedbackSchema = {
  params: Joi.object({ id: Joi.string().required() }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10)
  })
};