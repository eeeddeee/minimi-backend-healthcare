import Nurse from "../models/nurseModel.js";
import SystemLog from "../models/systemLogModel.js";
import mongoose from "mongoose";


export const createNurse = async (nurseData, createdBy, session) => {
  const nurse = await Nurse.create([{ ...nurseData, createdBy }], { session });
  return nurse[0].toObject();
};


export const getNurses = async (
  query = {},
  page = 1,
  limit = 10,
  hospitalId
) => {
  try {
    const skip = (page - 1) * limit;
    const matchStage = {};
    if (hospitalId) {
      matchStage["nurseUser.createdBy"] = hospitalId;
    }

    // Filter by isActive inside nurseUser
    if (query.isActive !== undefined) {
      matchStage["nurseUser.isActive"] = query.isActive === "true";
    }

    // Search filter inside nurseUser
    if (query.search) {
      const regex = new RegExp(query.search, "i");
      matchStage.$or = [
        { "nurseUser.firstName": regex },
        { "nurseUser.lastName": regex },
        { "nurseUser.email": regex },
        { "nurseUser.phone": regex }
      ];
    }

    const aggregationPipeline = [
      {
        $lookup: {
          from: "users",
          localField: "nurseUserId",
          foreignField: "_id",
          as: "nurseUser"
        }
      },
      { $unwind: "$nurseUser" },
      { $match: matchStage },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                __v: 0,
                "nurseUser.passwordHash": 0,
                "nurseUser.__v": 0,
                "nurseUser.accessToken": 0,
                "nurseUser.refreshToken": 0
              }
            }
          ],
          totalCount: [{ $count: "count" }]
        }
      }
    ];

    const result = await Nurse.aggregate(aggregationPipeline);
    const nurses = result[0].data;
    const total = result[0].totalCount[0]?.count || 0;

    await SystemLog.create({
      action: "nurses_viewed",
      entityType: "Nurse",
      metadata: {
        page,
        limit,
        filters: query,
        count: nurses.length
      }
    });

    return {
      nurses,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch nurses",
      statusCode: 500
    };
  }
};



export const getNurseById = async (nurseId) => {
  try {
    const nurse = await Nurse.findById(nurseId)
      .select("-__v")
      .populate({
        path: "nurseUserId",
        select: "-password -__v"
      })
      .lean();

    if (!nurse) {
      throw {
        message: "Nurse not found",
        statusCode: 404
      };
    }

    await SystemLog.create({
      action: "nurse_viewed",
      entityType: "Nurse",
      entityId: nurseId
    });

    return { nurse };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch nurse",
      statusCode: error.statusCode || 500
    };
  }
};

export const updateNurse = async (nurseId, updates = {}, session) => {
  const allowed = [
    "department",
    "nurseShifts",
    "NurselicenseNumber",
    "specialization",
    "yearsOfExperience"
  ];
  const payload = {};
  for (const k of allowed)
    if (updates[k] !== undefined) payload[k] = updates[k];

  const nurse = await Nurse.findByIdAndUpdate(
    nurseId,
    { $set: payload },
    { new: true, session }
  )
    .select("-__v")
    .lean();

  if (!nurse)
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Nurse not found" };

  await SystemLog.create(
    [
      {
        action: "nurse_updated",
        entityType: "Nurse",
        entityId: nurseId,
        metadata: { fields: Object.keys(payload) }
      }
    ],
    { session }
  );

  return nurse;
};
