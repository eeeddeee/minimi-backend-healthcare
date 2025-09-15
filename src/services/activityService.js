import { StatusCodes } from "http-status-codes";
import Activity from "../models/activityModel.js";
import SystemLog from "../models/systemLogModel.js";
import Patient from "../models/patientModel.js";

// Create
export const createActivity = async (data, createdBy) => {
  const activity = await Activity.create([{ ...data }]);
  const saved = activity[0].toObject();

  await SystemLog.create({
    action: "activity_created",
    entityType: "Activity",
    entityId: saved._id,
    performedBy: createdBy,
    metadata: { patientId: saved.patientId, name: saved.name }
  });

  return saved;
};

// List
export const getActivities = async (filters = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const query = { patientId: filters.patientId };

  if (filters.status) query.status = filters.status;
  if (filters.from || filters.to) {
    query["schedule.start"] = {};
    if (filters.from) query["schedule.start"].$gte = new Date(filters.from);
    if (filters.to) query["schedule.start"].$lte = new Date(filters.to);
  }

  const [activities, total] = await Promise.all([
    Activity.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ "schedule.start": 1 })
      .select("-__v")
      .populate({
        path: "patientId",
        select: "patientUserId",
        populate: {
          path: "patientUserId",
          select: "firstName lastName"
        }
      })
      .lean(),
    Activity.countDocuments(query)
  ]);

  await SystemLog.create({
    action: "activities_viewed",
    entityType: "Activity",
    metadata: { filters, page, limit, count: activities.length }
  });

  return {
    activities,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
};

// Get by id
export const getActivityById = async (id) => {
  const activity = await Activity.findById(id).select("-__v").lean();
  if (!activity)
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Activity not found" };

  await SystemLog.create({
    action: "activity_viewed",
    entityType: "Activity",
    entityId: id
  });

  return { activity };
};

// Update
export const updateActivity = async (id, updates = {}) => {
  const updated = await Activity.findByIdAndUpdate(
    id,
    { $set: updates, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated)
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Activity not found" };

  await SystemLog.create({
    action: "activity_updated",
    entityType: "Activity",
    entityId: id,
    metadata: { fields: Object.keys(updates) }
  });

  return updated;
};

// Update status
export const updateActivityStatus = async (id, status) => {
  const updated = await Activity.findByIdAndUpdate(
    id,
    { $set: { status }, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated)
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Activity not found" };

  await SystemLog.create({
    action: "activity_status_updated",
    entityType: "Activity",
    entityId: id,
    metadata: { status }
  });

  return updated;
};

// Update outcome
export const updateActivityOutcome = async (id, outcome, notes) => {
  const updated = await Activity.findByIdAndUpdate(
    id,
    { $set: { outcome, notes }, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated)
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Activity not found" };

  await SystemLog.create({
    action: "activity_outcome_updated",
    entityType: "Activity",
    entityId: id,
    metadata: { outcome }
  });

  return updated;
};



export const getHospitalLatestActivities = async (user, limit = 4) => {
  let patientIds = [];

  switch (user.role) {

    case "hospital":
      const hospitalPatients = await Patient.find({
        hospitalId: user._id || user.hospitalId
      })
        .select("_id")
        .lean();
      patientIds = hospitalPatients.map((p) => p._id);
      break;

    case "nurse":
      const nursePatients = await Patient.find({
        nurseIds: { $in: [user._id] }
      })
        .select("_id")
        .lean();
      patientIds = nursePatients.map((p) => p._id);
      break;

    case "caregiver":
      const caregiverPatients = await Patient.find({
        $or: [
          { primaryCaregiverId: user._id },
          { secondaryCaregiverIds: { $in: [user._id] } }
        ]
      })
        .select("_id")
        .lean();
      patientIds = caregiverPatients.map((p) => p._id);
      break;

    case "patient":
      const patientUser = await Patient.findOne({
        patientUserId: user._id
      })
        .select("_id")
        .lean();
      patientIds = patientUser ? [patientUser._id] : [];
      break;

    default:
      throw new Error("Unauthorized access");
  }

  if (patientIds.length === 0) {
    return {
      activities: [],
      count: 0
    };
  }

  const activities = await Activity.find({
    patientId: { $in: patientIds }
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("-__v")
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
    action: "hospital_latest_activities_viewed",
    entityType: "Activity",
    metadata: {
      userRole: user.role,
      userId: user._id,
      limit,
      count: activities.length
    }
  });

  return {
    activities,
    count: activities.length
  };
};

// export const getLatestActivities = async (patientId, limit = 4) => {
//   const query = { patientId };

//   const activities = await Activity.find(query)
//     .sort({ createdAt: -1 })
//     .limit(limit)
//     .select("-__v")
//     .lean();

//   await SystemLog.create({
//     action: "latest_activities_viewed",
//     entityType: "Activity",
//     metadata: { patientId, limit, count: activities.length }
//   });

//   return {
//     activities,
//     count: activities.length
//   };
// };