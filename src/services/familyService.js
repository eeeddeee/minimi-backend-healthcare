import FamilyMember from "../models/familyModel.js";
import Patient from "../models/patientModel.js";
import { StatusCodes } from "http-status-codes";
import SystemLog from "../models/systemLogModel.js";

export const createFamilyMember = async (familyData, createdBy, session) => {
  const existingRelationship = await FamilyMember.findOne({
    patient: familyData.patientId,
    familyMemberUserId: familyData.familyMemberUserId
  }).session(session);

  if (existingRelationship) {
    throw {
      statusCode: StatusCodes.CONFLICT,
      message: "This family relationship already exists"
    };
  }

  const familyMemberData = {
    familyMemberUserId: familyData.familyMemberUserId,
    patientId: familyData.patientId,
    relationship: familyData.relationship,
    canMakeAppointments: familyData.canMakeAppointments,
    canAccessMedicalRecords: familyData.canAccessMedicalRecords,
    createdBy
  };
  // console.log("Data going to FamilyMember.create:", familyMemberData);

  const familyMember = await FamilyMember.create([familyMemberData], {
    session
  });
  // console.log(familyMember, "family service");

  return familyMember[0].toObject();
};

export const getFamilyMembers = async (query = {}, page = 1, limit = 10) => {
  try {
    const skip = (page - 1) * limit;

    const matchStage = {};

    // Filter by isActive inside familyMemberUserId
    if (query.isActive !== undefined) {
      matchStage["familyUser.isActive"] = query.isActive === "true";
    }

    // Search filter inside familyMemberUserId
    if (query.search) {
      const regex = new RegExp(query.search, "i");
      matchStage.$or = [
        { "familyUser.firstName": regex },
        { "familyUser.lastName": regex },
        { "familyUser.email": regex },
        { "familyUser.phone": regex }
      ];
    }

    const aggregationPipeline = [
      {
        $lookup: {
          from: "users",
          localField: "familyMemberUserId",
          foreignField: "_id",
          as: "familyUser"
        }
      },
      { $unwind: "$familyUser" },
      {
        $lookup: {
          from: "patients",
          localField: "patientId",
          foreignField: "_id",
          as: "patient"
        }
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "patient.patientUserId",
          foreignField: "_id",
          as: "patientUser"
        }
      },
      { $unwind: { path: "$patientUser", preserveNullAndEmptyArrays: true } },
      { $match: matchStage },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                __v: 0,
                "familyUser.passwordHash": 0,
                "familyUser.__v": 0,
                "familyUser.accessToken": 0,
                "familyUser.refreshToken": 0,
                "patient.__v": 0,
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
    const result = await FamilyMember.aggregate(aggregationPipeline);

    const familyMembers = result[0].data;
    const total = result[0].totalCount[0]?.count || 0;

    await SystemLog.create({
      action: "family_members_viewed",
      entityType: "FamilyMember",
      metadata: {
        page,
        limit,
        filters: query,
        count: familyMembers.length
      }
    });

    return {
      familyMembers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch family members",
      statusCode: 500
    };
  }
};


// GET BY ID
export const getFamilyMemberById = async (familyMemberId) => {
  try {
    const familyMember = await FamilyMember.findById(familyMemberId)
      .select("-__v")
      .populate({
        path: "familyMemberUserId",
        select: "-password -__v"
      })
      .lean();

    if (!familyMember) {
      throw {
        message: "Family Member not found",
        statusCode: 404
      };
    }

    await SystemLog.create({
      action: "family_member_viewed",
      entityType: "FamilyMember",
      entityId: familyMemberId
    });

    return { familyMember };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch family member",
      statusCode: error.statusCode || 500
    };
  }
};

export const updateFamilyMember = async (
  familyMemberId,
  updates = {},
  session
) => {
  const allowed = [
    "relationship",
    "canMakeAppointments",
    "canAccessMedicalRecords"
  ];
  const payload = {};
  for (const k of allowed)
    if (updates[k] !== undefined) payload[k] = updates[k];

  const familyMember = await FamilyMember.findByIdAndUpdate(
    familyMemberId,
    { $set: payload },
    { new: true, session }
  )
    .select("-__v")
    .lean();

  if (!familyMember)
    throw {
      statusCode: StatusCodes.NOT_FOUND,
      message: "Family Member not found"
    };

  await SystemLog.create(
    [
      {
        action: "family_member_updated",
        entityType: "FamilyMember",
        entityId: familyMemberId,
        metadata: { fields: Object.keys(payload) }
      }
    ],
    { session }
  );

  return familyMember;
};


// export const getFamilyMembersByPatient = async (patientId, session = null) => {
//   const query = FamilyMember.find({ patient: patientId }).populate("user");
//   if (session) query.session(session);
//   return query;
// };
