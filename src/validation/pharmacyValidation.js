import Joi from "joi";
import mongoose from "mongoose";
const objectId = Joi.string().custom((v, h) =>
  mongoose.Types.ObjectId.isValid(v) ? v : h.error("any.invalid")
);

export const searchMedSchema = Joi.object({
  q: Joi.string().min(2).required(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10)
});

export const createRxSchema = Joi.object({
  patientId: objectId.required(),
  items: Joi.array()
    .items(
      Joi.object({
        drugName: Joi.string().required(),
        dosage: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
        frequency: Joi.string().required(),
        notes: Joi.string().allow("", null)
      })
    )
    .min(1)
    .required(),
  pharmacyVendor: Joi.string().allow("", null)
});
