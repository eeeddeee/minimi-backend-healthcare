import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((v, h) => {
  if (!mongoose.Types.ObjectId.isValid(v)) return h.error("any.invalid");
  return v;
}, "ObjectId");

export const createPredictionSchema = Joi.object({
  patientId: objectId.required(),
  predictionDate: Joi.date().default(() => new Date(), "now"),
  predictedMood: Joi.string().valid(
    "happy",
    "sad",
    "anxious",
    "agitated",
    "calm",
    "confused",
    "depressed",
    "angry"
  ),
  predictedSleepQuality: Joi.number().min(1).max(5),
  riskFactors: Joi.array().items(
    Joi.object({
      type: Joi.string()
        .valid(
          "fall",
          "wandering",
          "aggression",
          "self-harm",
          "medication-miss",
          "other"
        )
        .required(),
      probability: Joi.number().min(0).max(1).required(),
      suggestedInterventions: Joi.array().items(Joi.string()).default([])
    })
  ),
  caregiverStressLevel: Joi.number().min(1).max(10),
  stressReductionTips: Joi.array().items(Joi.string()).default([]),
  isNotified: Joi.boolean().default(false)
});

export const queryPredictionsSchema = Joi.object({
  patientId: objectId.required(),
  from: Joi.date(),
  to: Joi.date(),
  risk: Joi.string().valid(
    "fall",
    "wandering",
    "aggression",
    "self-harm",
    "medication-miss",
    "other"
  ),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

export const updatePredictionSchema = Joi.object({
  predictedMood: Joi.string().valid(
    "happy",
    "sad",
    "anxious",
    "agitated",
    "calm",
    "confused",
    "depressed",
    "angry"
  ),
  predictedSleepQuality: Joi.number().min(1).max(5),
  riskFactors: Joi.array().items(
    Joi.object({
      type: Joi.string()
        .valid(
          "fall",
          "wandering",
          "aggression",
          "self-harm",
          "medication-miss",
          "other"
        )
        .required(),
      probability: Joi.number().min(0).max(1).required(),
      suggestedInterventions: Joi.array().items(Joi.string()).default([])
    })
  ),
  caregiverStressLevel: Joi.number().min(1).max(10),
  stressReductionTips: Joi.array().items(Joi.string()),
  isNotified: Joi.boolean()
}).min(1);
