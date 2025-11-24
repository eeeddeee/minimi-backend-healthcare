import Patient from "../models/patientModel.js";
import { StatusCodes } from "http-status-codes";

export const checkPatientAccess = async (req, res, next) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.error("Patient ID is required", null, StatusCodes.BAD_REQUEST);
    }

    const patient = await Patient.findById(patientId)
      .select(
        "hospitalId patientUserId nurseIds primaryCaregiverId secondaryCaregiverIds familyMemberIds"
      )
      .lean();

    if (!patient) {
      return res.error("Patient not found", null, StatusCodes.NOT_FOUND);
    }

    const user = req.user;
    const uid = String(user._id || user.id);
    const pidUser = String(patient.patientUserId || "");

    let hasAccess = false;

    switch (user.role) {
      case "super_admin":
        hasAccess = true;
        break;
      case "hospital":
        hasAccess =
          String(patient.hospitalId) === uid ||
          String(user.hospitalId) === String(patient.hospitalId);
        break;
      case "nurse":
        hasAccess = (patient.nurseIds || []).map(String).includes(uid);
        break;
      case "caregiver":
        hasAccess =
          (patient.primaryCaregiverId || []).map(String).includes(uid) ||
          (patient.secondaryCaregiverIds || []).map(String).includes(uid);
        break;
      case "family":
        hasAccess = (patient.familyMemberIds || []).map(String).includes(uid);
        break;
      case "patient":
        hasAccess = pidUser === uid;
        break;
    }

    if (!hasAccess) {
      return res.error(
        "You are not authorized to access this patient",
        null,
        StatusCodes.FORBIDDEN
      );
    }

    // Add patient info to request for later use
    req.patient = patient;
    next();
  } catch (error) {
    return errorResponse(res, error, "Error checking patient access");
  }
};
