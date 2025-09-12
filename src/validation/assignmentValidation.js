// validation/assignmentValidation.js
import Joi from "joi";
import mongoose from "mongoose";

const objectId = Joi.string().custom((v, h) => {
  if (!mongoose.Types.ObjectId.isValid(v)) return h.error("any.invalid");
  return v;
}, "ObjectId");

export const assignCaregiverSchema = Joi.object({
  patientId: objectId.required(),
  caregiverUserId: objectId.required(),
  isPrimary: Joi.boolean().default(false),
  notes: Joi.string().allow("", null)
});

export const assignFamilyMemberSchema = Joi.object({
  patientId: objectId.required(),
  familyMemberUserId: objectId.required(),
  relationship: Joi.string().trim().default("other"),
  canMakeAppointments: Joi.boolean().default(false),
  canAccessMedicalRecords: Joi.boolean().default(false),
  notes: Joi.string().allow("", null)
});

export const unassignCaregiverSchema = Joi.object({
  patientId: objectId.required(),
  caregiverUserId: objectId.required(),
  // optional: specify where to remove from; if not set -> remove from both
  type: Joi.string().valid("primary", "secondary")
});

export const unassignFamilyMemberSchema = Joi.object({
  patientId: objectId.required(),
  familyMemberUserId: objectId.required()
});

export const assignNurseSchema = {
  body: Joi.object({
    patientId: Joi.string().required(),
    nurseUserId: Joi.string().required()
  })
};

export const unassignNurseSchema = {
  body: Joi.object({
    patientId: Joi.string().required(),
    nurseUserId: Joi.string().required()
  })
};

export const assignCaregiverToNurseSchema = {
  body: Joi.object({
    caregiverUserId: Joi.string().required(),
    nurseUserId: Joi.string().required()
  })
};

export const unassignCaregiverFromNurseSchema = {
  body: Joi.object({
    caregiverUserId: Joi.string().required()
  })
};

export const listAssignmentsSchema = Joi.object({
  patientId: objectId.required()
});
