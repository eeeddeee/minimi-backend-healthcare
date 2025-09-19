import Nurse from "../models/nurseModel.js";
import SystemLog from "../models/systemLogModel.js";
import mongoose from "mongoose";
import { translateText } from "../utils/translate.js";

export const createNurse = async (nurseData, createdBy, session) => {
  const nurse = await Nurse.create([{ ...nurseData, createdBy }], { session });
  return nurse[0].toObject();
};

export const getNurses = async (
  query = {},
  page,
  limit,
  hospitalId,
  lang = "en"
) => {
  try {
    const skip = (page - 1) * limit;
    const matchStage = {};
    if (hospitalId) {
      matchStage["nurseUser.createdBy"] = hospitalId;
    }

    if (query.isActive !== undefined) {
      matchStage["nurseUser.isActive"] = query.isActive === "true";
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
                $concat: ["$nurseUser.firstName", " ", "$nurseUser.lastName"]
              },
              regex: exactRegex
            }
          }
        },
        { "nurseUser.firstName": exactRegex },
        { "nurseUser.lastName": exactRegex },
        { "nurseUser.fullName": exactRegex },
        { "nurseUser.email": exactRegex },
        { "nurseUser.phone": exactRegex },
        { "nurseUser.firstName": partialRegex },
        { "nurseUser.lastName": partialRegex },
        { "nurseUser.fullName": partialRegex }
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
            ...(page && limit
              ? [{ $skip: (page - 1) * limit }, { $limit: limit }]
              : []),
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

    // Validate lang
    const validLanguages = ["en", "es", "hi", "bn", "ta", "zh"];
    const targetLang = validLanguages.includes(lang) ? lang : "en";

    // Translate dynamic fields
    const translatedNurses = await Promise.all(
      nurses.map(async (nurse) => {
        const translated = { ...nurse };
        translated.nurseUser.firstName = await translateText(
          nurse.nurseUser.firstName,
          targetLang
        );
        translated.nurseUser.lastName = await translateText(
          nurse.nurseUser.lastName,
          targetLang
        );
        translated.nurseUser.role = await translateText(
          nurse.nurseUser.role,
          targetLang
        );
        translated.nurseUser.street = await translateText(
          nurse.nurseUser.street,
          targetLang
        );
        translated.nurseUser.city = await translateText(
          nurse.nurseUser.city,
          targetLang
        );
        translated.nurseUser.country = await translateText(
          nurse.nurseUser.country,
          targetLang
        );
        translated.specialization = await translateText(
          nurse.specialization || "",
          targetLang
        );
        translated.department = await translateText(
          nurse.department || "",
          targetLang
        );
        translated.nurseShifts = await Promise.all(
          (nurse.nurseShifts || []).map((shift) =>
            translateText(shift, targetLang)
          )
        );
        translated.nurseUser.fullName = `${translated.nurseUser.firstName} ${translated.nurseUser.lastName}`;
        return translated;
      })
    );

    await SystemLog.create({
      action: "nurses_viewed",
      entityType: "Nurse",
      metadata: {
        page,
        limit,
        filters: query,
        count: nurses.length,
        language: targetLang
      }
    });

    return {
      nurses: translatedNurses,
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

// export const getNurses = async (query = {}, page, limit, hospitalId) => {
//   try {
//     const skip = (page - 1) * limit;
//     const matchStage = {};
//     if (hospitalId) {
//       matchStage["nurseUser.createdBy"] = hospitalId;
//     }

//     // Filter by isActive inside nurseUser
//     if (query.isActive !== undefined) {
//       matchStage["nurseUser.isActive"] = query.isActive === "true";
//     }

//     if (query.search) {
//       const searchTerm = decodeURIComponent(query.search)
//         .replace(/\t/g, " ")
//         .trim()
//         .replace(/\s+/g, " ");

//       const exactRegex = new RegExp(`^${searchTerm}$`, "i");

//       const partialRegex = new RegExp(searchTerm, "i");

//       matchStage.$or = [
//         {
//           $expr: {
//             $regexMatch: {
//               input: {
//                 $concat: ["$nurseUser.firstName", " ", "$nurseUser.lastName"],
//               },
//               regex: exactRegex,
//             },
//           },
//         },
//         { "nurseUser.firstName": exactRegex },
//         { "nurseUser.lastName": exactRegex },
//         { "nurseUser.fullName": exactRegex },
//         { "nurseUser.email": exactRegex },
//         { "nurseUser.phone": exactRegex },
//         { "nurseUser.firstName": partialRegex },
//         { "nurseUser.lastName": partialRegex },
//         { "nurseUser.fullName": partialRegex },
//       ];
//     }

//     const aggregationPipeline = [
//       {
//         $lookup: {
//           from: "users",
//           localField: "nurseUserId",
//           foreignField: "_id",
//           as: "nurseUser",
//         },
//       },
//       { $unwind: "$nurseUser" },
//       { $match: matchStage },
//       {
//         $facet: {
//           data: [
//             ...(page && limit
//               ? [{ $skip: (page - 1) * limit }, { $limit: limit }]
//               : []),
//             {
//               $project: {
//                 __v: 0,
//                 "nurseUser.passwordHash": 0,
//                 "nurseUser.__v": 0,
//                 "nurseUser.accessToken": 0,
//                 "nurseUser.refreshToken": 0,
//               },
//             },
//           ],
//           totalCount: [{ $count: "count" }],
//         },
//       },
//     ];

//     // const aggregationPipeline = [
//     //   {
//     //     $lookup: {
//     //       from: "users",
//     //       localField: "nurseUserId",
//     //       foreignField: "_id",
//     //       as: "nurseUser",
//     //     },
//     //     b,
//     //   },
//     //   { $unwind: "$nurseUser" },
//     //   {
//     //     $addFields: {
//     //       "nurseUser.fullName": {
//     //         $concat: ["$nurseUser.firstName", " ", "$nurseUser.lastName"],
//     //       },
//     //     },
//     //   },
//     //   // Apply ALL filters (search + isActive + hospitalId)
//     //   {
//     //     $match: {
//     //       ...(hospitalId ? { "nurseUser.createdBy": hospitalId } : {}),
//     //       ...(query.isActive !== undefined
//     //         ? { "nurseUser.isActive": query.isActive === "true" }
//     //         : {}),
//     //       ...(query.search
//     //         ? {
//     //             $or: [
//     //               { "nurseUser.firstName": new RegExp(query.search, "i") },
//     //               { "nurseUser.lastName": new RegExp(query.search, "i") },
//     //               { "nurseUser.fullName": new RegExp(query.search, "i") },
//     //               { "nurseUser.email": new RegExp(query.search, "i") },
//     //               { "nurseUser.phone": new RegExp(query.search, "i") },
//     //             ],
//     //           }
//     //         : {}),
//     //     },
//     //   },
//     //   // Facet AFTER filters
//     //   {
//     //     $facet: {
//     //       data: [
//     //         ...(page && limit
//     //           ? [{ $skip: (page - 1) * limit }, { $limit: limit }]
//     //           : []),
//     //         {
//     //           $project: {
//     //             __v: 0,
//     //             "nurseUser.passwordHash": 0,
//     //             "nurseUser.__v": 0,
//     //             "nurseUser.accessToken": 0,
//     //             "nurseUser.refreshToken": 0,
//     //           },
//     //         },
//     //       ],
//     //       totalCount: [{ $count: "count" }],
//     //     },
//     //   },
//     // ];

//     const result = await Nurse.aggregate(aggregationPipeline);
//     const nurses = result[0].data;
//     const total = result[0].totalCount[0]?.count || 0;

//     await SystemLog.create({
//       action: "nurses_viewed",
//       entityType: "Nurse",
//       metadata: {
//         page,
//         limit,
//         filters: query,
//         count: nurses.length,
//       },
//     });

//     return {
//       nurses,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//       },
//     };
//   } catch (error) {
//     throw {
//       message: error.message || "Failed to fetch nurses",
//       statusCode: 500,
//     };
//   }
// };

export const getNurseById = async (nurseId) => {
  try {
    const nurse = await Nurse.findById(nurseId)
      .select("-__v")
      .populate({
        path: "nurseUserId",
        select: "-password -__v",
      })
      .lean();

    if (!nurse) {
      throw {
        message: "Nurse not found",
        statusCode: 404,
      };
    }

    await SystemLog.create({
      action: "nurse_viewed",
      entityType: "Nurse",
      entityId: nurseId,
    });

    return { nurse };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch nurse",
      statusCode: error.statusCode || 500,
    };
  }
};

export const updateNurse = async (nurseId, updates = {}, session) => {
  const allowed = [
    "department",
    "nurseShifts",
    "NurselicenseNumber",
    "specialization",
    "yearsOfExperience",
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
        metadata: { fields: Object.keys(payload) },
      },
    ],
    { session }
  );

  return nurse;
};
