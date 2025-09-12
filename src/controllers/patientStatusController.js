// controllers/patientStatusController.js
import { StatusCodes } from "http-status-codes";
import * as patientStatusService from "../services/patientStatusService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";
import Patient from "../models/patientModel.js";

const errorResponse = (res, error, fallback) =>
  res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || fallback
  });

// GET /patients/:id/status
export const getPatientStatus = async (req, res) => {
  try {
    // ensure read access (patient/family/caregiver/nurse/hospital/super_admin)
    const patient = await Patient.findById(req.params.id)
      .select(
        "patientUserId hospitalId nurseIds primaryCaregiverId secondaryCaregiverIds familyMemberIds"
      )
      .lean();
    if (!patient) {
      return errorResponse(res, {
        statusCode: StatusCodes.NOT_FOUND,
        message: "Patient not found"
      });
    }
    await ensureAccessToPatient(req.user, patient._id);

    const result = await patientStatusService.getPatientStatus(req.params.id);
    return res.success(
      "Patient status fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch patient status");
  }
};

// PATCH /patients/:id/status
export const updatePatientStatus = async (req, res) => {
  try {
    // only super_admin, hospital, nurse can update (routes will enforce)
    // extra safety: ensure the updater belongs to same hospital as patient
    const patient = await Patient.findById(req.params.id)
      .select("hospitalId")
      .lean();
    if (!patient) {
      return errorResponse(res, {
        statusCode: StatusCodes.NOT_FOUND,
        message: "Patient not found"
      });
    }

    const hospitalOfActor = req.user.hospitalId || req.user._id;
    const sameHospital =
      req.user.role === "super_admin" ||
      String(patient.hospitalId) === String(hospitalOfActor);

    if (!sameHospital) {
      return errorResponse(res, {
        statusCode: StatusCodes.FORBIDDEN,
        message: "Not authorized to update this patient"
      });
    }

    const result = await patientStatusService.updatePatientStatus(
      req.params.id,
      {
        status: req.body.status,
        notes: req.body.notes,
        effectiveAt: req.body.effectiveAt
      },
      req.user
    );

    return res.success(
      "Patient status updated successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update patient status");
  }
};
