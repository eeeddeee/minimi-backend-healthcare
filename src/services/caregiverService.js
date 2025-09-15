import Caregiver from "../models/caregiverModel.js";
import Patient from "../models/patientModel.js";
import SystemLog from "../models/systemLogModel.js";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";

export const createCaregiver = async (caregiverData, createdBy, session) => {
  const caregiver = await Caregiver.create([{ ...caregiverData, createdBy }], {
    session
  });
  return caregiver[0].toObject();
};

export const getCaregivers = async (query = {}, page = 1, limit = 10, hospitalId) => {
  try {
    const skip = (page - 1) * limit;

    const preMatchStage = {};
    if (hospitalId) {
      const hospObjId = mongoose.Types.ObjectId.isValid(hospitalId)
        ? new mongoose.Types.ObjectId(hospitalId)
        : hospitalId;
      preMatchStage.hospitalId = hospObjId;

      // preMatchStage.createdBy = hospObjId;
    }

    const matchStage = {};
    if (query.isActive !== undefined) {
      matchStage["caregiverUser.isActive"] = query.isActive === "true";
    }
    if (query.search) {
      const regex = new RegExp(query.search, "i");
      matchStage.$or = [
        { "caregiverUser.firstName": regex },
        { "caregiverUser.lastName": regex },
        { "caregiverUser.email": regex },
        { "caregiverUser.phone": regex }
      ];
    }

    const aggregationPipeline = [
      ...(hospitalId ? [{ $match: preMatchStage }] : []),

      {
        $lookup: {
          from: "users",
          localField: "caregiverUserId",
          foreignField: "_id",
          as: "caregiverUser"
        }
      },
      { $unwind: "$caregiverUser" },

      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                __v: 0,
                "caregiverUser.passwordHash": 0,
                "caregiverUser.__v": 0,
                "caregiverUser.accessToken": 0,
                "caregiverUser.refreshToken": 0
              }
            }
          ],
          totalCount: [{ $count: "count" }]
        }
      }
    ];

    const result = await Caregiver.aggregate(aggregationPipeline);
    const caregivers = result[0]?.data || [];
    const total = result[0]?.totalCount?.[0]?.count || 0;

    await SystemLog.create({
      action: "caregivers_viewed",
      entityType: "Caregiver",
      metadata: {
        page,
        limit,
        filters: query,
        hospitalId: hospitalId || null,
        count: caregivers.length
      }
    });

    return {
      caregivers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch caregivers",
      statusCode: 500
    };
  }
};

export const getCaregiversForNurse = async (
  query = {},
  page = 1,
  limit = 10,
  nurseIdsToMatch = []
) => {
  try {
    const skip = (page - 1) * limit;

    const ids = (Array.isArray(nurseIdsToMatch) ? nurseIdsToMatch : [nurseIdsToMatch])
      .filter(Boolean)
      .map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id);

    if (!ids.length) {
      throw { statusCode: 400, message: "Nurse id is required" };
    }
    const preMatchStage = { nurseId: { $in: ids } };
    const matchStage = {};
    if (query.isActive !== undefined) {
      matchStage["caregiverUser.isActive"] = query.isActive === "true";
    }
    if (query.search) {
      const regex = new RegExp(query.search, "i");
      matchStage.$or = [
        { "caregiverUser.firstName": regex },
        { "caregiverUser.lastName": regex },
        { "caregiverUser.email": regex },
        { "caregiverUser.phone": regex }
      ];
    }

    const pipeline = [
      { $match: preMatchStage },
      {
        $lookup: {
          from: "users",
          localField: "caregiverUserId",
          foreignField: "_id",
          as: "caregiverUser"
        }
      },
      { $unwind: "$caregiverUser" },
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                __v: 0,
                "caregiverUser.passwordHash": 0,
                "caregiverUser.__v": 0,
                "caregiverUser.accessToken": 0,
                "caregiverUser.refreshToken": 0
              }
            }
          ],
          totalCount: [{ $count: "count" }]
        }
      }
    ];

    const result = await Caregiver.aggregate(pipeline);
    const caregivers = result[0]?.data || [];
    const total = result[0]?.totalCount?.[0]?.count || 0;

    await SystemLog.create({
      action: "caregivers_viewed_by_nurse",
      entityType: "Caregiver",
      metadata: {
        page,
        limit,
        filters: query,
        nurseIds: ids,
        count: caregivers.length
      }
    });
    return {
      caregivers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch nurse caregivers",
      statusCode: error.statusCode || 500
    };
  }
};


// GET Caregiver by ID
export const getCaregiverById = async (caregiverId) => {
  try {
    const caregiver = await Caregiver.findById(caregiverId)
      .select("-__v")
      .populate({
        path: "caregiverUserId", // <-- change this if your field is different
        select: "-password -__v"
      })
      .lean();

    if (!caregiver) {
      throw {
        message: "Caregiver not found",
        statusCode: 404
      };
    }

    await SystemLog.create({
      action: "caregiver_viewed",
      entityType: "Caregiver",
      entityId: caregiverId
    });

    return { caregiver };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch caregiver",
      statusCode: error.statusCode || 500
    };
  }
};

export const updateCaregiver = async (caregiverId, updates = {}, session) => {
  const allowed = [
    "yearsOfExperience",
    "availability",
    "caregiverShifts",
    "hourlyRate",
    "department",
    "languagesSpoken"
  ];
  const payload = {};
  for (const k of allowed)
    if (updates[k] !== undefined) payload[k] = updates[k];

  const caregiver = await Caregiver.findByIdAndUpdate(
    caregiverId,
    { $set: payload },
    { new: true, session }
  )
    .select("-__v")
    .lean();

  if (!caregiver)
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Caregiver not found" };

  await SystemLog.create(
    [
      {
        action: "caregiver_updated",
        entityType: "Caregiver",
        entityId: caregiverId,
        metadata: { fields: Object.keys(payload) }
      }
    ],
    { session }
  );

  return caregiver;
};

// // Create caregiver
// export const createCaregiver = async (caregiverData, createdBy) => {
//   const caregiver = await Caregiver.create({
//     ...caregiverData,
//     createdBy
//   });

//   return caregiver.toObject();
// };

// Add patient to caregiver's list
export const addPatientToCaregiver = async (
  caregiverId,
  patientId,
  updatedBy
) => {
  const caregiver = await Caregiver.findById(caregiverId);
  if (!caregiver) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Caregiver not found"
    };
  }

  // Add patient to caregiver’s list if not already there
  const patient = await Patient.findById(patientId);
  if (!patient) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Patient not found"
    };
  }

  // You might want to update `caregiver.patients = []` here,
  // if you've defined such a field in the model

  caregiver.updatedAt = Date.now();
  await caregiver.save();
};

// export const updateCaregiver = async (
//   caregiverId,
//   caregiverData,
//   userData,
//   files
// ) => {
//   // Update user profile first
//   const updatedUser = await updateUserProfile(
//     caregiverData.caregiverUserId,
//     userData,
//     files
//   );

//   // Then update caregiver details
//   const updatedCaregiver = await Caregiver.findByIdAndUpdate(
//     caregiverId,
//     { ...caregiverData, updatedAt: Date.now() },
//     { new: true }
//   );

//   return { updatedUser, updatedCaregiver };
// };