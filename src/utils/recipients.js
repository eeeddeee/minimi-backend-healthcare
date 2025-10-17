import mongoose from "mongoose";
import Patient from "../models/patientModel.js";
import User from "../models/userModel.js";

const idToStr = (v) => (v ? String(v) : null);

export async function getPatientScopedRecipients(patientId) {
  // 1) Load patient + minimal relations
  const p = await Patient.findById(patientId)
    .select("_id createdBy caregivers primaryCaregiverId familyMemberIds")
    .lean();

  if (!p) return { hospital: [], caregivers: [], family: [], all: [] };

  // 2) Hospital admin (patient.createdBy)
  const hospital = p.createdBy ? [idToStr(p.createdBy)] : [];

  // 3) Caregivers (array + primaryCaregiverId)
  //  - caregivers can be array of userIds or subdocs => normalize to userId strings
  const cgSet = new Set();
  if (Array.isArray(p.caregivers)) {
    p.caregivers.forEach((c) => {
      const uid = typeof c === "object" && c?.userId ? c.userId : c; // handle {userId:..} or direct id
      if (uid) cgSet.add(idToStr(uid));
    });
  }
  if (p.primaryCaregiverId) cgSet.add(idToStr(p.primaryCaregiverId));
  const caregivers = [...cgSet].filter(Boolean);

  // 4) Family members
  const famSet = new Set();
  if (Array.isArray(p.familyMemberIds)) {
    p.familyMemberIds.forEach((f) => f && famSet.add(idToStr(f)));
  }
  const family = [...famSet].filter(Boolean);

  // Optional: verify users actually exist & are active (role guards)
  const keepIds = async (ids, roles) => {
    if (!ids.length) return [];
    const rows = await User.find({
      _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) },
      isDeleted: { $ne: true },
      isActive: { $ne: false },
      ...(roles?.length ? { role: { $in: roles } } : {}),
    })
      .select("_id")
      .lean();
    return rows.map((r) => idToStr(r._id));
  };

  const hospitalOk = await keepIds(hospital, ["hospital"]);
  const caregiversOk = await keepIds(caregivers, ["caregiver"]);
  const familyOk = await keepIds(family, ["family"]);

  // final unique
  const all = [...new Set([...hospitalOk, ...caregiversOk, ...familyOk])];

  return {
    hospital: hospitalOk,
    caregivers: caregiversOk,
    family: familyOk,
    all,
  };
}
