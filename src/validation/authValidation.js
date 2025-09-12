import Joi from "joi";

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

export const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).required()
});

// import Joi from "joi";

// export const loginValidation = Joi.object({
//   email: Joi.string().email().required().messages({
//     "string.email": "Email must be valid.",
//     "any.required": "Email is required."
//   }),
//   password: Joi.string().min(6).required().messages({
//     "string.min": "Password must be at least 6 characters.",
//     "any.required": "Password is required."
//   })
// });
