import Joi from "joi";
import mongoose from "mongoose";
const objectId = Joi.string().custom((v, h) =>
  mongoose.Types.ObjectId.isValid(v) ? v : h.error("any.invalid")
);

export const importFhirSchema = Joi.object({
  bundle: Joi.object().required() // FHIR Bundle JSON
});
