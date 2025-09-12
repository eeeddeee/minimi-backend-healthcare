// services/assignmentService.js
import { StatusCodes } from "http-status-codes";
import SystemLog from "../models/systemLogModel.js";
import Patient from "../models/patientModel.js";
import Caregiver from "../models/caregiverModel.js";
import FamilyMember from "../models/familyModel.js";
import Nurse from "../models/nurseModel.js";
import User from "../models/userModel.js";

/**
 * Common hospital / access checks:
 * - Nurse must be in same hospital as the patient.
 * - Caregiver/Family user must exist and be valid role.
 * - Caregiver profile must belong to same hospital.
 * - FamilyMember profile: if not found for this patient, create one (with provided flags).
 */


export const ensureNurseInHospital = async (nurseUserId, hospitalId) => {
  // user role must be nurse
  const user = await User.findById(nurseUserId).lean();
  if (!user || user.role !== "nurse") {
    throw {
      statusCode: StatusCodes.BAD_REQUEST,
      message: "Invalid nurse user"
    };
  }
  // nurse profile must match hospital
  const nurse = await Nurse.findOne({ nurseUserId, hospitalId }).lean();
  if (!nurse) {
    throw {
      statusCode: StatusCodes.FORBIDDEN,
      message: "Nurse not in your hospital"
    };
  }
  return { user, nurse };
};




export const ensurePatientInHospital = async (patientId, hospitalId) => {
  const patient = await Patient.findById(patientId).lean();
  if (!patient) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Patient not found" };
  }
  if (String(patient.hospitalId) !== String(hospitalId)) {
    throw {
      statusCode: StatusCodes.FORBIDDEN,
      message: "Patient not in your hospital"
    };
  }
  return patient;
};

export const ensureCaregiverInHospital = async (
  caregiverUserId,
  hospitalId
) => {
  // user role must be caregiver
  const user = await User.findById(caregiverUserId).lean();
  if (!user || user.role !== "caregiver") {
    throw {
      statusCode: StatusCodes.BAD_REQUEST,
      message: "Invalid caregiver user"
    };
  }
  // caregiver profile must match hospital
  const caregiver = await Caregiver.findOne({
    caregiverUserId,
    hospitalId
  }).lean();
  if (!caregiver) {
    throw {
      statusCode: StatusCodes.FORBIDDEN,
      message: "Caregiver not in your hospital"
    };
  }
  return { user, caregiver };
};

export const ensureFamilyUser = async (familyMemberUserId) => {
  const user = await User.findById(familyMemberUserId).lean();
  if (!user || user.role !== "family") {
    throw {
      statusCode: StatusCodes.BAD_REQUEST,
      message: "Invalid family member user"
    };
  }
  return user;
};

// Assign caregiver (primary/secondary)
export const assignCaregiverToPatient = async ({
  patientId,
  caregiverUserId,
  isPrimary,
  performedBy
}) => {
  // performedBy is nurse/hospital user with hospitalId
  const hospitalId = performedBy.hospitalId || performedBy._id;

  const patient = await ensurePatientInHospital(patientId, hospitalId);
  await ensureCaregiverInHospital(caregiverUserId, patient.hospitalId);

  const updateOp = isPrimary
    ? { $addToSet: { primaryCaregiverId: caregiverUserId } }
    : { $addToSet: { secondaryCaregiverIds: caregiverUserId } };

  const updated = await Patient.findByIdAndUpdate(patientId, updateOp, {
    new: true
  }).lean();

  await SystemLog.create({
    action: "patient_caregiver_assigned",
    entityType: "Patient",
    entityId: patientId,
    performedBy: performedBy._id,
    metadata: { caregiverUserId, isPrimary }
  });

  return updated;
};

// Assign family member (create FamilyMember profile if missing, then link on patient)
export const assignFamilyMemberToPatient = async ({
  patientId,
  familyMemberUserId,
  relationship = "other",
  canMakeAppointments = false,
  canAccessMedicalRecords = false,
  performedBy
}) => {
  const hospitalId = performedBy.hospitalId || performedBy._id;

  const patient = await ensurePatientInHospital(patientId, hospitalId);
  await ensureFamilyUser(familyMemberUserId);

  // ensure FamilyMember profile exists for patient+user
  let profile = await FamilyMember.findOne({
    patientId,
    familyMemberUserId
  }).lean();

  if (!profile) {
    // create minimal profile
    const created = await FamilyMember.create([
      {
        familyMemberUserId,
        patientId,
        relationship,
        canMakeAppointments,
        canAccessMedicalRecords,
        createdBy: performedBy._id
      }
    ]);
    profile = created[0].toObject();
  } else {
    // update permissions if provided (idempotent)
    const changes = {};
    if (relationship) changes.relationship = relationship;
    if (typeof canMakeAppointments === "boolean")
      changes.canMakeAppointments = canMakeAppointments;
    if (typeof canAccessMedicalRecords === "boolean")
      changes.canAccessMedicalRecords = canAccessMedicalRecords;
    if (Object.keys(changes).length) {
      await FamilyMember.findByIdAndUpdate(profile._id, { $set: changes });
    }
  }

  // link userId to patient.familyMemberIds
  const updated = await Patient.findByIdAndUpdate(
    patientId,
    { $addToSet: { familyMemberIds: familyMemberUserId } },
    { new: true }
  ).lean();

  await SystemLog.create({
    action: "patient_family_member_assigned",
    entityType: "Patient",
    entityId: patientId,
    performedBy: performedBy._id,
    metadata: { familyMemberUserId, relationship }
  });

  return { patient: updated, familyProfile: profile };
};

// --- UNASSIGN CAREGIVER ---
export const unassignCaregiverFromPatient = async ({
  patientId,
  caregiverUserId,
  type,
  performedBy
}) => {
  const hospitalId = performedBy.hospitalId || performedBy._id;
  await ensurePatientInHospital(patientId, hospitalId);

  // verify caregiver exists (optional strict)
  const caregiverUser = await User.findById(caregiverUserId).lean();
  if (!caregiverUser || caregiverUser.role !== "caregiver") {
    throw { statusCode: StatusCodes.BAD_REQUEST, message: "Invalid caregiver user" };
  }

  const pull = {};
  if (!type || type === "primary") pull.primaryCaregiverId = caregiverUserId;
  if (!type || type === "secondary") pull.secondaryCaregiverIds = caregiverUserId;

  const updated = await Patient.findByIdAndUpdate(
    patientId,
    { $pull: pull },
    { new: true }
  ).lean();

  await SystemLog.create({
    action: "patient_caregiver_unassigned",
    entityType: "Patient",
    entityId: patientId,
    performedBy: performedBy._id,
    metadata: { caregiverUserId, type: type || "both" }
  });

  return updated;
};

// --- UNASSIGN FAMILY MEMBER ---
export const unassignFamilyMemberFromPatient = async ({
  patientId,
  familyMemberUserId,
  performedBy
}) => {
  const hospitalId = performedBy.hospitalId || performedBy._id;
  await ensurePatientInHospital(patientId, hospitalId);

  const familyUser = await User.findById(familyMemberUserId).lean();
  if (!familyUser || familyUser.role !== "family") {
    throw { statusCode: StatusCodes.BAD_REQUEST, message: "Invalid family member user" };
  }

  const updated = await Patient.findByIdAndUpdate(
    patientId,
    { $pull: { familyMemberIds: familyMemberUserId } },
    { new: true }
  ).lean();

  await SystemLog.create({
    action: "patient_family_member_unassigned",
    entityType: "Patient",
    entityId: patientId,
    performedBy: performedBy._id,
    metadata: { familyMemberUserId }
  });

  // NOTE: FamilyMember profile document (patientId+userId) ko hum delete nahi kar rahe
  // taake historical links/logs safe rahein. Agar chaho to soft-delete flag add kar sakte ho.

  return updated;
};

// --- NEW: Assign nurse to patient ---
export const assignNurseToPatient = async ({ patientId, nurseUserId, performedBy }) => {
  const hospitalId = performedBy.hospitalId || performedBy._id; // hospital admin OR nurse with hospitalId
  const patient = await ensurePatientInHospital(patientId, hospitalId);
  await ensureNurseInHospital(nurseUserId, patient.hospitalId);

  const updated = await Patient.findByIdAndUpdate(
    patientId,
    { $addToSet: { nurseIds: nurseUserId } },
    { new: true }
  ).lean();

  await SystemLog.create({
    action: "patient_nurse_assigned",
    entityType: "Patient",
    entityId: patientId,
    performedBy: performedBy._id,
    metadata: { nurseUserId }
  });

  return updated;
};

// --- NEW: Unassign nurse from patient ---
export const unassignNurseFromPatient = async ({ patientId, nurseUserId, performedBy }) => {
  const hospitalId = performedBy.hospitalId || performedBy._id;
  await ensurePatientInHospital(patientId, hospitalId);

  // validate nurse user
  const user = await User.findById(nurseUserId).lean();
  if (!user || user.role !== "nurse") {
    throw {
      statusCode: StatusCodes.BAD_REQUEST,
      message: "Invalid nurse user"
    };
  }

  const updated = await Patient.findByIdAndUpdate(
    patientId,
    { $pull: { nurseIds: nurseUserId } },
    { new: true }
  ).lean();

  await SystemLog.create({
    action: "patient_nurse_unassigned",
    entityType: "Patient",
    entityId: patientId,
    performedBy: performedBy._id,
    metadata: { nurseUserId }
  });

  return updated;
};

// --- NEW: Assign caregiver to nurse (same hospital) ---
export const assignCaregiverToNurse = async ({ caregiverUserId, nurseUserId, performedBy }) => {
  const hospitalId = performedBy.hospitalId || performedBy._id;

  // validate both sides in same hospital
  const { caregiver } = await ensureCaregiverInHospital(caregiverUserId, hospitalId);
  await ensureNurseInHospital(nurseUserId, hospitalId);

  const updated = await Caregiver.findByIdAndUpdate(
    caregiver._id,
    { $set: { nurseId: nurseUserId } },
    { new: true }
  ).lean();

  await SystemLog.create({
    action: "caregiver_nurse_assigned",
    entityType: "Caregiver",
    entityId: caregiver._id,
    performedBy: performedBy._id,
    metadata: { caregiverUserId, nurseUserId }
  });

  return updated;
};

// --- NEW: Unassign caregiver from nurse ---
export const unassignCaregiverFromNurse = async ({ caregiverUserId, performedBy }) => {
  const hospitalId = performedBy.hospitalId || performedBy._id;

  const { caregiver } = await ensureCaregiverInHospital(caregiverUserId, hospitalId);

  const updated = await Caregiver.findByIdAndUpdate(
    caregiver._id,
    { $unset: { nurseId: "" } },
    { new: true }
  ).lean();

  await SystemLog.create({
    action: "caregiver_nurse_unassigned",
    entityType: "Caregiver",
    entityId: caregiver._id,
    performedBy: performedBy._id,
    metadata: { caregiverUserId }
  });

  return updated;
};

// --- LIST ASSIGNMENTS (patient-wise) ---
export const getAssignmentsByPatient = async ({ patientId, performedBy }) => {
  const hospitalId = performedBy.hospitalId || performedBy._id;
  const patient = await ensurePatientInHospital(patientId, hospitalId);

  // Populate users for clarity
  const populated = await Patient.findById(patientId)
    .select("primaryCaregiverId secondaryCaregiverIds familyMemberIds")
    .populate({ path: "primaryCaregiverId", select: "firstName lastName email phone profile_image" })
    .populate({ path: "secondaryCaregiverIds", select: "firstName lastName email phone profile_image" })
    .populate({ path: "familyMemberIds", select: "firstName lastName email phone profile_image" })
    .lean();

  // Optionally include caregiver/family profiles detail
  const caregiverProfiles = await Caregiver.find({
    caregiverUserId: { $in: [
      ...(patient.primaryCaregiverId || []),
      ...(patient.secondaryCaregiverIds || [])
    ] },
    hospitalId: patient.hospitalId
  }).select("-__v").lean();

  const familyProfiles = await FamilyMember.find({
    patientId,
    familyMemberUserId: { $in: patient.familyMemberIds || [] }
  }).select("-__v").lean();

  await SystemLog.create({
    action: "patient_assignments_viewed",
    entityType: "Patient",
    entityId: patientId,
    performedBy: performedBy._id
  });

  return {
    caregivers: {
      primary: populated.primaryCaregiverId || [],
      secondary: populated.secondaryCaregiverIds || [],
      profiles: caregiverProfiles
    },
    familyMembers: {
      users: populated.familyMemberIds || [],
      profiles: familyProfiles
    }
  };
};