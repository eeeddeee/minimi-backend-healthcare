import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((v, h) =>
  mongoose.Types.ObjectId.isValid(v) ? v : h.error("any.invalid")
);

export const queryLogsSchema = Joi.object({
  action: Joi.string().trim(),
  entityType: Joi.string().trim(),
  performedBy: objectId.optional(),
  from: Joi.date(),
  to: Joi.date(),
  search: Joi.string().trim(), // matches in action/entityType/metadata
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20)
});

export const getLogSchema = Joi.object({
  id: objectId.required()
}).unknown(true);
