import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((v, h) => {
  if (!mongoose.Types.ObjectId.isValid(v)) return h.error("any.invalid");
  return v;
}, "ObjectId");

export const createThreadSchema = Joi.object({
  subject: Joi.string().trim().allow("", null),
  participantUserIds: Joi.array().items(objectId).min(1).required()
});

export const queryThreadsSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

export const getThreadSchema = Joi.object({
  id: objectId.required()
}).unknown(true);

export const postMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).required()
});

export const paginateMessagesSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20)
});

export const markReadSchema = Joi.object({
  at: Joi.date().optional()
});
