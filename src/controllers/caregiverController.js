import * as caregiverService from "../services/caregiverService.js";
import { uploadBufferToS3 } from "../utils/s3Service.js";
import * as userService from "../services/userService.js";
import { StatusCodes } from "http-status-codes";
import Nurse from "../models/nurseModel.js";
import mongoose from "mongoose";

// GET ALL
export const getCaregivers = async (req, res) => {
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

    const result = await caregiverService.getCaregivers(
      filters,
      parseInt(page),
      parseInt(limit),
      hospitalId
    );

    return res.success(
      "Caregivers fetched successfully.",
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

export const getNurseCaregivers = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, search } = req.query;

    const nurseUserId = req.user?._id;

    let nurseDocId = null;
    if (mongoose.Types.ObjectId.isValid(nurseUserId)) {
      const nurseDoc = await Nurse.findOne(
        { nurseUserId: new mongoose.Types.ObjectId(nurseUserId) },
        { _id: 1 }
      ).lean();
      nurseDocId = nurseDoc?._id || null;
    }

    const filters = {};
    if (isActive !== undefined) filters.isActive = isActive;
    if (search) filters.search = search;

    const result = await caregiverService.getCaregiversForNurse(
      filters,
      parseInt(page),
      parseInt(limit),
      [nurseUserId, nurseDocId].filter(Boolean)
    );

    return res.success(
      "Caregivers fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// GET BY ID
export const getCaregiver = async (req, res) => {
  try {
    const caregiver = await caregiverService.getCaregiverById(req.params.id);

    return res.success(
      "Caregiver fetched successfully.",
      caregiver,
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

// export const updateCaregiver = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { caregiver } = await caregiverService.getCaregiverById(
//       req.params.id
//     );
//     const userId = caregiver.caregiverUserId?._id || caregiver.caregiverUserId;

//     let profileImageKey;
//     if (req.file?.buffer) {
//       const { key } = await uploadBufferToS3({
//         buffer: req.file.buffer,
//         mimeType: req.file.mimetype,
//         keyPrefix: "profiles/caregiver"
//       });
//       profileImageKey = key;
//     }

//     let userPayload = {};
//     try {
//       userPayload = req.body.user ? JSON.parse(req.body.user) : {};
//     } catch (err) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid user data format"
//       });
//     }

//     const updatedUser = await userService.updateUserBasics(
//       userId,
//       {
//         ...userPayload,
//         ...(profileImageKey ? { profile_image: profileImageKey } : {})
//       },
//       session
//     );


//     const updatedCaregiver = req.body.nurseData
//       ? JSON.parse(req.body.nurseData)
//       : {};
    
//         const updatedNurse = await caregiverService.updateCaregiver(
//           req.params.id,
//           updatedCaregiver,
//           session
//         );

//     await session.commitTransaction();
//     session.endSession();

//     return res.success("Caregiver updated successfully.", {
//       user: updatedUser,
//       caregiver: updatedCaregiver
//     });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     return res
//       .status(error.statusCode || 500)
//       .json({
//         success: false,
//         message: error.message || "Failed to update caregiver"
//       });
//   }
// };

export const updateCaregiver = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { caregiver } = await caregiverService.getCaregiverById(
      req.params.id
    );
    const userId = caregiver.caregiverUserId?._id || caregiver.caregiverUserId;

    if (!userId) {
      throw {
        statusCode: StatusCodes.NOT_FOUND,
        message: "Associated user not found for this caregiver"
      };
    }

    // Handle profile image upload
    let profileImageKey;
    if (req.file?.buffer) {
      const { key } = await uploadBufferToS3({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        keyPrefix: "profiles/caregiver"
      });
      profileImageKey = key;
    }

    // Parse form data fields
    const userPayload = {};
    const caregiverPayload = {};

    // Extract user data from form fields starting with 'userData.'
    Object.keys(req.body).forEach(key => {
      if (key.startsWith('userData.')) {
        const fieldName = key.replace('userData.', '');
        userPayload[fieldName] = req.body[key];
      } else if (key.startsWith('caregiverData.')) {
        const fieldName = key.replace('caregiverData.', '');
        caregiverPayload[fieldName] = req.body[key];
      }
    });

    // Update user basics if user data is provided
    let updatedUser = null;
    if (Object.keys(userPayload).length > 0) {
      if (profileImageKey) userPayload.profile_image = profileImageKey;
      updatedUser = await userService.updateUserBasics(
        userId,
        userPayload,
        session
      );
    }

    // Update caregiver data if provided
    let updatedCaregiver = null;
    if (Object.keys(caregiverPayload).length > 0) {
      updatedCaregiver = await caregiverService.updateCaregiver(
        req.params.id,
        caregiverPayload,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.success("Caregiver updated successfully.", {
      user: updatedUser,
      caregiver: updatedCaregiver
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update caregiver"
    });
  }
};



export const updateCaregiverStatus = async (req, res) => {
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

    const { caregiver } = await caregiverService.getCaregiverById(
      req.params.id
    );
    const userId = caregiver.caregiverUserId?._id || caregiver.caregiverUserId;

    const user = await userService.updateUserStatus(
      userId,
      isActive,
      session,
      req.user._id
    );

    await session.commitTransaction();
    session.endSession();

    const message = isActive
      ? "Caregiver user activated successfully."
      : "Caregiver user deactivated successfully.";

    return res.success(message, { user });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// export const deactivateCaregiverUser = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { caregiver } = await caregiverService.getCaregiverById(
//       req.params.id
//     );
//     const userId = caregiver.caregiverUserId?._id || caregiver.caregiverUserId;

//     const user = await userService.deactivateUser(
//       userId,
//       session,
//       req.user._id
//     );

//     await session.commitTransaction();
//     session.endSession();

//     return res.success("Caregiver user deactivated successfully.", { user });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     return res
//       .status(error.statusCode || 500)
//       .json({ success: false, message: error.message });
//   }
// };

// export const updateCaregiverProfile = async (req, res) => {
//   try {
//     const { caregiverData, userData } = req.body;

//     // Update caregiver and user profile data
//     const { updatedUser, updatedCaregiver } = await updateCaregiver(
//       req.params.id,
//       caregiverData,
//       userData,
//       req.files
//     );

//     return res.status(StatusCodes.OK).json({
//       success: true,
//       message: "Caregiver profile updated successfully.",
//       data: { updatedUser, updatedCaregiver }
//     });
//   } catch (error) {
//     return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
//       success: false,
//       message: error.message || "Error updating caregiver profile."
//     });
//   }
// };