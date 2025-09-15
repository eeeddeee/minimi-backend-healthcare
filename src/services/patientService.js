import Patient from "../models/patientModel.js";
import { StatusCodes } from "http-status-codes";
import SystemLog from "../models/systemLogModel.js";
import mongoose from "mongoose";

export const createPatient = async (patientData, createdBy, session) => {
  const patient = await Patient.create([{ ...patientData, createdBy }], {
    session
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
      message: "Patient not found"
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
      message: "Patient not found or not in your hospital"
    };
  }
  return patient;
};

export const getPatients = async (
  query = {},
  page = 1,
  limit = 10,
  hospitalId
) => {
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
      const regex = new RegExp(query.search, "i");
      matchStage.$or = [
        { "patientUser.firstName": regex },
        { "patientUser.lastName": regex },
        { "patientUser.email": regex },
        { "patientUser.phone": regex }
      ];
    }

    const aggregationPipeline = [
      ...(hospitalId ? [{ $match: preMatchStage }] : []),

      {
        $lookup: {
          from: "users",
          localField: "patientUserId",
          foreignField: "_id",
          as: "patientUser"
        }
      },
      { $unwind: "$patientUser" },

      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),

      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                __v: 0,
                "patientUser.passwordHash": 0,
                "patientUser.__v": 0,
                "patientUser.accessToken": 0,
                "patientUser.refreshToken": 0
              }
            }
          ],
          totalCount: [{ $count: "count" }]
        }
      }
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
        count: patients.length
      }
    });

    return {
      patients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch patients",
      statusCode: 500
    };
  }
};

export const getPatientsForNurse = async (
  query = {},
  page = 1,
  limit = 10,
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
      const regex = new RegExp(query.search, "i");
      matchStage.$or = [
        { "patientUser.firstName": regex },
        { "patientUser.lastName": regex },
        { "patientUser.email": regex },
        { "patientUser.phone": regex }
      ];
    }

    const pipeline = [
      { $match: preMatchStage },
      {
        $lookup: {
          from: "users",
          localField: "patientUserId",
          foreignField: "_id",
          as: "patientUser"
        }
      },
      { $unwind: "$patientUser" },
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                __v: 0,
                "patientUser.passwordHash": 0,
                "patientUser.__v": 0,
                "patientUser.accessToken": 0,
                "patientUser.refreshToken": 0
              }
            }
          ],
          totalCount: [{ $count: "count" }]
        }
      }
    ];

    const result = await Patient.aggregate(pipeline);
    const patients = result[0]?.data || [];
    const total = result[0]?.totalCount?.[0]?.count || 0;

    await SystemLog.create({
      action: "patients_viewed_by_nurse",
      entityType: "Patient",
      metadata: {
        page,
        limit,
        filters: query,
        nurseIds: ids,
        count: patients.length
      }
    });

    return {
      patients,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch nurse patients",
      statusCode: error.statusCode || 500
    };
  }
};

// export const getPatientsForNurse = async (query = {}, page = 1, limit = 10, nurseId) => {
//   try {
//     const skip = (page - 1) * limit;

//     if (!nurseId) {
//       throw { statusCode: 400, message: "NurseId is required" };
//     }

//     const nurseObjId = mongoose.Types.ObjectId.isValid(nurseId)
//       ? new mongoose.Types.ObjectId(nurseId)
//       : nurseId;

//     const preMatchStage = { nurseIds: nurseObjId };

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

//     const aggregationPipeline = [
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

//     const result = await Patient.aggregate(aggregationPipeline);
//     const patients = result[0]?.data || [];
//     const total = result[0]?.totalCount?.[0]?.count || 0;

//     await SystemLog.create({
//       action: "patients_viewed_by_nurse",
//       entityType: "Patient",
//       metadata: {
//         page,
//         limit,
//         filters: query,
//         nurseId: nurseObjId,
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
        select: "-password -__v"
      })
      .lean();

    if (!patient) {
      throw {
        message: "Patient not found",
        statusCode: 404
      };
    }

    await SystemLog.create({
      action: "patient_viewed",
      entityType: "Patient",
      entityId: patientId
    });

    return { patient };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch patient",
      statusCode: error.statusCode || 500
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
    "insurance"
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
        metadata: { fields: Object.keys(payload) }
      }
    ],
    { session }
  );

  return patient;
};

// export const addFamilyMember = async (
//   patientId,
//   familyMemberUserId,
//   updatedBy
// ) => {
//   const patient = await Patient.findById(patientId);
//   if (!patient) {
//     throw {
//       statusCode: StatusCodes.NOT_FOUND,
//       message: "Patient not found"
//     };
//   }

//   if (!patient.familyMemberIds.includes(familyMemberUserId)) {
//     patient.familyMemberIds.push(familyMemberUserId);
//     patient.updatedAt = Date.now();
//     await patient.save();
//   }
// };

// // import Patient from "../models/patientModel.js";
// // import User from "../models/userModel.js";
// // import { StatusCodes } from "http-status-codes";
// // import mongoose from "mongoose";

// // // Create a new patient
// // export const createPatient = async (patientData) => {
// //   try {
// //     const { hospitalId, createdBy, ...patientInfo } = patientData;

// //     const patient = await Patient.create({
// //       ...patientInfo,
// //       hospitalId,
// //       createdBy,
// //       isActive: true
// //     });

// //     return patient;
// //   } catch (error) {
// //     throw {
// //       statusCode: StatusCodes.INTERNAL_SERVER_ERROR,
// //       message: "Failed to create patient",
// //       details: error.message
// //     };
// //   }
// // };

// // // Get all patients with pagination
// // export const getAllPatients = async (
// //   hospitalId,
// //   { page = 1, limit = 10, search = "" }
// // ) => {
// //   const skip = (page - 1) * limit;

// //   const query = { hospitalId };
// //   if (search) {
// //     query.$or = [
// //       { firstName: { $regex: search, $options: "i" } },
// //       { lastName: { $regex: search, $options: "i" } },
// //       { "emergencyContacts.name": { $regex: search, $options: "i" } }
// //     ];
// //   }

// //   const [patients, total] = await Promise.all([
// //     Patient.find(query)
// //       .populate("primaryCaregiverId", "firstName lastName email phone")
// //       .populate("nurseIds", "firstName lastName")
// //       .skip(skip)
// //       .limit(limit)
// //       .sort({ createdAt: -1 }),
// //     Patient.countDocuments(query)
// //   ]);

// //   return {
// //     data: patients,
// //     pagination: {
// //       total,
// //       page,
// //       limit,
// //       totalPages: Math.ceil(total / limit)
// //     }
// //   };
// // };

// // // Get patient by ID
// // export const getPatientById = async (patientId) => {
// //   const patient = await Patient.findById(patientId)
// //     .populate("primaryCaregiverId", "firstName lastName email phone")
// //     .populate("secondaryCaregiverIds", "firstName lastName email phone")
// //     .populate("familyMemberIds", "firstName lastName email phone")
// //     .populate("nurseIds", "firstName lastName email phone");

// //   if (!patient) {
// //     throw {
// //       statusCode: StatusCodes.NOT_FOUND,
// //       message: "Patient not found"
// //     };
// //   }

// //   return patient;
// // };

// // // Update patient
// // export const updatePatient = async (patientId, updateData) => {
// //   const allowedUpdates = [
// //     "firstName",
// //     "lastName",
// //     "dob",
// //     "gender",
// //     "bloodGroup",
// //     "medicalConditions",
// //     "allergies",
// //     "currentMedications",
// //     "emergencyContacts",
// //     "profilePhoto",
// //     "isActive"
// //   ];

// //   const updates = {};
// //   Object.keys(updateData).forEach((key) => {
// //     if (allowedUpdates.includes(key)) {
// //       updates[key] = updateData[key];
// //     }
// //   });

// //   const patient = await Patient.findByIdAndUpdate(
// //     patientId,
// //     { $set: updates },
// //     { new: true, runValidators: true }
// //   ).populate("primaryCaregiverId", "firstName lastName email phone");

// //   if (!patient) {
// //     throw {
// //       statusCode: StatusCodes.NOT_FOUND,
// //       message: "Patient not found"
// //     };
// //   }

// //   return patient;
// // };

// // // Deactivate patient
// // export const deactivatePatient = async (patientId) => {
// //   const patient = await Patient.findByIdAndUpdate(
// //     patientId,
// //     { isActive: false },
// //     { new: true }
// //   );

// //   if (!patient) {
// //     throw {
// //       statusCode: StatusCodes.NOT_FOUND,
// //       message: "Patient not found"
// //     };
// //   }

// //   return patient;
// // };

// // // Add family member to patient
// // export const addFamilyMemberToPatient = async (patientId, familyMemberId) => {
// //   const [patient, familyMember] = await Promise.all([
// //     Patient.findById(patientId),
// //     User.findById(familyMemberId)
// //   ]);

// //   if (!patient || !familyMember) {
// //     throw {
// //       statusCode: StatusCodes.NOT_FOUND,
// //       message: "Patient or family member not found"
// //     };
// //   }

// //   if (familyMember.role !== "family") {
// //     throw {
// //       statusCode: StatusCodes.BAD_REQUEST,
// //       message: "Only family members can be added to patients"
// //     };
// //   }

// //   // Add family member to patient if not already there
// //   if (!patient.familyMemberIds.includes(familyMemberId)) {
// //     patient.familyMemberIds.push(familyMemberId);
// //     await patient.save();
// //   }

// //   // Add patient to family member's patient list if not already there
// //   if (!familyMember.patientIds.includes(patientId)) {
// //     familyMember.patientIds.push(patientId);
// //     await familyMember.save();
// //   }

// //   return {
// //     patientId: patient._id,
// //     familyMemberId: familyMember._id,
// //     message: "Family member successfully added to patient"
// //   };
// // };

// // // Assign nurse to patient
// // export const assignNurseToPatient = async (patientId, nurseId) => {
// //   const [patient, nurse] = await Promise.all([
// //     Patient.findById(patientId),
// //     User.findById(nurseId)
// //   ]);

// //   if (!patient || !nurse) {
// //     throw {
// //       statusCode: StatusCodes.NOT_FOUND,
// //       message: "Patient or nurse not found"
// //     };
// //   }

// //   if (nurse.role !== "nurse") {
// //     throw {
// //       statusCode: StatusCodes.BAD_REQUEST,
// //       message: "Only nurses can be assigned to patients"
// //     };
// //   }

// //   // Add nurse to patient if not already there
// //   if (!patient.nurseIds.includes(nurseId)) {
// //     patient.nurseIds.push(nurseId);
// //     await patient.save();
// //   }

// //   return {
// //     patientId: patient._id,
// //     nurseId: nurse._id,
// //     message: "Nurse successfully assigned to patient"
// //   };
// // };
