import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((v, h) => {
  if (!mongoose.Types.ObjectId.isValid(v)) return h.error("any.invalid");
  return v;
}, "ObjectId");

export const createJournalSchema = Joi.object({
  patientId: objectId.required(),
  date: Joi.date().optional(),
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
  activities: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().trim().required(),
        duration: Joi.number().min(0),
        notes: Joi.string().allow("", null)
      })
    )
    .default([]),
  notes: Joi.array()
    .items(
      Joi.object({
        text: Joi.string().trim().required()
      })
    )
    .default([]),
  summary: Joi.string().allow("", null)
});

export const updateJournalSchema = Joi.object({
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
  notes: Joi.array().items(
    Joi.object({
      text: Joi.string().trim().required()
    })
  ),
  summary: Joi.string().allow("", null)
}).min(1);

export const queryJournalSchema = Joi.object({
  patientId: objectId.required(),
  from: Joi.date(),
  to: Joi.date(),
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
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

export const addActivitySchema = Joi.object({
  name: Joi.string().trim().required(),
  duration: Joi.number().min(0),
  notes: Joi.string().allow("", null)
});

export const updateActivitySchema = Joi.object({
  name: Joi.string().trim(),
  duration: Joi.number().min(0),
  notes: Joi.string().allow("", null)
}).min(1);

export const addNoteSchema = Joi.object({
  text: Joi.string().trim().required()
});

export const updateNoteSchema = Joi.object({
  text: Joi.string().trim().required()
});
