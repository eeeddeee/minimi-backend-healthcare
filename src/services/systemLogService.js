import SystemLog from "../models/systemLogModel.js";

export const getLogs = async (filters = {}, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  const q = {};
  if (filters.action) q.action = new RegExp(filters.action, "i");
  if (filters.entityType) q.entityType = new RegExp(filters.entityType, "i");
  if (filters.performedBy) q.performedBy = filters.performedBy;
  if (filters.from || filters.to) {
    q.createdAt = {};
    if (filters.from) q.createdAt.$gte = new Date(filters.from);
    if (filters.to) q.createdAt.$lte = new Date(filters.to);
  }
  if (filters.search) {
    // simple OR search across fields
    const s = new RegExp(filters.search, "i");
    q.$or = [{ action: s }, { entityType: s }, { "metadata.message": s }];
  }

  const [logs, total] = await Promise.all([
    SystemLog.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .populate({
        path: "performedBy",
        select: "firstName lastName role email"
      })
      .lean(),
    SystemLog.countDocuments(q)
  ]);

  return {
    logs,
    pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }
  };
};

export const getLogById = async (id) => {
  const log = await SystemLog.findById(id)
    .select("-__v")
    .populate({ path: "performedBy", select: "firstName lastName role email" })
    .lean();
  if (!log) throw { statusCode: 404, message: "Log not found" };
  return { log };
};
