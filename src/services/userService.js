import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import { generateRandomPassword } from "../utils/helper.js";
import SystemLog from "../models/systemLogModel.js";
import mongoose from "mongoose";
import Nurse from "../models/nurseModel.js";
import Caregiver from "../models/caregiverModel.js";
import Family from "../models/familyModel.js";
import Patient from "../models/patientModel.js";
import BehaviorLog from "../models/behaviorLogModel.js";

const createUserWithRole = async (userData, role, createdBy, session) => {
  const existingEmail = await User.findOne({ email: userData.email }).session(
    session
  );
  if (existingEmail) {
    throw {
      message: "Email already exists",
      statusCode: StatusCodes.CONFLICT,
      field: "email"
    };
  }

  const existingPhone = await User.findOne({ phone: userData.phone }).session(
    session
  );
  if (existingPhone) {
    throw {
      message: "Phone Number already exists",
      statusCode: StatusCodes.CONFLICT,
      field: "phone"
    };
  }

  const randomPassword = generateRandomPassword();

  const user = await User.create(
    [{ ...userData, passwordHash: randomPassword, role, createdBy }],
    { session }
  );

  await SystemLog.create(
    [
      {
        action: `${role}_created`,
        entityType: "User",
        entityId: user[0]._id,
        performedBy: createdBy,
        metadata: { email: user[0].email, role: user[0].role }
      }
    ],
    { session }
  );

  const userObject = user[0].toObject();
  delete userObject.passwordHash;
  delete userObject.accessToken;
  delete userObject.refreshToken;

  return { user: userObject, randomPassword };
};

export const createHospitalAdmin = async (userData, createdBy, session) => {
  return createUserWithRole(userData, "hospital", createdBy, session);
};

export const createNurse = async (userData, createdBy, session) => {
  return createUserWithRole(userData, "nurse", createdBy, session);
};

export const createCaregiver = async (userData, createdBy, session) => {
  return createUserWithRole(userData, "caregiver", createdBy, session);
};

export const createFamilyMember = async (userData, createdBy, session) => {
  return createUserWithRole(userData, "family", createdBy, session);
};

export const createPatient = async (userData, createdBy, session) => {
  return createUserWithRole(userData, "patient", createdBy, session);
};
 

export const updateUserBasics = async (userId, updates = {}, session) => {
  // protect fields
  const allowed = [
    "firstName",
    "lastName", 
    "phone",
    "languagePreference",
    "street",
    "city",
    "state",
    "country",
    "postalCode",
    "dateOfBirth",
    "gender", 
    "profile_image",
  ];

  const payload = {};
  for (const k of allowed) {
    if (updates[k] !== undefined) payload[k] = updates[k];
  }

  // unique checks if email/phone provided
  if (payload.email) {
    const exists = await User.findOne({
      email: payload.email,
      _id: { $ne: userId }
    }).session(session);
    if (exists) {
      throw {
        statusCode: StatusCodes.CONFLICT,
        message: "Email already exists",
        field: "email"
      };
    }
  }
  if (payload.phone) {
    const exists = await User.findOne({
      phone: payload.phone,
      _id: { $ne: userId }
    }).session(session);
    if (exists) {
      throw {
        statusCode: StatusCodes.CONFLICT,
        message: "Phone Number already exists",
        field: "phone"
      };
    }
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: payload, $currentDate: { updatedAt: true } },
    { new: true, session }
  ).lean();

  if (!user) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "User not found" };
  }

  await SystemLog.create(
    [
      {
        action: "user_updated",
        entityType: "User",
        entityId: userId,
        metadata: { fields: Object.keys(payload) }
      }
    ],
    { session }
  );

  // sanitize sensitive fields like model toJSON does
  delete user.passwordHash;
  delete user.accessToken;
  delete user.refreshToken;

  return user;
};

export const updateUserStatus = async (
  userId,
  isActive,
  session,
  performedBy
) => {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: { isActive: isActive },
      $currentDate: { updatedAt: true }
    },
    { new: true, session }
  ).lean();

  if (!user) {
    throw { statusCode: StatusCodes.NOT_FOUND, message: "User not found" };
  }

  const action = isActive ? "user_activated" : "user_deactivated";

  await SystemLog.create(
    [
      {
        action: action,
        entityType: "User",
        entityId: userId,
        performedBy,
        metadata: {
          role: user.role,
          email: user.email,
          status: isActive ? "active" : "inactive"
        }
      }
    ],
    { session }
  );

  delete user.passwordHash;
  delete user.accessToken;
  delete user.refreshToken;

  return user;
};

export const getUserStatsByRole = async (role, hospitalId) => {
  try {
    if (!role) {
      throw { message: "Role is required", statusCode: 400 };
    }

    const base = { role };

    if (hospitalId) {
      const hospObjId = mongoose.Types.ObjectId.isValid(hospitalId)
        ? new mongoose.Types.ObjectId(hospitalId)
        : hospitalId;
      base.createdBy = hospObjId;
    }

    const [total, active, inactive] = await Promise.all([
      User.countDocuments(base),
      User.countDocuments({ ...base, isActive: true }),
      User.countDocuments({ ...base, isActive: false })
    ]);

    return {
      role,
      totalUsers: total,
      activeUsers: active,
      inactiveUsers: inactive
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch user stats",
      statusCode: error.statusCode || 500
    };
  }
};

// export const getUserStatsByRole = async (role) => {
//   try {
//     if (!role) {
//       throw {
//         message: "Role is required",
//         statusCode: 400
//       };
//     }

//     const total = await User.countDocuments({ role });
//     const active = await User.countDocuments({ role, isActive: true });
//     const inactive = await User.countDocuments({ role, isActive: false });

//     return {
//       role,
//       totalUsers: total,
//       activeUsers: active,
//       inactiveUsers: inactive
//     };
//   } catch (error) {
//     throw {
//       message: error.message || "Failed to fetch user stats",
//       statusCode: error.statusCode || 500
//     };
//   }
// };

export const getUserStatsForAdmin = async (startDate, endDate) => {
  try {
    const roles = ["hospital", "nurse", "caregiver", "family", "patient"];
const payment = 0;
    const result = {};

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    } else if (startDate) {
      dateFilter.createdAt = { $gte: new Date(startDate) };
    } else if (endDate) {
      dateFilter.createdAt = { $lte: new Date(endDate) };
    }

    for (const role of roles) {
      const query = { role, ...dateFilter };
      const total = await User.countDocuments(query);
      result[role] = total;
    }

    return {...result, payment};
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch user stats",
      statusCode: error.statusCode || 500
    };
  }
};

export const getHospitalStatsByDate = async (startDate, endDate) => {
  try {
    const startOfDayUTC = (d) =>
      new Date(
        Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          0,
          0,
          0,
          0
        )
      );
    const endOfDayUTC = (d) =>
      new Date(
        Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          23,
          59,
          59,
          999
        )
      );

    const today = new Date();
    const firstDayOfMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
    );
    const lastDayOfMonth = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)
    );

    const start = startDate
      ? startOfDayUTC(new Date(startDate))
      : startOfDayUTC(firstDayOfMonth);
    const end = endDate
      ? endOfDayUTC(new Date(endDate))
      : endOfDayUTC(lastDayOfMonth);

    const allDates = [];
    for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      allDates.push(d.toISOString().slice(0, 10));
    }

    const hospitalsByDate = await User.aggregate([
      {
        $match: {
          role: "hospital",
          createdAt: { $gte: start, $lte: end }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt" 
            }
          },
          hospitals: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          date: "$_id",
          hospitals: 1
        }
      }
    ]);

    const result = allDates.map((date) => {
      const found = hospitalsByDate.find((x) => x.date === date);
      return { date, hospitals: found ? found.hospitals : 0 };
    });

    return result;
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch hospital stats",
      statusCode: error.statusCode || 500
    };
  }
};

export const getNurseStats = async (nurseId, startDate, endDate) => {
  try {
    const nurseObjId = new mongoose.Types.ObjectId(nurseId);

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    } else if (startDate) {
      dateFilter.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      dateFilter.date = { $lte: new Date(endDate) };
    }

    const totalPatients = await Patient.countDocuments({
      nurseIds: nurseObjId,
    });

    const totalActivePatients = await Patient.countDocuments({
      nurseIds: nurseObjId,
      status: "active",
    });

    const totalActiveCaregivers = await Caregiver.countDocuments({
      nurseId: nurseObjId,
      "caregiverUser.isActive": true,
    });

    const nursePatients = await Patient.find(
      { nurseIds: nurseObjId },
      { _id: 1 }
    ).lean();

    const patientIds = nursePatients.map((p) => p._id);

    const pipeline = [
      {
        $match: {
          patientId: { $in: patientIds },
          ...(Object.keys(dateFilter).length ? dateFilter : {}),
          incidents: { $exists: true, $ne: [] },
        },
      },
      {
        $project: {
          incidentsCount: { $size: "$incidents" },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$incidentsCount" },
        },
      },
    ];

    const incidentAgg = await BehaviorLog.aggregate(pipeline);
    const totalTodayIncidents = incidentAgg[0]?.total || 0;

    return {
      totalPatients,
      totalActivePatients,
      totalActiveCaregivers,
      totalTodayIncidents,
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch nurse stats",
      statusCode: 500,
    };
  }
};

export const getHospitalStats = async (hospitalId, startDate, endDate) => {
  try {
    const hospObjId = new mongoose.Types.ObjectId(hospitalId);

    const buildDateMatch = (path) => {
      if (!startDate && !endDate) return null;
      const m = {};
      if (startDate) m.$gte = new Date(startDate);
      if (endDate) m.$lte = new Date(endDate);
      return { [path]: m };
    };

    const patientDate = buildDateMatch("createdAt");
    const nurseDate = buildDateMatch("createdAt");
    const caregiverDate = buildDateMatch("createdAt");
    const familyDate = buildDateMatch("createdAt");

    const patientPipeline = [
      { $match: { hospitalId: hospObjId, ...(patientDate || {}) } },
      {
        $lookup: {
          from: "users",
          localField: "patientUserId",
          foreignField: "_id",
          as: "u"
        }
      },
      { $unwind: "$u" },
      {
        $group: {
          _id: "$u.isActive",
          count: { $sum: 1 }
        }
      }
    ];

    const nursePipeline = [
      { $match: { ...(nurseDate || {}) /*, hospitalId: hospObjId*/ } },
      {
        $lookup: {
          from: "users",
          localField: "nurseUserId",
          foreignField: "_id",
          as: "u"
        }
      },
      { $unwind: "$u" },

      { $match: { "u.createdBy": hospObjId } },
      {
        $group: {
          _id: "$u.isActive",
          count: { $sum: 1 }
        }
      }
    ];

    const caregiverPipeline = [
      { $match: { hospitalId: hospObjId, ...(caregiverDate || {}) } },
      {
        $lookup: {
          from: "users",
          localField: "caregiverUserId",
          foreignField: "_id",
          as: "u"
        }
      },
      { $unwind: "$u" },
      {
        $group: {
          _id: "$u.isActive",
          count: { $sum: 1 }
        }
      }
    ];

    const familyPipeline = [
      { $match: { ...(familyDate || {}) } },
      {
        $lookup: {
          from: "patients",
          localField: "patientId",
          foreignField: "_id",
          as: "p"
        }
      },
      { $unwind: "$p" },
      { $match: { "p.hospitalId": hospObjId } },
      {
        $lookup: {
          from: "users",
          localField: "familyMemberUserId",
          foreignField: "_id",
          as: "u"
        }
      },
      { $unwind: "$u" },
      {
        $group: {
          _id: "$u.isActive",
          count: { $sum: 1 }
        }
      }
    ];
    const [pAgg, nAgg, cAgg, fAgg] = await Promise.all([
      Patient.aggregate(patientPipeline),
      Nurse.aggregate(nursePipeline),
      Caregiver.aggregate(caregiverPipeline),
      Family.aggregate(familyPipeline)
    ]);

    const split = (agg) => ({
      active: agg.find((d) => d._id === true)?.count || 0,
      inactive: agg.find((d) => d._id === false)?.count || 0
    });

    const p = split(pAgg);
    const n = split(nAgg);
    const c = split(cAgg);
    const f = split(fAgg);

    return {
      totalActivePatients: p.active,
      totalInActivePatients: p.inactive,

      totalActiveNurses: n.active,
      totalInActiveNurses: n.inactive,

      totalActiveCaregivers: c.active,
      totalInActiveCaregivers: c.inactive,

      totalActiveFamilys: f.active,
      totalInActiveFamilys: f.inactive
    };
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch hospital stats",
      statusCode: error.statusCode || 500
    };
  }
};

const listByRole = async ({
  model,
  localUserField,
  asName,
  listKey,
  query = {},
  page = 1,
  limit = 10,
  hospitalId,
}) => {
  try {
    const skip = (page - 1) * limit;

    const toObjectId = (id) =>
      mongoose.Types.ObjectId.isValid(id)
        ? new mongoose.Types.ObjectId(id)
        : null;
    const matchStage = {};
    if (hospitalId) {
      const hospObjId = toObjectId(hospitalId);
      if (hospObjId) {
        matchStage[`${asName}.createdBy`] = hospObjId;
      } else {
        matchStage[`${asName}.createdBy`] = hospitalId;
      }
    }
    console.log(matchStage," matchStage");

    // const matchStage = {};
    // if (hospitalId) {
    //   matchStage[`${asName}.createdBy`] = hospitalId;
    // }
    // console.log(matchStage," matchStage");

    if (query.isActive !== undefined) {
      matchStage[`${asName}.isActive`] = query.isActive === "true";
    }

    if (query.search) {
      const regex = new RegExp(query.search, "i");
      matchStage.$or = [
        { [`${asName}.firstName`]: regex },
        { [`${asName}.lastName`]: regex },
        { [`${asName}.email`]: regex },
        { [`${asName}.phone`]: regex },
      ];
    }

    const aggregationPipeline = [
      {
        $lookup: {
          from: "users",
          localField: localUserField,
          foreignField: "_id",
          as: asName,
        },
      },
      { $unwind: `$${asName}` },
      { $match: matchStage },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                __v: 0,
                [`${asName}.passwordHash`]: 0,
                [`${asName}.__v`]: 0,
                [`${asName}.accessToken`]: 0,
                [`${asName}.refreshToken`]: 0,
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await model.aggregate(aggregationPipeline);
    const list = result[0].data;
    const total = result[0].totalCount[0]?.count || 0;

    await SystemLog.create({
      action: `${listKey}_viewed`,
      entityType: listKey.slice(0, -1),
      metadata: {
        page,
        limit,
        filters: query,
        count: list.length,
        hospitalId: hospitalId || null,
      },
    });

    return {
      [listKey]: list,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    throw {
      message: error.message || `Failed to fetch ${listKey}`,
      statusCode: 500,
    };
  }
};

export const getNurses = (query = {}, page = 1, limit = 10, hospitalId) =>
  listByRole({
    model: Nurse,
    localUserField: "nurseUserId",
    asName: "nurseUser",
    listKey: "nurses",
    query,
    page,
    limit,
    hospitalId,
  });

export const getCaregivers = (query = {}, page = 1, limit = 10, hospitalId) =>
  listByRole({
    model: Caregiver,
    localUserField: "caregiverUserId",
    asName: "caregiverUser",
    listKey: "caregivers",
    query,
    page,
    limit,
    hospitalId,
  });

export const getFamilies = (query = {}, page = 1, limit = 10, hospitalId) =>
  listByRole({
    model: Family,
    localUserField: "familyMemberUserId",
    asName: "familyUser",
    listKey: "familyMembers",
    query,
    page,
    limit,
    hospitalId
  });

export const getPatients = (query = {}, page = 1, limit = 10, hospitalId) =>
  listByRole({
    model: Patient,
    localUserField: "patientUserId",
    asName: "patientUser",
    listKey: "patients",
    query,
    page,
    limit,
    hospitalId,
  });
