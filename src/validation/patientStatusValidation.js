// validation/patientStatusValidation.js
import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((v, h) => {
  if (!mongoose.Types.ObjectId.isValid(v)) return h.error("any.invalid");
  return v;
}, "ObjectId");

export const getPatientStatusSchema = Joi.object({
  id: objectId.required()
}).unknown(true); // since it's param, your validate middleware may ignore; keep flexible

export const updatePatientStatusSchema = Joi.object({
  status: Joi.string()
    .valid("active", "inactive", "deceased", "discharged")
    .required(),
  notes: Joi.string().allow("", null),
  effectiveAt: Joi.date() // optional, for audit context
});
