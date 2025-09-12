// controllers/assignmentController.js
import { StatusCodes } from "http-status-codes";
import * as assignmentService from "../services/assignmentService.js";

const errorResponse = (res, error, fallback = "Something went wrong") =>
  res
    .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
    .json({ success: false, message: error.message || fallback });

// POST /assignments/caregiver
export const assignCaregiver = async (req, res) => {
  try {
    const updatedPatient = await assignmentService.assignCaregiverToPatient({
      patientId: req.body.patientId,
      caregiverUserId: req.body.caregiverUserId,
      isPrimary: !!req.body.isPrimary,
      performedBy: req.user
    });

    return res.success(
      "Caregiver assigned to patient successfully.",
      { patient: updatedPatient },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to assign caregiver");
  }
};

// POST /assignments/family-member
export const assignFamilyMember = async (req, res) => {
  try {
    const result = await assignmentService.assignFamilyMemberToPatient({
      patientId: req.body.patientId,
      familyMemberUserId: req.body.familyMemberUserId,
      relationship: req.body.relationship,
      canMakeAppointments: req.body.canMakeAppointments,
      canAccessMedicalRecords: req.body.canAccessMedicalRecords,
      performedBy: req.user
    });

    return res.success(
      "Family member assigned to patient successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to assign family member");
  }
};

export const unassignCaregiver = async (req, res) => {
  try {
    const updatedPatient = await assignmentService.unassignCaregiverFromPatient(
      {
        patientId: req.body.patientId,
        caregiverUserId: req.body.caregiverUserId,
        type: req.body.type, // 'primary' | 'secondary' | undefined
        performedBy: req.user
      }
    );

    return res.success(
      "Caregiver unassigned successfully.",
      { patient: updatedPatient },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to unassign caregiver");
  }
};

export const unassignFamilyMember = async (req, res) => {
  try {
    const updatedPatient =
      await assignmentService.unassignFamilyMemberFromPatient({
        patientId: req.body.patientId,
        familyMemberUserId: req.body.familyMemberUserId,
        performedBy: req.user
      });

    return res.success(
      "Family member unassigned successfully.",
      { patient: updatedPatient },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to unassign family member");
  }
};

export const assignNurse = async (req, res) => {
  try {
    const updatedPatient = await assignmentService.assignNurseToPatient({
      patientId: req.body.patientId,
      nurseUserId: req.body.nurseUserId,
      performedBy: req.user
    });
    return res.success(
      "Nurse assigned to patient successfully.",
      { patient: updatedPatient },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to assign nurse");
  }
};

export const unassignNurse = async (req, res) => {
  try {
    const updatedPatient = await assignmentService.unassignNurseFromPatient({
      patientId: req.body.patientId,
      nurseUserId: req.body.nurseUserId,
      performedBy: req.user
    });
    return res.success(
      "Nurse unassigned from patient successfully.",
      { patient: updatedPatient },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to unassign nurse");
  }
};

// --- NEW: Caregiver <-> Nurse ---
export const assignCaregiverToNurse = async (req, res) => {
  try {
    const updatedCaregiver = await assignmentService.assignCaregiverToNurse({
      caregiverUserId: req.body.caregiverUserId,
      nurseUserId: req.body.nurseUserId,
      performedBy: req.user
    });
    return res.success(
      "Caregiver assigned to nurse successfully.",
      { caregiver: updatedCaregiver },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to assign caregiver to nurse");
  }
};

export const unassignCaregiverFromNurse = async (req, res) => {
  try {
    const updatedCaregiver = await assignmentService.unassignCaregiverFromNurse(
      {
        caregiverUserId: req.body.caregiverUserId,
        performedBy: req.user
      }
    );
    return res.success(
      "Caregiver unassigned from nurse successfully.",
      { caregiver: updatedCaregiver },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to unassign caregiver from nurse");
  }
};

export const listAssignments = async (req, res) => {
  try {
    const result = await assignmentService.getAssignmentsByPatient({
      patientId: req.query.patientId,
      performedBy: req.user
    });

    return res.success(
      "Assignments fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch assignments");
  }
};
