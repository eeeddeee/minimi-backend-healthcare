import Joi from "joi";

export const createHospitalSchema = Joi.object({
  hospitalName: Joi.string().max(100).required(),
  hospitalType: Joi.string()
    .valid("Government", "Private", "Specialty", "Multi-specialty", "Teaching")
    .required(),
  hospitalLicenseNumber: Joi.string().required(),
  contactEmail: Joi.string().email().required(),
  contactPhone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required(),
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  country: Joi.string().required(),
  postalCode: Joi.string().required(),
  adminFirstName: Joi.string().required(),
  adminLastName: Joi.string().required(),
  adminPhone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
});

export const updateHospitalSchema = Joi.object({
  hospitalName: Joi.string().max(100),
  hospitalType: Joi.string().valid(
    "Government",
    "Private",
    "Specialty",
    "Multi-specialty",
    "Teaching"
  ),
  hospitalLicenseNumber: Joi.string(),
  contactEmail: Joi.string().email(),
  contactPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
  street: Joi.string(),
  city: Joi.string(),
  state: Joi.string(),
  country: Joi.string(),
  postalCode: Joi.string(),
  isVerified: Joi.boolean()
}).min(1);

// // validation/hospitalValidation.js
// import Joi from "joi";

// export const createHospitalSchema = Joi.object({
//   name: Joi.string().max(100).required(),
//   street: Joi.string().required(),
//   city: Joi.string().required(),
//   state: Joi.string().required(),
//   country: Joi.string().required(),
//   postalCode: Joi.string().required(),
//   contactEmail: Joi.string().email().required(),
//   contactPhone: Joi.string()
//     .pattern(/^\+?[1-9]\d{1,14}$/)
//     .required(),
//   licenseNumber: Joi.string().required()
// });

// export const updateHospitalSchema = Joi.object({
//   name: Joi.string().max(100),
//   street: Joi.string(),
//   city: Joi.string(),
//   state: Joi.string(),
//   country: Joi.string(),
//   postalCode: Joi.string(),
//   contactEmail: Joi.string().email(),
//   contactPhone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
//   isVerified: Joi.boolean()
// }).min(1);
