// services/reportService.js
import { StatusCodes } from "http-status-codes";
import Report from "../models/patientReportModel.js";
import SystemLog from "../models/systemLogModel.js";
import BehaviorLog from "../models/behaviorLogModel.js";
import Activity from "../models/activityModel.js";
import MedicationReminder from "../models/medicationReminderModel.js";
import Incident from "../models/incidentModel.js";

// ----- helpers -----
const within = (from, to) => ({ $gte: new Date(from), $lte: new Date(to) });

// Build content by aggregating across modules for the period
export const generateReportContent = async (patientId, start, end) => {
  const [behavior, activities, incidents] = await Promise.all([
    BehaviorLog.aggregate([
      { $match: { patientId, date: within(start, end) } },
      {
        $group: {
          _id: "$mood",
          count: { $sum: 1 }
        }
      }
    ]),
    Activity.aggregate([
      { $match: { patientId, "schedule.start": within(start, end) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]),
    Incident.aggregate([
      { $match: { patientId, occurredAt: within(start, end) } },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      }
    ])
  ]);

  // medication adherence: taken / (taken+missed+skipped+partial)
  const medAgg = await MedicationReminder.aggregate([
    { $match: { patientId, status: { $in: ["active", "completed"] }, startDate: { $lte: new Date(end) } } },
    { $unwind: "$logs" },
    { $match: { "logs.date": within(start, end) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        taken: {
          $sum: { $cond: [{ $eq: ["$logs.status", "taken"]], 1, 0] }
        }
      }
    }
  ]);

  const medTotal = medAgg[0]?.total || 0;
  const medTaken = medAgg[0]?.taken || 0;
  const medicationAdherence = medTotal ? Math.round((medTaken / medTotal) * 100) : 0;

  // activity participation: completed / scheduled
  const activityAgg = await Activity.aggregate([
    { $match: { patientId, "schedule.start": within(start, end) } },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        completed: {
          $sum: { $cond: [{ $eq: ["$status", "completed"]], 1, 0] }
        }
      }
    }
  ]);
  const actTotal = activityAgg[0]?.total || 0;
  const actCompleted = activityAgg[0]?.completed || 0;
  const activityParticipation = actTotal ? Math.round((actCompleted / actTotal) * 100) : 0;

  const behaviorTrends = behavior.map(b => ({
    metric: "mood",
    labels: [b._id || "unknown"],
    values: [b.count]
  }));

  const incidentCount = incidents.reduce((s, i) => s + i.count, 0);

  return {
    summary: "",
    behaviorTrends,
    medicationAdherence,
    activityParticipation,
    incidentCount,
    notes: ""
  };
};

// ----- main service methods -----

export const createReport = async ({ patientId, type, period, sharedWith = [] }, createdBy) => {
  const content = await generateReportContent(patientId, period.start, period.end);

  const doc = await Report.create([{
    patientId,
    generatedBy: createdBy,
    type,
    period,
    content,
    sharedWith
  }]);

  await SystemLog.create({
    action: "report_created",
    entityType: "Report",
    entityId: doc[0]._id,
    performedBy: createdBy,
    metadata: { patientId, type, period }
  });

  return doc[0].toObject();
};

export const getReports = async (filters = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const q = { patientId: filters.patientId };
  if (filters.from || filters.to) {
    q["period.end"] = {};
    if (filters.from) q["period.end"].$gte = new Date(filters.from);
    if (filters.to) q["period.end"].$lte = new Date(filters.to);
  }

  const [items, total] = await Promise.all([
    Report.find(q)
      .sort({ "period.end": -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .populate({ path: "generatedBy", select: "firstName lastName role email" })
      .lean(),
    Report.countDocuments(q)
  ]);

  await SystemLog.create({
    action: "reports_viewed",
    entityType: "Report",
    metadata: { filters, page, limit, count: items.length }
  });

  return {
    reports: items,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
};

export const getReportById = async (id) => {
  const report = await Report.findById(id)
    .select("-__v")
    .populate({ path: "generatedBy", select: "firstName lastName role email" })
    .populate({ path: "sharedWith", select: "firstName lastName email role" })
    .lean();

  if (!report) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Report not found" };
  }

  await SystemLog.create({
    action: "report_viewed",
    entityType: "Report",
    entityId: id
  });

  return { report };
};

export const updateReport = async (id, updates = {}, performedBy) => {
  const updated = await Report.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true }
  ).select("-__v").lean();

  if (!updated) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Report not found" };
  }

  await SystemLog.create({
    action: "report_updated",
    entityType: "Report",
    entityId: id,
    performedBy,
    metadata: { fields: Object.keys(updates) }
  });

  return updated;
};

export const shareReport = async (id, sharedWith, performedBy) => {
  const updated = await Report.findByIdAndUpdate(
    id,
    { $addToSet: { sharedWith: { $each: sharedWith } } },
    { new: true }
  ).select("-__v").lean();

  if (!updated) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Report not found" };
  }

  await SystemLog.create({
    action: "report_shared",
    entityType: "Report",
    entityId: id,
    performedBy,
    metadata: { sharedWithCount: sharedWith.length }
  });

  return updated;
};
