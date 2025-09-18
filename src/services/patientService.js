import Patient from "../models/patientModel.js";
import { StatusCodes } from "http-status-codes";
import SystemLog from "../models/systemLogModel.js";
import mongoose from "mongoose";

export const createPatient = async (patientData, createdBy, session) => {
  const patient = await Patient.create([{ ...patientData, createdBy }], {
    session,
  });
  console.log("CREATE PATIENT DATA: ", patientData);
  return patient[0].toObject();
};

export const addFamilyMember = async (
  patientId,
  familyMemberId,
  createdBy,
  session
) => {
  const patient = await Patient.findByIdAndUpdate(
    patientId,
    { $addToSet: { familyMembers: familyMemberId } },
    { new: true, session }
  ).lean();

  if (!patient) {
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Patient not found",
    };
  }

  return patient;
};

export const getAndVerifyPatientByHospital = async (
  patientId,
  hospitalId,
  session
) => {
  const patient = await Patient.findById(patientId).session(session);
  console.log("Patient Object:", patient);
  console.log(
    "Patient HospitalId:",
    patient?.hospitalId,
    "Type:",
    typeof patient?.hospitalId
  );
  console.log("User HospitalId:", hospitalId, "Type:", typeof hospitalId);

  if (!patient || String(patient.hospitalId) !== String(hospitalId)) {
    console.log(
      "Failed Comparison:",
      "String(patient.hospitalId):",
      String(patient.hospitalId),
      "String(hospitalId):",
      String(hospitalId)
    );
    throw {
      statusCode: StatusCodes.FORBIDDEN,
      message: "Patient not found or not in your hospital",
    };
  }
  return patient;
};

export const getPatients = async (query = {}, page, limit, hospitalId) => {
  try {
    const skip = (page - 1) * limit;

    const preMatchStage = {};
    if (hospitalId) {
      const hospObjId = mongoose.Types.ObjectId.isValid(hospitalId)
        ? new mongoose.Types.ObjectId(hospitalId)
        : hospitalId;
      preMatchStage.hospitalId = hospObjId;
    }

    const matchStage = {};

    if (query.isActive !== undefined) {
      matchStage["patientUser.isActive"] = query.isActive === "true";
    }

    if (query.search) {
      const searchTerm = decodeURIComponent(query.search)
        .replace(/\t/g, " ")
        .trim()
        .replace(/\s+/g, " ");

      const exactRegex = new RegExp(`^${searchTerm}$`, "i");

      const partialRegex = new RegExp(searchTerm, "i");

      matchStage.$or = [
        {
          $expr: {
            $regexMatch: {
              input: {
                $concat: [
                  "$patientUser.firstName",
                  " ",
                  "$patientUser.lastName",
                ],
              },
              regex: exactRegex,
            },
          },
        },
        { "patientUser.firstName": exactRegex },
        { "patientUser.lastName": exactRegex },
        { "patientUser.fullName": exactRegex },
        { "patientUser.email": exactRegex },
        { "patientUser.phone": exactRegex },
        { "patientUser.firstName": partialRegex },
        { "patientUser.lastName": partialRegex },
        { "patientUser.fullName": partialRegex },
      ];
    }

    // if (query.search) {
    //   const regex = new RegExp(query.search, "i");
    //   matchStage.$or = [
    //     { "patientUser.firstName": regex },
    //     { "patientUser.lastName": regex },
    //     { "patientUser.email": regex },
    //     { "patientUser.phone": regex }
    //   ];
    // }

    const aggregationPipeline = [
      ...(hospitalId ? [{ $match: preMatchStage }] : []),

      {
        $lookup: {
          from: "users",
          localField: "patientUserId",
          foreignField: "_id",
          as: "patientUser",
        },
      },
      { $unwind: "$patientUser" },

      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),

      {
        $facet: {
          data: [
            ...(page && limit
              ? [{ $skip: (page - 1) * limit }, { $limit: limit }]
              : []),
            {
              $project: {
                __v: 0,
                "patientUser.passwordHash": 0,
                "patientUser.__v": 0,
                "patientUser.accessToken": 0,
                "patientUser.refreshToken": 0,
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await Patient.aggregate(aggregationPipeline);
    const patients = result[0]?.data || [];
    const total = result[0]?.totalCount?.[0]?.count || 0;

    await SystemLog.create({
      action: "patients_viewed",
      entityType: "Patient",
      metadata: {
        page,
        limit,
        filters: query,
        hospitalId: hospitalId || null,
        count: patients.length,
      },
    });

    return {
      patients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch patients",
      statusCode: 500,
    };
  }
};

export const getPatientsForNurse = async (
  query = {},
  page,
  limit,
  nurseIdsToMatch = []
) => {
  try {
    const skip = (page - 1) * limit;

    const ids = (
      Array.isArray(nurseIdsToMatch) ? nurseIdsToMatch : [nurseIdsToMatch]
    )
      .filter(Boolean)
      .map((id) =>
        mongoose.Types.ObjectId.isValid(id)
          ? new mongoose.Types.ObjectId(id)
          : id
      );

    if (!ids.length) {
      throw { statusCode: 400, message: "Nurse id is required" };
    }

    const preMatchStage = { nurseIds: { $in: ids } };

    const matchStage = {};
    if (query.isActive !== undefined) {
      matchStage["patientUser.isActive"] = query.isActive === "true";
    }

    if (query.search) {
      const searchTerm = decodeURIComponent(query.search)
        .replace(/\t/g, " ")
        .trim()
        .replace(/\s+/g, " ");

      const exactRegex = new RegExp(`^${searchTerm}$`, "i");

      const partialRegex = new RegExp(searchTerm, "i");

      matchStage.$or = [
        {
          $expr: {
            $regexMatch: {
              input: {
                $concat: [
                  "$patientUser.firstName",
                  " ",
                  "$patientUser.lastName",
                ],
              },
              regex: exactRegex,
            },
          },
        },
        { "patientUser.firstName": exactRegex },
        { "patientUser.lastName": exactRegex },
        { "patientUser.fullName": exactRegex },
        { "patientUser.email": exactRegex },
        { "patientUser.phone": exactRegex },
        { "patientUser.firstName": partialRegex },
        { "patientUser.lastName": partialRegex },
        { "patientUser.fullName": partialRegex },
      ];
    }

    // if (query.search) {
    //   const regex = new RegExp(query.search, "i");
    //   matchStage.$or = [
    //     { "patientUser.firstName": regex },
    //     { "patientUser.lastName": regex },
    //     { "patientUser.email": regex },
    //     { "patientUser.phone": regex },
    //   ];
    // }

    const pipeline = [
      { $match: preMatchStage },
      {
        $lookup: {
          from: "users",
          localField: "patientUserId",
          foreignField: "_id",
          as: "patientUser",
        },
      },
      { $unwind: "$patientUser" },
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      {
        $facet: {
          data: [
            ...(page && limit
              ? [{ $skip: (page - 1) * limit }, { $limit: limit }]
              : []),
            {
              $project: {
                __v: 0,
                "patientUser.passwordHash": 0,
                "patientUser.__v": 0,
                "patientUser.accessToken": 0,
                "patientUser.refreshToken": 0,
              },
            },
          ],
          totalCount: [{ $count: "count" }],
          stats: [
            {
              $group: {
                _id: null,
                totalPatients: { $sum: 1 },
                totalActivePatients: {
                  $sum: {
                    $cond: [{ $eq: ["$patientUser.isActive", true] }, 1, 0],
                  },
                },
                totalInactivePatients: {
                  $sum: {
                    $cond: [{ $eq: ["$patientUser.isActive", false] }, 1, 0],
                  },
                },
              },
            },
          ],
        },
      },
    ];

    const result = await Patient.aggregate(pipeline);

    const patients = result[0]?.data || [];
    const total = result[0]?.totalCount?.[0]?.count || 0;

    const stats = result[0]?.stats?.[0] || {
      totalPatients: 0,
      totalActivePatients: 0,
      totalInactivePatients: 0,
    };

    await SystemLog.create({
      action: "patients_viewed_by_nurse",
      entityType: "Patient",
      metadata: {
        page,
        limit,
        filters: query,
        nurseIds: ids,
        count: patients.length,
      },
    });

    return {
      patients,
      stats,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch nurse patients",
      statusCode: error.statusCode || 500,
    };
  }
};

// export const getPatientsForNurse = async (
//   query = {},
//   page = 1,
//   limit = 10,
//   nurseIdsToMatch = []
// ) => {
//   try {
//     const skip = (page - 1) * limit;

//     const ids = (
//       Array.isArray(nurseIdsToMatch) ? nurseIdsToMatch : [nurseIdsToMatch]
//     )
//       .filter(Boolean)
//       .map((id) =>
//         mongoose.Types.ObjectId.isValid(id)
//           ? new mongoose.Types.ObjectId(id)
//           : id
//       );

//     if (!ids.length) {
//       throw { statusCode: 400, message: "Nurse id is required" };
//     }

//     const preMatchStage = { nurseIds: { $in: ids } };

//     const matchStage = {};
//     if (query.isActive !== undefined) {
//       matchStage["patientUser.isActive"] = query.isActive === "true";
//     }
//     if (query.search) {
//       const regex = new RegExp(query.search, "i");
//       matchStage.$or = [
//         { "patientUser.firstName": regex },
//         { "patientUser.lastName": regex },
//         { "patientUser.email": regex },
//         { "patientUser.phone": regex }
//       ];
//     }

//     const pipeline = [
//       { $match: preMatchStage },
//       {
//         $lookup: {
//           from: "users",
//           localField: "patientUserId",
//           foreignField: "_id",
//           as: "patientUser"
//         }
//       },
//       { $unwind: "$patientUser" },
//       ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
//       {
//         $facet: {
//           data: [
//             { $skip: skip },
//             { $limit: limit },
//             {
//               $project: {
//                 __v: 0,
//                 "patientUser.passwordHash": 0,
//                 "patientUser.__v": 0,
//                 "patientUser.accessToken": 0,
//                 "patientUser.refreshToken": 0
//               }
//             }
//           ],
//           totalCount: [{ $count: "count" }]
//         }
//       }
//     ];

//     const result = await Patient.aggregate(pipeline);
//     const patients = result[0]?.data || [];
//     const total = result[0]?.totalCount?.[0]?.count || 0;

//     await SystemLog.create({
//       action: "patients_viewed_by_nurse",
//       entityType: "Patient",
//       metadata: {
//         page,
//         limit,
//         filters: query,
//         nurseIds: ids,
//         count: patients.length
//       }
//     });

//     return {
//       patients,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit)
//       }
//     };
//   } catch (error) {
//     throw {
//       message: error.message || "Failed to fetch nurse patients",
//       statusCode: error.statusCode || 500
//     };
//   }
// };

export const getPatientById = async (patientId) => {
  try {
    const patient = await Patient.findById(patientId)
      .select("-__v")
      .populate({
        path: "patientUserId",
        select: "-password -__v",
      })
      .lean();

    if (!patient) {
      throw {
        message: "Patient not found",
        statusCode: 404,
      };
    }

    await SystemLog.create({
      action: "patient_viewed",
      entityType: "Patient",
      entityId: patientId,
    });

    return { patient };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch patient",
      statusCode: error.statusCode || 500,
    };
  }
};

export const updatePatient = async (patientId, updates = {}, session) => {
  const allowed = [
    "bloodGroup",
    "medicalConditions",
    "allergies",
    "height",
    "weight",
    "emergencyContacts",
    "insurance",
    "status",
    "currentMedications",
  ];
  const payload = {};
  for (const k of allowed)
    if (updates[k] !== undefined) payload[k] = updates[k];

  const patient = await Patient.findByIdAndUpdate(
    patientId,
    { $set: payload },
    { new: true, session }
  )
    .select("-__v")
    .lean();

  if (!patient)
    throw { statusCode: StatusCodes.NOT_FOUND, message: "Patient not found" };

  await SystemLog.create(
    [
      {
        action: "patient_updated",
        entityType: "Patient",
        entityId: patientId,
        metadata: { fields: Object.keys(payload) },
      },
    ],
    { session }
  );

  return patient;
};
