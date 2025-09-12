// utils/accessControl.js
import Patient from "../models/patientModel.js";
import { StatusCodes } from "http-status-codes";

/**
 * Verifies that current user can access the given patientId.
 * Rules:
 * - super_admin, hospital: allowed (same hospital for hospital)
 * - nurse: patientId in patient.nurseIds
 * - caregiver: in primaryCaregiverId OR secondaryCaregiverIds
 * - family: in familyMemberIds
 * - patient: self (patient.patientUserId === user._id)
 */
export const ensureAccessToPatient = async (user, patientId) => {
  const patient = await Patient.findById(patientId)
    .select(
      "hospitalId patientUserId nurseIds primaryCaregiverId secondaryCaregiverIds familyMemberIds"
    )
    .lean();

  if (!patient) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Patient not found" };
  }

  const uid = String(user._id || user.id);
  const pidUser = String(patient.patientUserId || "");

  switch (user.role) {
    case "super_admin":
      return patient;

    case "hospital":
      if (
        String(patient.hospitalId) === uid ||
        String(user.hospitalId) === String(patient.hospitalId)
      ) {
        return patient;
      }
      break;

    case "nurse":
      if ((patient.nurseIds || []).map(String).includes(uid)) return patient;
      break;

    case "caregiver":
      if (
        (patient.primaryCaregiverId || []).map(String).includes(uid) ||
        (patient.secondaryCaregiverIds || []).map(String).includes(uid)
      )
        return patient;
      break;

    case "family":
      if ((patient.familyMemberIds || []).map(String).includes(uid))
        return patient;
      break;

    case "patient":
      if (pidUser === uid) return patient;
      break;
  }

  throw {
    statusCode: StatusCodes.FORBIDDEN,
    message: "You are not authorized to access this patient"
  };
};
