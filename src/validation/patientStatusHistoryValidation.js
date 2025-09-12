// validation/patientStatusHistoryValidation.js
import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((v, h) => {
  if (!mongoose.Types.ObjectId.isValid(v)) return h.error("any.invalid");
  return v;
}, "ObjectId");

export const queryStatusHistorySchema = Joi.object({
  id: objectId.required(), // patientId (from params if your validator supports, else pass via query)
  from: Joi.date(),
  to: Joi.date(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
}).unknown(true);
