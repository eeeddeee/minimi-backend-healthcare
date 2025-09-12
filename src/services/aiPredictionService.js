import { StatusCodes } from "http-status-codes";
import AIPrediction from "../models/aiPredictionModel.js";
import SystemLog from "../models/systemLogModel.js";

export const createPrediction = async (data, createdBy) => {
  const doc = await AIPrediction.create([{ ...data }]);
  const saved = doc[0].toObject();

  await SystemLog.create({
    action: "ai_prediction_created",
    entityType: "AIPrediction",
    entityId: saved._id,
    performedBy: createdBy,
    metadata: { patientId: saved.patientId, mood: saved.predictedMood }
  });

  return saved;
};

export const getPredictions = async (filters = {}, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;
  const q = { patientId: filters.patientId };
  if (filters.from || filters.to) {
    q.predictionDate = {};
    if (filters.from) q.predictionDate.$gte = new Date(filters.from);
    if (filters.to) q.predictionDate.$lte = new Date(filters.to);
  }
  if (filters.risk) q["riskFactors.type"] = filters.risk;

  const [items, total] = await Promise.all([
    AIPrediction.find(q)
      .sort({ predictionDate: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .lean(),
    AIPrediction.countDocuments(q)
  ]);

  await SystemLog.create({
    action: "ai_predictions_viewed",
    entityType: "AIPrediction",
    metadata: { filters, page, limit, count: items.length }
  });

  return {
    predictions: items,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
};

export const getPredictionById = async (id) => {
  const p = await AIPrediction.findById(id).select("-__v").lean();
  if (!p)
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Prediction not found"
    };
  await SystemLog.create({
    action: "ai_prediction_viewed",
    entityType: "AIPrediction",
    entityId: id
  });
  return { prediction: p };
};

export const updatePrediction = async (id, updates = {}, performedBy) => {
  const updated = await AIPrediction.findByIdAndUpdate(
    id,
    { $set: updates },
    { new: true }
  )
    .select("-__v")
    .lean();
  if (!updated)
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Prediction not found"
    };

  await SystemLog.create({
    action: "ai_prediction_updated",
    entityType: "AIPrediction",
    entityId: id,
    performedBy: performedBy,
    metadata: { fields: Object.keys(updates) }
  });

  return updated;
};

export const markNotified = async (id, performedBy) => {
  return updatePrediction(id, { isNotified: true }, performedBy);
};

export const getLatestForPatient = async (patientId) => {
  const latest = await AIPrediction.findOne({ patientId })
    .sort({ predictionDate: -1 })
    .select("-__v")
    .lean();
  return latest ? { prediction: latest } : { prediction: null };
};
