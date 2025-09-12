import Hospital from "../models/hospitalModel.js";
import { StatusCodes } from "http-status-codes";
import SystemLog from "../models/systemLogModel.js";


export const createHospital = async (hospitalData, createdBy, session) => {
  const existingHospital = await Hospital.findOne({
    hospitalLicenseNumber: hospitalData.hospitalLicenseNumber
  }).session(session);

  if (existingHospital) {
    throw {
      statusCode: StatusCodes.CONFLICT,
      message: "Hospital with this license number already exists"
    };
  }

  const hospital = await Hospital.create(
    [
      {
        ...hospitalData,
        createdBy
      }
    ],
    { session }
  );

  return hospital[0].toObject();
};

export const getHospitals = async (query = {}, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const matchStage = {};

    // Filter by isActive inside hospitalUserId
    if (query.isActive !== undefined) {
      matchStage["hospitalUser.isActive"] = query.isActive === "true";
    }

    // Search filter inside hospitalUserId
    if (query.search) {
      const regex = new RegExp(query.search, "i");
      matchStage.$or = [
        { "hospitalUser.firstName": regex },
        { "hospitalUser.lastName": regex },
        { "hospitalUser.email": regex },
        { "hospitalUser.phone": regex },
        { "hospitalUser.fullName": regex }
      ];
    }

    const aggregationPipeline = [
      {
        $lookup: {
          from: "users",
          localField: "hospitalUserId",
          foreignField: "_id",
          as: "hospitalUser"
        }
      },
      { $unwind: "$hospitalUser" },
      { $match: matchStage },

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                __v: 0,
                "hospitalUser.passwordHash": 0,
                "hospitalUser.__v": 0,
                "hospitalUser.accessToken": 0,
                "hospitalUser.refreshToken": 0
              }
            }
          ],
          totalCount: [{ $count: "count" }]
        }
      }
    ];

    const result = await Hospital.aggregate(aggregationPipeline);

    const hospitals = result[0].data;
    const total = result[0].totalCount[0]?.count || 0;

    await SystemLog.create({
      action: "hospitals_viewed",
      entityType: "Hospital",
      metadata: {
        page,
        limit,
        filters: query,
        count: hospitals.length
      }
    });

    return {
      hospitals,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch hospitals",
      statusCode: StatusCodes.INTERNAL_SERVER_ERROR
    };
  }
};

// export const getHospitals = async (filters = {}, page = 1, limit = 10) => {
//   try {
//     const skip = (page - 1) * limit;
//     const hospitals = await Hospital.find(filters)
//       .skip(skip)
//       .limit(limit)
//       .select("-__v")
//       .populate({
//         path: "hospitalUserId",
//         select: "-password -__v"
//       })
//       .lean();

//     const total = await Hospital.countDocuments(filters);

//     // HIPAA audit log
//     await SystemLog.create({
//       action: "hospitals_viewed",
//       entityType: "Hospital",
//       metadata: {
//         page,
//         limit,
//         filters,
//         count: hospitals.length
//       }
//     });

//     return {
//       hospitals,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit)
//       }
//     };
//   } catch (error) {
//     throw {
//       message: error.message || "Failed to fetch hospitals",
//       statusCode: StatusCodes.INTERNAL_SERVER_ERROR
//     };
//   }
// };

export const getHospitalById = async (hospitalId) => {
  try {
    const hospital = await Hospital.findById(hospitalId)
      .select("-__v")
      .populate({
        path: "hospitalUserId",
        select: "-password -__v"
      })
      .lean();

    if (!hospital) {
      throw {
        message: "Hospital not found",
        statusCode: StatusCodes.NOT_FOUND
      };
    }

    // HIPAA audit log
    await SystemLog.create({
      action: "hospital_viewed",
      entityType: "Hospital",
      entityId: hospitalId
    });

    return {hospital};
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch hospital",
      statusCode: error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR
    };
  }
};

export const updateHospital = async (hospitalId, updates = {}, session) => {
  // allow only role-specific fields here
  const allowed = [
    "hospitalName",
    "hospitalLicenseNumber",
    "website",
  ];
  const payload = {};
  for (const k of allowed)
    if (updates[k] !== undefined) payload[k] = updates[k];

  if (payload.hospitalLicenseNumber) {
    const exists = await Hospital.findOne({
      hospitalLicenseNumber: payload.hospitalLicenseNumber,
      _id: { $ne: hospitalId }
    }).session(session);
    if (exists) {
      throw {
        statusCode: StatusCodes.CONFLICT,
        message: "Hospital with this license number already exists"
      };
    }
  }

  const hospital = await Hospital.findByIdAndUpdate(
    hospitalId,
    { $set: payload },
    { new: true, session }
  )
    .select("-__v")
    .lean();

  if (!hospital) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Hospital not found" };
  }

  await SystemLog.create(
    [
      {
        action: "hospital_updated",
        entityType: "Hospital",
        entityId: hospitalId,
        metadata: { fields: Object.keys(payload) }
      }
    ],
    { session }
  );

  return hospital;
};
