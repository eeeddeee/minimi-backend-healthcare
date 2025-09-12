import { StatusCodes } from "http-status-codes";
import Patient from "../models/patientModel.js";
import SystemLog from "../models/systemLogModel.js";
import { recordStatusChange } from "./patientStatusHistoryService.js";

export const getPatientStatus = async (patientId) => {
  const patient = await Patient.findById(patientId)
    .select("status updatedAt")
    .lean();

  if (!patient) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Patient not found" };
  }

  await SystemLog.create({
    action: "patient_status_viewed",
    entityType: "Patient",
    entityId: patientId
  });

  return { status: patient.status, updatedAt: patient.updatedAt };
};

export const updatePatientStatus = async (
  patientId,
  { status, notes, effectiveAt },
  performedBy
) => {
  const current = await Patient.findById(patientId).select("status").lean();
  if (!current) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Patient not found" };
  }

  // Update patient
  const updated = await Patient.findByIdAndUpdate(
    patientId,
    { $set: { status }, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("status updatedAt hospitalId patientUserId")
    .lean();

  // Audit log
  await SystemLog.create({
    action: "patient_status_updated",
    entityType: "Patient",
    entityId: patientId,
    performedBy: performedBy._id,
    metadata: { status, notes, effectiveAt: effectiveAt || new Date() }
  });

  // Record history (only if changed)
  if (current.status !== status) {
    await recordStatusChange({
      patientId,
      fromStatus: current.status ?? null,
      toStatus: status,
      changedBy: performedBy._id,
      notes,
      effectiveAt
    });
  }

  return { status: updated.status, updatedAt: updated.updatedAt };
};

// import { StatusCodes } from "http-status-codes";
// import Patient from "../models/patientModel.js";
// import SystemLog from "../models/systemLogModel.js";
// import { recordStatusChange } from "./patientStatusHistoryService.js";

// export const getPatientStatus = async (patientId) => {
//   const patient = await Patient.findById(patientId)
//     .select("status updatedAt")
//     .lean();

//   if (!patient) {
//     throw { statusCode: StatusCodes.NOT_FOUND, message: "Patient not found" };
//   }

//   await SystemLog.create({
//     action: "patient_status_viewed",
//     entityType: "Patient",
//     entityId: patientId
//   });

//   return { status: patient.status, updatedAt: patient.updatedAt };
// };

// export const updatePatientStatus = async (
//   patientId,
//   { status, notes, effectiveAt },
//   performedBy
// ) => {
//   const updated = await Patient.findByIdAndUpdate(
//     patientId,
//     { $set: { status }, $currentDate: { updatedAt: true } },
//     { new: true }
//   )
//     .select("status updatedAt hospitalId patientUserId")
//     .lean();

//   if (!updated) {
//     throw { statusCode: StatusCodes.NOT_FOUND, message: "Patient not found" };
//   }

//   await SystemLog.create({
//     action: "patient_status_updated",
//     entityType: "Patient",
//     entityId: patientId,
//     performedBy: performedBy._id,
//     metadata: { status, notes, effectiveAt: effectiveAt || new Date() }
//   });

//   return { status: updated.status, updatedAt: updated.updatedAt };
// };
