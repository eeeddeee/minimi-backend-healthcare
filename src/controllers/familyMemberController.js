import * as familyMemberService from "../services/familyService.js";
import { uploadBufferToS3 } from "../utils/s3Service.js";
import { StatusCodes } from "http-status-codes";
import * as userService from "../services/userService.js";
import mongoose from "mongoose";

// GET ALL
export const getFamilyMembers = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, search } = req.query;

    const hospitalId = req.user?._id;

    const filters = {};
    if (isActive !== undefined) {
      filters.isActive = isActive;
    }
    if (search) {
      filters.search = search;
    }

    const result = await familyMemberService.getFamilyMembers(
      filters,
      parseInt(page),
      parseInt(limit),
      hospitalId
    );

    return res.success(
      "Family members fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message
      });
  }
};


// GET BY ID
export const getFamilyMember = async (req, res) => {
  try {
    const familyMember = await familyMemberService.getFamilyMemberById(
      req.params.id
    );

    return res.success(
      "Family member fetched successfully.",
      familyMember,
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message
      });
  }
};

export const updateFamilyMember = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction(); 
  try {
    const { familyMember } = await familyMemberService.getFamilyMemberById(
      req.params.id
    );
    const userId =
      familyMember.familyMemberUserId?._id || familyMember.familyMemberUserId;

    if (!userId) {
      throw {
        statusCode: StatusCodes.NOT_FOUND,
        message: "Associated user not found for this family member"
      };
    }

    let profileImageKey;
    if (req.file?.buffer) {
      const { key } = await uploadBufferToS3({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        keyPrefix: "profiles/family"
      });
      profileImageKey = key;
    }

    const userPayload = {};
    const familyPayload = {};

    Object.keys(req.body).forEach((key) => {
      if (key.startsWith("userData.")) {
        const fieldName = key.replace("userData.", "");
        userPayload[fieldName] = req.body[key];
      } else if (key.startsWith("familyData.")) {
        const fieldName = key.replace("familyData.", "");
        familyPayload[fieldName] = req.body[key];
      }
    });

    let updatedUser = null;
    if (Object.keys(userPayload).length > 0) {
      if (profileImageKey) userPayload.profile_image = profileImageKey;
      updatedUser = await userService.updateUserBasics(
        userId,
        userPayload,
        session
      );
    }

    let updatedFamily = null;
    if (Object.keys(familyPayload).length > 0) {
      updatedFamily = await familyMemberService.updateFamilyMember(
        req.params.id,
        familyPayload,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.success("Family member updated successfully.", {
      user: updatedUser,
      familyMember: updatedFamily
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message: error.message || "Failed to update family member"
      });
  }
};


export const updateFamilyMemberStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      throw {
        statusCode: StatusCodes.BAD_REQUEST,
        message: "isActive parameter is required and must be a boolean"
      };
    }

    const { familyMember } = await familyMemberService.getFamilyMemberById(
      req.params.id
    );
    const userId =
      familyMember.familyMemberUserId?._id || familyMember.familyMemberUserId;

    const user = await userService.updateUserStatus(
      userId,
      isActive,
      session,
      req.user._id
    );

    await session.commitTransaction();
    session.endSession();

    const message = isActive
      ? "Family member user activated successfully."
      : "Family member user deactivated successfully.";

    return res.success(message, { user });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};
// export const deactivateFamilyMemberUser = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { familyMember } = await familyMemberService.getFamilyMemberById(
//       req.params.id
//     );
//     const userId =
//       familyMember.familyMemberUserId?._id || familyMember.familyMemberUserId;

//     const user = await userService.deactivateUser(
//       userId,
//       session,
//       req.user._id
//     );

//     await session.commitTransaction();
//     session.endSession();

//     return res.success("Family member user deactivated successfully.", {
//       user
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     return res
//       .status(error.statusCode || 500)
//       .json({ success: false, message: error.message });
//   }
// };