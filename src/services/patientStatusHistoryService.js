// services/patientStatusHistoryService.js
import PatientStatusHistory from "../models/patientStatusHistoryModel.js";
import SystemLog from "../models/systemLogModel.js";

export const recordStatusChange = async ({
  patientId,
  fromStatus,
  toStatus,
  changedBy,
  notes,
  effectiveAt
}) => {
  const doc = await PatientStatusHistory.create([
    {
      patientId,
      fromStatus: fromStatus ?? null,
      toStatus,
      changedBy,
      notes,
      effectiveAt: effectiveAt || new Date()
    }
  ]);
  const saved = doc[0].toObject();

  await SystemLog.create({
    action: "patient_status_history_recorded",
    entityType: "PatientStatusHistory",
    entityId: saved._id,
    performedBy: changedBy,
    metadata: { patientId, fromStatus, toStatus }
  });

  return saved;
};

export const getHistoryByPatient = async (
  patientId,
  { from, to, page = 1, limit = 10 }
) => {
  const skip = (page - 1) * limit;

  const q = { patientId };
  if (from || to) {
    q.effectiveAt = {};
    if (from) q.effectiveAt.$gte = new Date(from);
    if (to) q.effectiveAt.$lte = new Date(to);
  }

  const [items, total] = await Promise.all([
    PatientStatusHistory.find(q)
      .sort({ effectiveAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .populate({ path: "changedBy", select: "firstName lastName email role" })
      .lean(),
    PatientStatusHistory.countDocuments(q)
  ]);

  await SystemLog.create({
    action: "patient_status_history_viewed",
    entityType: "PatientStatusHistory",
    metadata: { patientId, from, to, page, limit, count: items.length }
  });

  return {
    history: items,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
};
