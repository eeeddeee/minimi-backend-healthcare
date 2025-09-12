// services/behaviorService.js
import { StatusCodes } from "http-status-codes";
import BehaviorLog from "../models/behaviorLogModel.js";
import SystemLog from "../models/systemLogModel.js";
import Patient from "../models/patientModel.js";  

// CREATE
export const createBehaviorLog = async (data, createdBy) => {
  const log = await BehaviorLog.create([{ ...data }]);
  const saved = log[0].toObject();

  await SystemLog.create({
    action: "behavior_log_created",
    entityType: "BehaviorLog",
    entityId: saved._id,
    performedBy: createdBy,
    metadata: {
      patientId: saved.patientId,
      caregiverId: saved.caregiverId,
      mood: saved.mood
    }
  });

  return saved;
};

// LIST (filters + pagination)
export const getBehaviorLogs = async (filters = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const query = { patientId: filters.patientId };
  if (filters.caregiverId) query.caregiverId = filters.caregiverId;
  if (filters.mood) query.mood = filters.mood;
  if (filters.from || filters.to) {
    query.date = {};
    if (filters.from) query.date.$gte = new Date(filters.from);
    if (filters.to) query.date.$lte = new Date(filters.to);
  }
  if (filters.incidentType) {
    query["incidents.type"] = filters.incidentType;
  }
  if (filters.severityMin || filters.severityMax) {
    query["incidents.severity"] = {};
    if (filters.severityMin)
      query["incidents.severity"].$gte = Number(filters.severityMin);
    if (filters.severityMax)
      query["incidents.severity"].$lte = Number(filters.severityMax);
  }

  const [logs, total] = await Promise.all([
    BehaviorLog.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .populate({
        path: "patientId",
        select: "firstName lastName role email",
        populate: {
          path: "patientUserId",
          select: "firstName lastName email phone"
        }
      })
      .lean(),
    BehaviorLog.countDocuments(query)
  ]); 

  // Fetch additional patient details from the Patient collection
  const patientIds = logs.map((log) => log.patientId._id); // Extract patient IDs from logs
  const patients = await Patient.find({ _id: { $in: patientIds } }).lean();

  // Map logs with patient details
  const detailedLogs = logs.map((log) => {
    const patientDetail = patients.find(
      (patient) => patient._id.toString() === log.patientId._id.toString()
    );
    return {
      ...log,
      patientDetails: {
        medicalConditions: patientDetail.medicalConditions,
        allergies: patientDetail.allergies,
        emergencyContacts: patientDetail.emergencyContacts,
        bloodGroup: patientDetail.bloodGroup,
        insurance: patientDetail.insurance,
        status: patientDetail.status
      }
    };
  });

  await SystemLog.create({
    action: "behavior_logs_viewed",
    entityType: "BehaviorLog",
    metadata: { filters, page, limit, count: detailedLogs.length }
  });

  return {
    logs: detailedLogs,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
};

// GET BY ID
export const getBehaviorLogById = async (id) => {
  const log = await BehaviorLog.findById(id).select("-__v").lean();
  if (!log) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Behavior log not found"
    };
  }

  await SystemLog.create({
    action: "behavior_log_viewed",
    entityType: "BehaviorLog",
    entityId: id
  });

  return { log };
};

// UPDATE (full/partial)
export const updateBehaviorLog = async (id, updates = {}) => {
  const updated = await BehaviorLog.findByIdAndUpdate(
    id,
    { $set: updates, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Behavior log not found"
    };
  }

  await SystemLog.create({
    action: "behavior_log_updated",
    entityType: "BehaviorLog",
    entityId: id,
    metadata: { fields: Object.keys(updates) }
  });

  return updated;
};


// Append a new incident
export const addIncidentToBehaviorLog = async (logId, incident, userId) => {
  const updated = await BehaviorLog.findByIdAndUpdate(
    logId,
    { $push: { incidents: incident }, $currentDate: { updatedAt: true } },
    { new: true }
  ).select("-__v").lean();

  if (!updated) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Behavior log not found" };
  }

  await SystemLog.create({
    action: "behavior_log_incident_added",
    entityType: "BehaviorLog",
    entityId: logId,
    performedBy: userId,
    metadata: { incidentType: incident.type }
  });

  return updated;
};

// Update specific incident in array
export const updateIncidentInBehaviorLog = async (logId, incidentId, updates, userId) => {
  const updated = await BehaviorLog.findOneAndUpdate(
    { _id: logId, "incidents._id": incidentId },
    { $set: Object.fromEntries(Object.entries(updates).map(([k, v]) => [`incidents.$.${k}`, v])) },
    { new: true }
  ).select("-__v").lean();

  if (!updated) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Behavior log or incident not found" };
  }

  await SystemLog.create({
    action: "behavior_log_incident_updated",
    entityType: "BehaviorLog",
    entityId: logId,
    performedBy: userId,
    metadata: { incidentId }
  });

  return updated;
};

// Similar for meals
export const addMealToBehaviorLog = async (logId, meal, userId) => {
  const updated = await BehaviorLog.findByIdAndUpdate(
    logId,
    { $push: { meals: meal }, $currentDate: { updatedAt: true } },
    { new: true }
  ).select("-__v").lean();

  if (!updated) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Behavior log not found" };
  }

  await SystemLog.create({
    action: "behavior_log_meal_added",
    entityType: "BehaviorLog",
    entityId: logId,
    performedBy: userId,
    metadata: { mealType: meal.type }
  });

  return updated;
};

export const updateMealInBehaviorLog = async (logId, mealId, updates, userId) => {
  const updated = await BehaviorLog.findOneAndUpdate(
    { _id: logId, "meals._id": mealId },
    { $set: Object.fromEntries(Object.entries(updates).map(([k, v]) => [`meals.$.${k}`, v])) },
    { new: true }
  ).select("-__v").lean();

  if (!updated) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Behavior log or meal not found" };
  }

  await SystemLog.create({
    action: "behavior_log_meal_updated",
    entityType: "BehaviorLog",
    entityId: logId,
    performedBy: userId,
    metadata: { mealId }
  });

  return updated;
};

// Same pattern for activities
export const addActivityToBehaviorLog = async (logId, activity, userId) => {
  const updated = await BehaviorLog.findByIdAndUpdate(
    logId,
    { $push: { activities: activity }, $currentDate: { updatedAt: true } },
    { new: true }
  ).select("-__v").lean();

  if (!updated) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Behavior log not found" };
  }

  await SystemLog.create({
    action: "behavior_log_activity_added",
    entityType: "BehaviorLog",
    entityId: logId,
    performedBy: userId,
    metadata: { activityName: activity.name }
  });

  return updated;
};

export const updateActivityInBehaviorLog = async (logId, activityId, updates, userId) => {
  const updated = await BehaviorLog.findOneAndUpdate(
    { _id: logId, "activities._id": activityId },
    { $set: Object.fromEntries(Object.entries(updates).map(([k, v]) => [`activities.$.${k}`, v])) },
    { new: true }
  ).select("-__v").lean();

  if (!updated) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Behavior log or activity not found" };
  }

  await SystemLog.create({
    action: "behavior_log_activity_updated",
    entityType: "BehaviorLog",
    entityId: logId,
    performedBy: userId,
    metadata: { activityId }
  });

  return updated;
};