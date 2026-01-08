import MedicationReminder from "../models/medicationReminderModel.js";
import SystemLog from "../models/systemLogModel.js";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import Patient from "../models/patientModel.js";
import {
  notifyMedicationReminderCreated,
  notifyMedicationReminderDue,
} from "../utils/notify.js";

// Create plan/schedule
export const createReminder = async (data, createdBy) => {
  const reminder = await MedicationReminder.create([{ ...data, createdBy }]);
  const saved = reminder[0].toObject();

  await SystemLog.create({
    action: "medication_reminder_created",
    entityType: "MedicationReminder",
    entityId: saved._id,
    performedBy: createdBy,
    metadata: { patientId: saved.patientId, frequency: saved.frequency },
  });

  // SEND NOTIFICATIONS TO ALL RELEVANT USERS
  try {
    await notifyMedicationReminderCreated({
      reminderId: saved._id,
      patientId: saved.patientId,
      medicationName: saved.medicationName,
      dosage: saved.dosage,
      frequency: saved.frequency,
      startDate: saved.startDate,
      endDate: saved.endDate,
      createdByUserId: createdBy,
      sendFCM: true,
    });
  } catch (error) {
    console.error(
      "❌ Error sending medication reminder creation notifications:",
      error
    );
  }

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
    MedicationReminder.countDocuments(query),
  ]);

  await SystemLog.create({
    action: "medication_reminders_viewed",
    entityType: "MedicationReminder",
    metadata: { filters, page, limit, count: reminders.length },
  });

  return {
    reminders,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
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
      message: "Medication reminder not found",
    };
  }

  await SystemLog.create({
    action: "medication_reminder_viewed",
    entityType: "MedicationReminder",
    entityId: id,
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
      message: "Medication reminder not found",
    };
  }

  await SystemLog.create({
    action: "medication_reminder_updated",
    entityType: "MedicationReminder",
    entityId: id,
    metadata: { fields: Object.keys(updates) },
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
      message: "Medication reminder not found",
    };
  }

  await SystemLog.create({
    action: "medication_reminder_status_updated",
    entityType: "MedicationReminder",
    entityId: id,
    metadata: { status },
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
      message: "Medication reminder not found",
    };
  }

  const createdLog = updated.logs[updated.logs.length - 1];

  await SystemLog.create({
    action: "medication_log_added",
    entityType: "MedicationReminder",
    entityId: id,
    metadata: { logId: createdLog?._id, status: log.status },
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
      $gte: new Date(from),
    };
  if (to)
    logMatch["logs.date"] = {
      ...(logMatch["logs.date"] || {}),
      $lte: new Date(to),
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
        total: { $sum: 1 },
      },
    },
  ].filter(Boolean);

  const agg = await MedicationReminder.aggregate(pipeline);

  const logs = agg[0]?.logs || [];
  const total = agg[0]?.total || 0;

  await SystemLog.create({
    action: "medication_logs_viewed",
    entityType: "MedicationReminder",
    entityId: id,
    metadata: { status, from, to, page, limit, count: logs.length },
  });

  return {
    logs,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
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
      message: "No valid fields to update",
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
      message: "Medication log not found",
    };
  }

  await SystemLog.create({
    action: "medication_log_updated",
    entityType: "MedicationReminder",
    metadata: { logId, fields: Object.keys(updates) },
  });

  const log = (updated.logs || []).find((l) => String(l._id) === String(logId));
  return log;
};

export const getNurseLatestReminders = async (user, limit = 4) => {
  let patientIds = [];

  if (user.role === "nurse") {
    const nursePatients = await Patient.find({
      nurseIds: { $in: [user._id] },
    })
      .select("_id")
      .lean();

    patientIds = nursePatients.map((p) => p._id);
  } else if (user.role === "hospital") {
    const hospitalPatients = await Patient.find({
      hospitalId: user._id,
    })
      .select("_id")
      .lean();

    patientIds = hospitalPatients.map((p) => p._id);
  }

  if (patientIds.length === 0) {
    return {
      reminders: [],
      count: 0,
    };
  }

  const reminders = await MedicationReminder.find({
    patientId: { $in: patientIds },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("-__v")
    .populate({ path: "createdBy", select: "firstName lastName email" })
    .populate({
      path: "patientId",
      select: "patientUserId hospitalId",
      populate: {
        path: "patientUserId",
        select: "firstName lastName",
      },
    })
    .lean();

  await SystemLog.create({
    action: `${user.role}_latest_medication_reminders_viewed`,
    entityType: "MedicationReminder",
    metadata: {
      userId: user._id,
      userRole: user.role,
      limit,
      count: reminders.length,
      patientCount: patientIds.length,
    },
  });

  return {
    reminders,
    count: reminders.length,
  };
};
// export const getNurseLatestReminders = async (nurse, limit = 4) => {
//   const nursePatients = await Patient.find({
//     nurseIds: { $in: [nurse._id] },
//   })
//     .select("_id")
//     .lean();

//   const patientIds = nursePatients.map((p) => p._id);

//   if (patientIds.length === 0) {
//     return {
//       reminders: [],
//       count: 0,
//     };
//   }

//   const reminders = await MedicationReminder.find({
//     patientId: { $in: patientIds },
//   })
//     .sort({ createdAt: -1 })
//     .limit(limit)
//     .select("-__v")
//     .populate({ path: "createdBy", select: "firstName lastName email" })
//     .populate({
//       path: "patientId",
//       select: "patientUserId",
//       populate: {
//         path: "patientUserId",
//         select: "firstName lastName",
//       },
//     })
//     .lean();

//   await SystemLog.create({
//     action: "nurse_latest_medication_reminders_viewed",
//     entityType: "MedicationReminder",
//     metadata: {
//       nurseId: nurse._id,
//       limit,
//       count: reminders.length,
//       patientCount: patientIds.length,
//     },
//   });

//   return {
//     reminders,
//     count: reminders.length,
//   };
// };

/**
 * Get medication reminders that need notifications
 * This will be called by cron job
 */
export const getMedicationsDueForNotification = async () => {
  const now = new Date();

  // Find reminders with specific times within the last 5 minutes that haven't been notified
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  const reminders = await MedicationReminder.find({
    status: "active",
    startDate: { $lte: now },
    $or: [{ endDate: { $gte: now } }, { endDate: null }],
    specificTimes: { $exists: true, $ne: [] },
  })
    .select(
      "_id medicationName dosage notes patientId specificTimes lastNotifiedAt"
    )
    .lean();

  // Filter reminders that have a specific time matching current time
  const dueReminders = [];

  for (const reminder of reminders) {
    for (const timeStr of reminder.specificTimes || []) {
      try {
        // Parse time string (e.g., "08:00", "14:30")
        const [hours, minutes] = timeStr.split(":").map(Number);

        const scheduledTime = new Date();
        scheduledTime.setHours(hours, minutes, 0, 0);

        // Check if this time is within the notification window
        if (scheduledTime >= fiveMinutesAgo && scheduledTime <= now) {
          // Check if we haven't notified for this time today
          const lastNotified = reminder.lastNotifiedAt;
          const shouldNotify =
            !lastNotified ||
            new Date(lastNotified).toDateString() !== now.toDateString() ||
            new Date(lastNotified).getHours() !== hours ||
            new Date(lastNotified).getMinutes() !== minutes;

          if (shouldNotify) {
            dueReminders.push({
              ...reminder,
              scheduledTime,
              specificTime: timeStr,
            });
          }
        }
      } catch (error) {
        console.error(`Error parsing time ${timeStr}:`, error);
      }
    }
  }

  return dueReminders;
};

/**
 * Mark medication reminder as notified for specific time
 */
export const markMedicationAsNotified = async (reminderId) => {
  await MedicationReminder.findByIdAndUpdate(reminderId, {
    $set: { lastNotifiedAt: new Date() },
  });
};

/**
 * Send scheduled medication notifications
 * Called by cron job
 */
export const sendScheduledMedicationNotifications = async () => {
  try {
    const medications = await getMedicationsDueForNotification();

    console.log(
      `\n💊 Checking scheduled medications: ${medications.length} found`
    );

    for (const medication of medications) {
      try {
        await notifyMedicationReminderDue({
          reminderId: medication._id,
          medicationName: medication.medicationName,
          dosage: medication.dosage,
          patientId: medication.patientId,
          scheduledTime: medication.scheduledTime,
          notes: medication.notes,
          sendFCM: true,
        });

        // Mark as notified
        await markMedicationAsNotified(medication._id);

        console.log(
          `✅ Notified for medication: ${medication.medicationName} at ${medication.specificTime}`
        );
      } catch (error) {
        console.error(
          `❌ Error notifying medication ${medication._id}:`,
          error
        );
      }
    }

    return {
      success: true,
      notified: medications.length,
    };
  } catch (error) {
    console.error("❌ Error in sendScheduledMedicationNotifications:", error);
    return {
      success: false,
      error: error.message,
    };
  }
};
