import Joi from "joi";

const baseUserSchema = {
  email: Joi.string().email().required(),
  firstName: Joi.string().required().max(50),
  lastName: Joi.string().required().max(50),
  phone: Joi.string()
    // .pattern(/^\+?[1-9]\d{1,14}$/)
    .required(),
  password: Joi.string().min(8).optional(),
  street: Joi.string().required(),
  city: Joi.string().required(),
  state: Joi.string().required(),
  country: Joi.string().required(),
  postalCode: Joi.string().required(),
  profile_image: Joi.string().optional(),
  dateOfBirth: Joi.date().optional(),
  gender: Joi.string().valid("male", "female", "other").optional()
};

export const hospitalAdminSchema = Joi.object({
  ...baseUserSchema
  // No additional fields for hospital admin user
});

export const nurseSchema = Joi.object({
  ...baseUserSchema,
  NurselicenseNumber: Joi.string().required(),
  specialization: Joi.string().optional(),
  yearsOfExperience: Joi.number().optional(),
  nurseShifts: Joi.number().optional(),
  department: Joi.number().optional()
});

export const caregiverSchema = Joi.object({
  ...baseUserSchema,
  certification: Joi.string().optional(),
  yearsOfExperience: Joi.number().optional(),
  languagesSpoken: Joi.array().items(Joi.string()).optional(),
  availability: Joi.array().items(Joi.string()).optional(),
  caregiverShifts: Joi.array().items(Joi.string()).optional(),
  hourlyRate: Joi.number().optional(),
  department: Joi.number().optional()
});

export const familyMemberSchema = Joi.object({
  ...baseUserSchema,
  patientId: Joi.string().required(),
  relationship: Joi.string()
    .valid("spouse", "parent", "child", "sibling", "guardian", "other")
    .required()
});

export const patientSchema = Joi.object({
  ...baseUserSchema,
  bloodGroup: Joi.string()
    .valid("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")
    .optional(),
  medicalConditions: Joi.string().optional(),
  allergies: Joi.array().items(Joi.string()).optional()
});

export const hospitalSchema = Joi.object({
  hospitalName: Joi.string().required().max(100),
  hospitalType: Joi.string()
    .valid("Government", "Private", "Specialty", "Multi-specialty", "Teaching")
    .required(),
  hospitalLicenseNumber: Joi.string().required(),
  website: Joi.string().uri().optional(),
  hospitalUserId: Joi.string()
});

// import Joi from "joi";

// export const createUserSchema = Joi.object({
//   email: Joi.string().email().required(),
//   firstName: Joi.string().required().max(50),
//   lastName: Joi.string().required().max(50),
//   phone: Joi.string()
//     .pattern(/^\+?[1-9]\d{1,14}$/)
//     .required(),
//   password: Joi.string().min(8).required(),
//   role: Joi.string()
//     .valid("super_admin", "hospital", "nurse", "caregiver", "family", "patient")
//     .required(),
//   street: Joi.string().required(),
//   city: Joi.string().required(),
//   state: Joi.string().required(),
//   country: Joi.string().required(),
//   postalCode: Joi.string().required(),
//   profile_image: Joi.string().optional(),
//   dateOfBirth: Joi.date().optional(),
//   gender: Joi.string().valid("male", "female", "other").optional()
// }).options({ abortEarly: false });

// // import Joi from "joi";

// // // Common validation schemas
// // const nameSchema = Joi.string().min(2).max(50).required().messages({
// //   "string.empty": "Name is required",
// //   "string.min": "Name must be at least 2 characters",
// //   "string.max": "Name cannot exceed 50 characters"
// // });

// // const emailSchema = Joi.string().email().required().messages({
// //   "string.email": "Please provide a valid email address",
// //   "string.empty": "Email is required"
// // });

// // const phoneSchema = Joi.string()
// //   .pattern(/^[0-9]{10,15}$/)
// //   .required()
// //   .messages({
// //     "string.pattern.base": "Phone number must be between 10-15 digits",
// //     "string.empty": "Phone number is required"
// //   });

// // // Hospital registration
// // export const hospitalRegistrationSchema = Joi.object({
// //   name: nameSchema,
// //   street: Joi.string().required().messages({
// //     "string.empty": "Street address is required"
// //   }),
// //   city: Joi.string().required().messages({
// //     "string.empty": "City is required"
// //   }),
// //   state: Joi.string().required().messages({
// //     "string.empty": "State is required"
// //   }),
// //   country: Joi.string().required().messages({
// //     "string.empty": "Country is required"
// //   }),
// //   postalCode: Joi.string().required().messages({
// //     "string.empty": "Postal code is required"
// //   }),
// //   contactEmail: emailSchema,
// //   contactPhone: phoneSchema,
// //   licenseNumber: Joi.string().required().messages({
// //     "string.empty": "License number is required"
// //   }),
// //   location: Joi.object({
// //     type: Joi.string().valid("Point").default("Point"),
// //     coordinates: Joi.array().items(Joi.number()).length(2).required()
// //   }).optional()
// // });

// // // Hospital update
// // export const hospitalUpdateSchema = Joi.object({
// //   name: nameSchema.optional(),
// //   street: Joi.string().optional(),
// //   city: Joi.string().optional(),
// //   state: Joi.string().optional(),
// //   country: Joi.string().optional(),
// //   postalCode: Joi.string().optional(),
// //   contactEmail: emailSchema.optional(),
// //   contactPhone: phoneSchema.optional(),
// //   licenseNumber: Joi.string().optional(),
// //   location: Joi.object({
// //     type: Joi.string().valid("Point").default("Point"),
// //     coordinates: Joi.array().items(Joi.number()).length(2).required()
// //   }).optional(),
// //   profilePhoto: Joi.string().optional()
// // });

// // // Nurse registration
// // export const nurseRegistrationSchema = Joi.object({
// //   firstName: nameSchema,
// //   lastName: nameSchema,
// //   email: emailSchema,
// //   phone: phoneSchema,
// //   licenseNumber: Joi.string().required().messages({
// //     "string.empty": "License number is required for nurses"
// //   }),
// //   languagePreference: Joi.string()
// //     .valid("en", "es", "hi", "bn", "ta", "zh")
// //     .default("en")
// // });

// // // Nurse update
// // export const nurseUpdateSchema = Joi.object({
// //   firstName: nameSchema.optional(),
// //   lastName: nameSchema.optional(),
// //   email: emailSchema.optional(),
// //   phone: phoneSchema.optional(),
// //   licenseNumber: Joi.string().optional(),
// //   languagePreference: Joi.string()
// //     .valid("en", "es", "hi", "bn", "ta", "zh")
// //     .optional(),
// //   profilePhoto: Joi.string().optional()
// // });

// // // Caregiver registration
// // export const caregiverRegistrationSchema = Joi.object({
// //   firstName: nameSchema,
// //   lastName: nameSchema,
// //   email: emailSchema,
// //   phone: phoneSchema,
// //   languagePreference: Joi.string()
// //     .valid("en", "es", "hi", "bn", "ta", "zh")
// //     .default("en")
// // });

// // // Caregiver update
// // export const caregiverUpdateSchema = Joi.object({
// //   firstName: nameSchema.optional(),
// //   lastName: nameSchema.optional(),
// //   email: emailSchema.optional(),
// //   phone: phoneSchema.optional(),
// //   languagePreference: Joi.string()
// //     .valid("en", "es", "hi", "bn", "ta", "zh")
// //     .optional(),
// //   profilePhoto: Joi.string().optional()
// // });

// // // Patient registration
// // export const patientRegistrationSchema = Joi.object({
// //   patientData: Joi.object({
// //     firstName: nameSchema,
// //     lastName: nameSchema,
// //     dob: Joi.date().required().messages({
// //       "date.base": "Date of birth is required"
// //     }),
// //     gender: Joi.string().valid("male", "female", "other").required(),
// //     bloodGroup: Joi.string()
// //       .valid("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")
// //       .optional(),
// //     medicalConditions: Joi.array().items(Joi.string()).optional(),
// //     allergies: Joi.array().items(Joi.string()).optional(),
// //     emergencyContacts: Joi.array()
// //       .items(
// //         Joi.object({
// //           name: Joi.string().required(),
// //           relationship: Joi.string().required(),
// //           phone: phoneSchema,
// //           email: emailSchema.optional()
// //         })
// //       )
// //       .optional()
// //   }).required(),
// //   familyMemberData: Joi.object({
// //     firstName: nameSchema,
// //     lastName: nameSchema,
// //     email: emailSchema,
// //     phone: phoneSchema,
// //     relationship: Joi.string().required().messages({
// //       "string.empty": "Relationship to patient is required"
// //     }),
// //     languagePreference: Joi.string()
// //       .valid("en", "es", "hi", "bn", "ta", "zh")
// //       .default("en")
// //   }).required()
// // });

// // // Patient update
// // export const patientUpdateSchema = Joi.object({
// //   firstName: nameSchema.optional(),
// //   lastName: nameSchema.optional(),
// //   dob: Joi.date().optional(),
// //   gender: Joi.string().valid("male", "female", "other").optional(),
// //   bloodGroup: Joi.string()
// //     .valid("A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")
// //     .optional(),
// //   medicalConditions: Joi.array().items(Joi.string()).optional(),
// //   allergies: Joi.array().items(Joi.string()).optional(),
// //   currentMedications: Joi.array()
// //     .items(
// //       Joi.object({
// //         name: Joi.string().required(),
// //         dosage: Joi.string().required(),
// //         frequency: Joi.string().required(),
// //         startDate: Joi.date().required(),
// //         endDate: Joi.date().optional(),
// //         prescribedBy: Joi.string().optional()
// //       })
// //     )
// //     .optional(),
// //   emergencyContacts: Joi.array()
// //     .items(
// //       Joi.object({
// //         name: Joi.string().required(),
// //         relationship: Joi.string().required(),
// //         phone: phoneSchema,
// //         email: emailSchema.optional()
// //       })
// //     )
// //     .optional(),
// //   profilePhoto: Joi.string().optional()
// // });

// // // Family member update
// // export const familyMemberUpdateSchema = Joi.object({
// //   firstName: nameSchema.optional(),
// //   lastName: nameSchema.optional(),
// //   email: emailSchema.optional(),
// //   phone: phoneSchema.optional(),
// //   relationship: Joi.string().optional(),
// //   languagePreference: Joi.string()
// //     .valid("en", "es", "hi", "bn", "ta", "zh")
// //     .optional(),
// //   profilePhoto: Joi.string().optional()
// // });

// // // Patient assignment
// // export const patientAssignmentSchema = Joi.object({
// //   patientId: Joi.string().required().messages({
// //     "string.empty": "Patient ID is required"
// //   }),
// //   caregiverId: Joi.string().required().messages({
// //     "string.empty": "Caregiver ID is required"
// //   })
// // });

// // // Hospital ID validation
// // export const hospitalIdSchema = Joi.string()
// //   .pattern(/^[0-9a-fA-F]{24}$/)
// //   .required()
// //   .messages({
// //     "string.pattern.base": "Invalid hospital ID format",
// //     "string.empty": "Hospital ID is required"
// //   });

// // // import Joi from "joi";

// // // export const userValidationSchema = Joi.object({
// // //   email: Joi.string().email().required().messages({
// // //     "string.email": "Please provide a valid email address.",
// // //     "any.required": "Email is required."
// // //   }),
// // //   role: Joi.string().valid("hospital", "super_admin").required().messages({
// // //     "any.required": "Role is required.",
// // //     "string.valid": "Role must be one of the following: hospital, super_admin"
// // //   }),
// // //   full_name: Joi.string().min(3).max(100).required().messages({
// // //     "string.min": "Full name must be at least 3 characters long.",
// // //     "string.max": "Full name must not exceed 100 characters.",
// // //     "any.required": "Full name is required."
// // //   }),
// // //   phone: Joi.string()
// // //     .pattern(/^[0-9]{10}$/)
// // //     .required()
// // //     .messages({
// // //       "string.pattern.base": "Phone number must be exactly 10 digits.",
// // //       "any.required": "Phone number is required."
// // //     })
// // // });

// // // export const hospitalIdSchema = Joi.object({
// // //   id: Joi.string()
// // //     .pattern(/^[0-9a-fA-F]{24}$/)
// // //     .required()
// // //     .messages({
// // //       "string.pattern.base": "Invalid hospital ID format",
// // //       "any.required": "Hospital ID is required"
// // //     })
// // // });

// // // export const hospitalQuerySchema = Joi.object({
// // //   page: Joi.number().integer().min(1).default(1),
// // //   limit: Joi.number().integer().min(1).max(100).default(10),
// // //   search: Joi.string().allow("").optional()
// // // });

// // // // exports.createUserSchemaValidation = Joi.object({
// // // //   email: Joi.string().email().required().messages({
// // // //     "string.email": "Email must be valid.",
// // // //     "any.required": "Email is required."
// // // //   }),
// // // //   role: Joi.string()
// // // //     .valid("school", "vendor", "driver", "parent")
// // // //     .required()
// // // //     .messages({
// // // //       "any.only": "Role must be one of school, vendor, driver, or parent.",
// // // //       "any.required": "Role is required."
// // // //     }),
// // // //   first_name: Joi.string().trim().messages({
// // // //     "string.base": "First name must be a string."
// // // //   }),
// // // //   last_name: Joi.string().trim().messages({
// // // //     "string.base": "Last name must be a string."
// // // //   }),
// // // //   phone: Joi.string().trim().messages({
// // // //     "string.base": "Phone must be a string."
// // // //   }),
// // // //   company_name: Joi.string().trim().messages({
// // // //     "string.base": "Company name must be a string."
// // // //   }),
// // // //   address: Joi.object({
// // // //     street: Joi.string().trim(),
// // // //     city: Joi.string().trim(),
// // // //     state: Joi.string().trim(),
// // // //     zipCode: Joi.string().trim(),
// // // //     country: Joi.string().trim(),
// // // //     coordinates: Joi.object({
// // // //       lat: Joi.number(),
// // // //       lng: Joi.number()
// // // //     })
// // // //   }).messages({
// // // //     "object.base": "Address must be an object."
// // // //   }),
// // // //   gender: Joi.string().valid("male", "female", "other").messages({
// // // //     "any.only": "Gender must be male, female, or other."
// // // //   }),
// // // //   notification_preferences: Joi.object({
// // // //     email: Joi.boolean(),
// // // //     sms: Joi.boolean(),
// // // //     push: Joi.boolean()
// // // //   }).messages({
// // // //     "object.base": "Notification preferences must be an object."
// // // //   })
// // // // }).options({ allowUnknown: false });

// // // // exports.updateUserSchemaValidation = Joi.object({
// // // //   first_name: Joi.string().trim(),
// // // //   last_name: Joi.string().trim(),
// // // //   phone: Joi.string().trim(),
// // // //   company_name: Joi.string().trim(),
// // // //   address: Joi.object({
// // // //     street: Joi.string().trim(),
// // // //     city: Joi.string().trim(),
// // // //     state: Joi.string().trim(),
// // // //     zipCode: Joi.string().trim(),
// // // //     country: Joi.string().trim(),
// // // //     coordinates: Joi.object({
// // // //       lat: Joi.number(),
// // // //       lng: Joi.number()
// // // //     })
// // // //   }),
// // // //   profile_image: Joi.string().uri(),
// // // //   bio: Joi.string().trim().max(500),
// // // //   gender: Joi.string().valid("male", "female", "other"),
// // // //   notification_preferences: Joi.object({
// // // //     email: Joi.boolean(),
// // // //     sms: Joi.boolean(),
// // // //     push: Joi.boolean()
// // // //   }),
// // // //   active: Joi.boolean()
// // // // });
