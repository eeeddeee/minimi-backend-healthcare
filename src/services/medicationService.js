// services/medicationService.js
import MedicationReminder from "../models/medicationReminderModel.js";
import SystemLog from "../models/systemLogModel.js";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import Patient from "../models/patientModel.js";

// Create plan/schedule
export const createReminder = async (data, createdBy) => {
  const reminder = await MedicationReminder.create([{ ...data, createdBy }]);
  const saved = reminder[0].toObject();

  await SystemLog.create({
    action: "medication_reminder_created",
    entityType: "MedicationReminder",
    entityId: saved._id,
    performedBy: createdBy,
    metadata: { patientId: saved.patientId, frequency: saved.frequency }
  });

  return saved;
};

// List reminders (by patient, status, date range overlap)
export const getReminders = async (filters = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const query = { patientId: filters.patientId };
  if (filters.status) query.status = filters.status;

  // date overlap filter (from/to against start/end)
  if (filters.from || filters.to) {
    const from = filters.from ? new Date(filters.from) : null;
    const to = filters.to ? new Date(filters.to) : null;

    query.$and = [];
    if (from) query.$and.push({ endDate: { $gte: from } });
    if (to) query.$and.push({ startDate: { $lte: to } });
    if (!query.$and.length) delete query.$and;
  }

  const [reminders, total] = await Promise.all([
    MedicationReminder.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .populate({ path: "createdBy", select: "firstName lastName email" })
      .lean(),
    MedicationReminder.countDocuments(query)
  ]);

  await SystemLog.create({
    action: "medication_reminders_viewed",
    entityType: "MedicationReminder",
    metadata: { filters, page, limit, count: reminders.length }
  });

  return {
    reminders,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
};

// Single reminder
export const getReminderById = async (id) => {
  const reminder = await MedicationReminder.findById(id)
    .select("-__v")
    .populate({ path: "createdBy", select: "firstName lastName email" })
    .lean();

  if (!reminder) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Medication reminder not found"
    };
  }

  await SystemLog.create({
    action: "medication_reminder_viewed",
    entityType: "MedicationReminder",
    entityId: id
  });

  return { reminder };
};

// Update plan
export const updateReminder = async (id, updates = {}) => {
  // prevent status change here (separate endpoint)
  delete updates.status;

  const updated = await MedicationReminder.findByIdAndUpdate(
    id,
    { $set: updates, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Medication reminder not found"
    };
  }

  await SystemLog.create({
    action: "medication_reminder_updated",
    entityType: "MedicationReminder",
    entityId: id,
    metadata: { fields: Object.keys(updates) }
  });

  return updated;
};

// Update status (active/completed/cancelled)
export const updateReminderStatus = async (id, status) => {
  const updated = await MedicationReminder.findByIdAndUpdate(
    id,
    { $set: { status }, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Medication reminder not found"
    };
  }

  await SystemLog.create({
    action: "medication_reminder_status_updated",
    entityType: "MedicationReminder",
    entityId: id,
    metadata: { status }
  });

  return updated;
};

// Add a log to reminder
export const addReminderLog = async (id, log, notedBy) => {
  const payload = { ...log, notedBy };

  const updated = await MedicationReminder.findByIdAndUpdate(
    id,
    { $push: { logs: payload }, $currentDate: { updatedAt: true } },
    { new: true }
  ).lean();

  if (!updated) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Medication reminder not found"
    };
  }

  const createdLog = updated.logs[updated.logs.length - 1];

  await SystemLog.create({
    action: "medication_log_added",
    entityType: "MedicationReminder",
    entityId: id,
    metadata: { logId: createdLog?._id, status: log.status }
  });

  return createdLog;
};

// Get logs of a reminder (paginated)
export const getReminderLogs = async (
  id,
  { status, from, to, page = 1, limit = 10 }
) => {
  const skip = (page - 1) * limit;

  const matchStage = [{ _id: new mongoose.Types.ObjectId(id) }];
  const logMatch = {};

  if (status) logMatch["logs.status"] = status;
  if (from)
    logMatch["logs.date"] = {
      ...(logMatch["logs.date"] || {}),
      $gte: new Date(from)
    };
  if (to)
    logMatch["logs.date"] = {
      ...(logMatch["logs.date"] || {}),
      $lte: new Date(to)
    };

  const pipeline = [
    { $match: { $and: matchStage } },
    { $unwind: "$logs" },
    Object.keys(logMatch).length ? { $match: logMatch } : null,
    { $sort: { "logs.date": -1 } },
    { $skip: skip },
    { $limit: limit },
    {
      $group: {
        _id: "$_id",
        logs: { $push: "$logs" },
        total: { $sum: 1 }
      }
    }
  ].filter(Boolean);

  const agg = await MedicationReminder.aggregate(pipeline);

  const logs = agg[0]?.logs || [];
  const total = agg[0]?.total || 0;

  await SystemLog.create({
    action: "medication_logs_viewed",
    entityType: "MedicationReminder",
    entityId: id,
    metadata: { status, from, to, page, limit, count: logs.length }
  });

  return {
    logs,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
};

// export const updateReminderLog = async (logId, updates = {}) => {
//   const filter = { "logs._id": new mongoose.Types.ObjectId(logId) };

//   const update = {};
//   if (updates.status !== undefined) update["logs.$.status"] = updates.status;
//   if (updates.notes !== undefined) update["logs.$.notes"] = updates.notes;
//   if (!Object.keys(update).length) {
//     throw {
//       statusCode: StatusCodes.BAD_REQUEST,
//       message: "No valid fields to update"
//     };
//   }

//   const updated = await MedicationReminder.findOneAndUpdate(
//     filter,
//     { $set: update },
//     { new: true }
//   ).lean();

//   if (!updated) {
//     throw {
//       statusCode: StatusCodes.NOT_FOUND,
//       message: "Medication log not found"
//     };
//   }

//   return updated.logs.find((log) => String(log._id) === String(logId));
// };

// // Update a specific log
export const updateReminderLog = async (logId, updates = {}) => {
  const filter = { "logs._id": new mongoose.Types.ObjectId(logId) };

  const update = {};
  if (updates.status !== undefined) update["logs.$.status"] = updates.status;
  if (updates.notes !== undefined) update["logs.$.notes"] = updates.notes;
  if (!Object.keys(update).length) {
    throw {
      statusCode: StatusCodes.BAD_REQUEST,
      message: "No valid fields to update"
    };
  }

  const updated = await MedicationReminder.findOneAndUpdate(
    filter,
    { $set: update },
    { new: true }
  ).lean();

  if (!updated) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Medication log not found"
    };
  }

  await SystemLog.create({
    action: "medication_log_updated",
    entityType: "MedicationReminder",
    metadata: { logId, fields: Object.keys(updates) }
  });

  const log = (updated.logs || []).find((l) => String(l._id) === String(logId));
  return log;
};

export const getNurseLatestReminders = async (nurse, limit = 4) => {
  const nursePatients = await Patient.find({
    nurseIds: { $in: [nurse._id] }
  })
    .select("_id")
    .lean();

  const patientIds = nursePatients.map((p) => p._id);

  if (patientIds.length === 0) {
    return {
      reminders: [],
      count: 0
    };
  }

  const reminders = await MedicationReminder.find({
    patientId: { $in: patientIds }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("-__v")
    .populate({ path: "createdBy", select: "firstName lastName email" })
    .populate({
      path: "patientId",
      select: "patientUserId",
      populate: {
        path: "patientUserId",
        select: "firstName lastName"
      }
    })
    .lean();

  await SystemLog.create({
    action: "nurse_latest_medication_reminders_viewed",
    entityType: "MedicationReminder",
    metadata: {
      nurseId: nurse._id,
      limit,
      count: reminders.length,
      patientCount: patientIds.length
    }
  });

  return {
    reminders,
    count: reminders.length
  };
};