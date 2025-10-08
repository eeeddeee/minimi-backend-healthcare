// services/eLearningService.js
import { StatusCodes } from "http-status-codes";
import ELearningResource from "../models/eLearningResourceModel.js";
import TrainingFeedback from "../models/trainingFeedbackModel.js";
import SystemLog from "../models/systemLogModel.js";
import mongoose from "mongoose";
import {
  notifyHospitalStaff,
  notifyHospitalOnFeedback,
} from "../utils/notify.js";

// Create resource
export const createResource = async (data, createdBy) => {
  const doc = await ELearningResource.create([{ ...data, createdBy }]);
  const saved = doc[0].toObject();

  await SystemLog.create({
    action: "elearning_resource_created",
    entityType: "ELearningResource",
    entityId: saved._id,
    performedBy: createdBy,
    metadata: { title: saved.title },
  });

  try {
    const title = `New training: ${saved.title || "E-Learning Resource"}`;
    const message = saved.description
      ? saved.description.slice(0, 140)
      : "A new training resource has been published.";

    const dataPayload = {
      kind: "elearning_created",
      resourceId: saved._id,
      title: saved.title,
      // if you have route like /e-learning/:id
      deeplink: `/e-learning/${saved._id}`,
      hospitalUserId: createdBy,
      tags: saved.tags || [],
      category: saved.category || null,
    };

    await notifyHospitalStaff({
      hospitalUserId: createdBy,
      excludeUserId: createdBy,
      roles: ["nurse", "caregiver"],
      type: "system",
      priority: "normal",
      title,
      message,
      data: dataPayload,
      emitEvent: "notification:new",
      emitCount: true,
    });
  } catch (e) {
    console.error("eLearning notifyHospitalStaff failed:", e);
  }

  return saved;
};

// List resources (filters + pagination + text search on title/description)
export const getResources = async (filters = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const q = {};
  if (filters.isActive !== undefined) q.isActive = filters.isActive;
  if (filters.language) q.language = filters.language;
  if (filters.category) q.categories = filters.category;
  if (filters.difficulty) q.difficulty = filters.difficulty;
  if (filters.search) {
    q.$or = [
      { title: new RegExp(filters.search, "i") },
      { description: new RegExp(filters.search, "i") },
    ];
  }

  const [items, total] = await Promise.all([
    ELearningResource.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .lean(),
    ELearningResource.countDocuments(q),
  ]);

  await SystemLog.create({
    action: "elearning_resources_viewed",
    entityType: "ELearningResource",
    metadata: { filters, page, limit, count: items.length },
  });

  return {
    resources: items,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
};

// Get by id (with simple rating meta)
export const getResourceById = async (id) => {
  const res = await ELearningResource.findById(id).select("-__v").lean();
  if (!res)
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Resource not found" };

  // Aggregate average rating
  const agg = await TrainingFeedback.aggregate([
    { $match: { resourceId: new mongoose.Types.ObjectId(id) } },
    {
      $group: {
        _id: "$resourceId",
        avg: { $avg: "$rating" },
        total: { $sum: 1 },
      },
    },
  ]);
  const rating = agg[0]
    ? { average: Math.round(agg[0].avg * 10) / 10, count: agg[0].total }
    : { average: 0, count: 0 };

  await SystemLog.create({
    action: "elearning_resource_viewed",
    entityType: "ELearningResource",
    entityId: id,
  });

  return { resource: res, rating };
};

// Update resource
export const updateResource = async (id, updates = {}, updatedBy) => {
  const updated = await ELearningResource.findByIdAndUpdate(
    id,
    { $set: updates, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated)
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Resource not found" };

  await SystemLog.create({
    action: "elearning_resource_updated",
    entityType: "ELearningResource",
    entityId: id,
    performedBy: updatedBy,
    metadata: { fields: Object.keys(updates) },
  });

  return updated;
};

// Activate/Deactivate
export const setActive = async (id, isActive, updatedBy) => {
  const updated = await ELearningResource.findByIdAndUpdate(
    id,
    { $set: { isActive }, $currentDate: { updatedAt: true } },
    { new: true }
  )
    .select("-__v")
    .lean();

  if (!updated)
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Resource not found" };

  await SystemLog.create({
    action: isActive
      ? "elearning_resource_activated"
      : "elearning_resource_deactivated",
    entityType: "ELearningResource",
    entityId: id,
    performedBy: updatedBy,
  });

  return updated;
};

// Mark view / initial progress create-or-update
export const markViewOrProgress = async (
  id,
  userId,
  completionPercentage = 0
) => {
  const updated = await ELearningResource.findOneAndUpdate(
    { _id: id, "viewedBy.userId": { $ne: userId } },
    {
      $push: { viewedBy: { userId, completionPercentage, date: new Date() } },
      $currentDate: { updatedAt: true },
    },
    { new: true }
  );

  // if already exists, just update percentage + date
  const res =
    updated ||
    (await ELearningResource.findOneAndUpdate(
      { _id: id, "viewedBy.userId": userId },
      {
        $set: {
          "viewedBy.$.completionPercentage": completionPercentage,
          "viewedBy.$.date": new Date(),
        },
        $currentDate: { updatedAt: true },
      },
      { new: true }
    ));

  await SystemLog.create({
    action: "elearning_progress_updated",
    entityType: "ELearningResource",
    entityId: id,
    performedBy: userId,
    metadata: { completionPercentage },
  });

  return res?.toObject?.() || res;
};

// Submit feedback (upsert per user)
export const submitFeedback = async (resourceId, userId, rating, comment) => {
  const doc = await TrainingFeedback.findOneAndUpdate(
    { resourceId, userId },
    { $set: { rating, comment, createdAt: new Date() } },
    { new: true, upsert: true }
  ).lean();

  await SystemLog.create({
    action: "elearning_feedback_submitted",
    entityType: "TrainingFeedback",
    entityId: doc._id,
    performedBy: userId,
    metadata: { resourceId, rating },
  });

  await notifyHospitalOnFeedback({
    resourceId,
    submittedByUserId: userId,
    rating,
    comment,
  });

  return doc;
};

export const getFeedbackForResource = async ({
  resourceId,
  page = 1,
  limit = 10,
  user,
}) => {
  // sanity + resource exists
  if (!mongoose.isValidObjectId(resourceId)) {
    throw {
      statusCode: StatusCodes.BAD_REQUEST,
      message: "Invalid resource id",
    };
  }
  const resource = await ELearningResource.findById(resourceId).lean();
  if (!resource) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Resource not found" };
  }

  const skip = (page - 1) * limit;

  // parallel ops
  const [items, total, statsAgg, myFeedback] = await Promise.all([
    TrainingFeedback.find({ resourceId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate({
        path: "userId",
        select: "firstName lastName role email profile_image",
      })
      .select("-__v")
      .lean(),

    TrainingFeedback.countDocuments({ resourceId }),

    TrainingFeedback.aggregate([
      { $match: { resourceId: new mongoose.Types.ObjectId(resourceId) } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          avgRating: { $avg: "$rating" },
          r1: { $sum: { $cond: [{ $eq: ["$rating", 1] }, 1, 0] } },
          r2: { $sum: { $cond: [{ $eq: ["$rating", 2] }, 1, 0] } },
          r3: { $sum: { $cond: [{ $eq: ["$rating", 3] }, 1, 0] } },
          r4: { $sum: { $cond: [{ $eq: ["$rating", 4] }, 1, 0] } },
          r5: { $sum: { $cond: [{ $eq: ["$rating", 5] }, 1, 0] } },
        },
      },
    ]),

    user?._id
      ? TrainingFeedback.findOne({ resourceId, userId: user._id })
          .select("-__v")
          .lean()
      : null,
  ]);

  const statsRow = statsAgg?.[0] || {
    count: 0,
    avgRating: null,
    r1: 0,
    r2: 0,
    r3: 0,
    r4: 0,
    r5: 0,
  };

  await SystemLog.create({
    action: "elearning_feedback_viewed",
    entityType: "ELearningResource",
    entityId: resourceId,
    performedBy: user?._id,
    metadata: { page, limit },
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / (limit || 1)),
    },
    stats: {
      total: statsRow.count,
      avgRating: statsRow.avgRating
        ? Number(statsRow.avgRating.toFixed(2))
        : null,
      breakdown: {
        1: statsRow.r1,
        2: statsRow.r2,
        3: statsRow.r3,
        4: statsRow.r4,
        5: statsRow.r5,
      },
    },
    myFeedback: myFeedback || null,
  };
};
