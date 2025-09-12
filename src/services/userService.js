import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";
import { generateRandomPassword } from "../utils/helper.js";
import SystemLog from "../models/systemLogModel.js";
import mongoose from "mongoose";

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

export const getUserStatsByRole = async (role) => {
  try {
    if (!role) {
      throw {
        message: "Role is required",
        statusCode: 400
      };
    }

    const total = await User.countDocuments({ role });
    const active = await User.countDocuments({ role, isActive: true });
    const inactive = await User.countDocuments({ role, isActive: false });

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

export const getUserStatsForAdmin = async () => {
  try {
    const roles = [
      "hospital",
      "nurse",
      "caregiver",
      "family",
      "patient"
    ];

    // Initialize an object to store total users for each role
    const result = {};

    // Loop through all roles and get the total users for each role
    for (const role of roles) {
      const total = await User.countDocuments({ role });
      result[role] = total;
    }

    return result;
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch user stats",
      statusCode: error.statusCode || 500
    };
  }
};


export const getHospitalStatsByDate = async (startDate, endDate) => {
  try {
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDayOfMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0
    );

    const start = startDate ? new Date(startDate) : firstDayOfMonth;
    const end = endDate ? new Date(endDate) : lastDayOfMonth;

    const allDates = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      allDates.push(currentDate.toISOString().split("T")[0]);
      currentDate.setDate(currentDate.getDate() + 1);
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
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          hospitals: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          date: {
            $concat: [
              { $toString: "$_id.year" },
              "-",
              { $toString: "$_id.month" },
              "-",
              { $toString: "$_id.day" }
            ]
          },
          hospitals: 1
        }
      }
    ]);

    // Prepare result with all dates and hospital counts (set to 0 if no hospitals on a date)
    const result = allDates.map((date) => {
      // Find the hospital count for the given date
      const hospitalData = hospitalsByDate.find((item) => item.date === date);
      return {
        date: date,
        hospitals: hospitalData ? hospitalData.hospitals : 0 // Set to 0 if no hospital found for that date
      };
    });

    return result;
  } catch (error) {
    throw {
      message: error.message || "Failed to fetch hospital stats",
      statusCode: error.statusCode || 500
    };
  }
};

