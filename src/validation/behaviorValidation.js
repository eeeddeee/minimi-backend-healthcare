// validation/behaviorValidation.js
import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((v, h) => {
  if (!mongoose.Types.ObjectId.isValid(v)) return h.error("any.invalid");
  return v;
}, "ObjectId");

export const createBehaviorLogSchema = Joi.object({
  patientId: objectId.required(),
  caregiverId: objectId.required(), // nurse/caregiver userId who is logging
  date: Joi.date().default(() => new Date()),
  mood: Joi.string()
    .valid(
      "happy",
      "sad",
      "anxious",
      "agitated",
      "calm",
      "confused",
      "depressed",
      "angry"
    )
    .optional(),
  sleep: Joi.object({
    duration: Joi.number().min(0).max(24),
    quality: Joi.number().min(1).max(5)
  }).optional(),
  activities: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().trim().required(),
        duration: Joi.number().min(0).optional(),
        notes: Joi.string().allow("", null)
      })
    )
    .default([]),
  meals: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid("breakfast", "lunch", "dinner", "snack")
          .required(),
        description: Joi.string().allow("", null),
        intake: Joi.number().min(0).max(100)
      })
    )
    .default([]),
  incidents: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid("fall", "wandering", "aggression", "self-harm", "other")
          .required(),
        description: Joi.string().allow("", null),
        severity: Joi.number().min(1).max(5),
        actionTaken: Joi.string().allow("", null)
      })
    )
    .default([]),
  notes: Joi.string().allow("", null)
});

export const updateBehaviorLogSchema = Joi.object({
  date: Joi.date(),
  mood: Joi.string().valid(
    "happy",
    "sad",
    "anxious",
    "agitated",
    "calm",
    "confused",
    "depressed",
    "angry"
  ),
  sleep: Joi.object({
    duration: Joi.number().min(0).max(24),
    quality: Joi.number().min(1).max(5)
  }),
  activities: Joi.array().items(
    Joi.object({
      name: Joi.string().trim().required(),
      duration: Joi.number().min(0),
      notes: Joi.string().allow("", null)
    })
  ),
  meals: Joi.array().items(
    Joi.object({
      type: Joi.string()
        .valid("breakfast", "lunch", "dinner", "snack")
        .required(),
      description: Joi.string().allow("", null),
      intake: Joi.number().min(0).max(100)
    })
  ),
  incidents: Joi.array().items(
    Joi.object({
      type: Joi.string()
        .valid("fall", "wandering", "aggression", "self-harm", "other")
        .required(),
      description: Joi.string().allow("", null),
      severity: Joi.number().min(1).max(5),
      actionTaken: Joi.string().allow("", null)
    })
  ),
  notes: Joi.string().allow("", null)
}).min(1);

export const queryBehaviorLogsSchema = Joi.object({
  patientId: objectId.required(),
  caregiverId: objectId.optional(),
  mood: Joi.string().valid(
    "happy",
    "sad",
    "anxious",
    "agitated",
    "calm",
    "confused",
    "depressed",
    "angry"
  ),
  incidentType: Joi.string().valid(
    "fall",
    "wandering",
    "aggression",
    "self-harm",
    "other"
  ),
  severityMin: Joi.number().min(1).max(5),
  severityMax: Joi.number().min(1).max(5),
  from: Joi.date(),
  to: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});
