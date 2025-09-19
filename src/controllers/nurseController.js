import * as nurseService from "../services/nurseService.js";
import { uploadBufferToS3 } from "../utils/s3Service.js";
import * as userService from "../services/userService.js";
import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";

export const getNurses = async (req, res) => {
  try {
    const { page, limit, search, isActive,lang } = req.query;
    const hospitalId = req.user?._id;

    const filters = {
      search,
      isActive
    };

    const result = await nurseService.getNurses(
      filters,
      parseInt(page),
      parseInt(limit),
      hospitalId,
      lang
    );

    return res.success("Nurses fetched successfully.", result, StatusCodes.OK);
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message
      });
  }
};

export const getNurse = async (req, res) => {
  try {
    const nurse = await nurseService.getNurseById(req.params.id);

    return res.success("Nurse fetched successfully.", nurse, StatusCodes.OK);
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message
      });
  }
};

export const updateNurse = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { nurse } = await nurseService.getNurseById(req.params.id);
    const userId = nurse.nurseUserId?._id || nurse.nurseUserId;

    if (!userId) {
      throw {
        statusCode: StatusCodes.NOT_FOUND,
        message: "Associated user not found for this nurse"
      };
    }

    let profileImageKey;
    if (req.file?.buffer) {
      const { key } = await uploadBufferToS3({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        keyPrefix: "profiles/nurse"
      });
      profileImageKey = key;
    }

    const userPayload = {};
    const nursePayload = {};

    Object.keys(req.body).forEach((key) => {
      if (key.startsWith("userData.")) {
        const fieldName = key.replace("userData.", "");
        userPayload[fieldName] = req.body[key];
      } else if (key.startsWith("nurseData.")) {
        const fieldName = key.replace("nurseData.", "");
        nursePayload[fieldName] = req.body[key];
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

    let updatedNurse = null;
    if (Object.keys(nursePayload).length > 0) {
      updatedNurse = await nurseService.updateNurse(
        req.params.id,
        nursePayload,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    // let userPayload = {};
    // try {
    //   userPayload = req.body.user ? JSON.parse(req.body.user) : {};
    // } catch (err) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Invalid user data format"
    //   });
    // }


    // const updatedUser = await userService.updateUserBasics(
    //   userId,
    //   {
    //     ...userPayload,
    //     ...(profileImageKey ? { profile_image: profileImageKey } : {})
    //   },
    //   session
    // );


    // const nursePayload = req.body.nurseData
    //   ? JSON.parse(req.body.nurseData)
    //   : {};

    // const updatedNurse = await nurseService.updateNurse(
    //   req.params.id,
    //   nursePayload,
    //   session
    // );


    // await session.commitTransaction();
    // session.endSession();

    return res.success("Nurse updated successfully.", {
      user: updatedUser,
      nurse: updatedNurse
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message: error.message || "Failed to update nurse"
      });
  }
};



export const updateNurseStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { isActive } = req.body; // Expecting isActive: true/false in request body

    if (typeof isActive !== "boolean") {
      throw {
        statusCode: StatusCodes.BAD_REQUEST,
        message: "isActive parameter is required and must be a boolean"
      };
    }

    const { nurse } = await nurseService.getNurseById(id);
    const userId = nurse.nurseUserId?._id || nurse.nurseUserId;

    const user = await userService.updateUserStatus(
      userId,
      isActive,
      session,
      req.user._id
    );

    await session.commitTransaction();
    session.endSession();

    const message = isActive
      ? "Nurse user activated successfully."
      : "Nurse user deactivated successfully.";

    return res.success(message, { user });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};
// export const deactivateNurseUser = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();
//   try {
//     const { nurse } = await nurseService.getNurseById(req.params.id);
//     const userId = nurse.nurseUserId?._id || nurse.nurseUserId;

//     const user = await userService.deactivateUser(
//       userId,
//       session,
//       req.user._id
//     );

//     await session.commitTransaction();
//     session.endSession();

//     return res.success("Nurse user deactivated successfully.", { user });
//   } catch (error) {
//     await session.abortTransaction();
//     session.endSession();
//     return res
//       .status(error.statusCode || 500)
//       .json({ success: false, message: error.message });
//   }
// };


// export const updateNurseProfile = async (req, res) => {
//   try {
//     const { nurseData, userData } = req.body;

//     // Update nurse and user profile data
//     const { updatedUser, updatedNurse } = await updateNurse(
//       req.params.id,
//       nurseData,
//       userData,
//       req.files
//     );

//     return res.status(StatusCodes.OK).json({
//       success: true,
//       message: "Nurse profile updated successfully.",
//       data: { updatedUser, updatedNurse }
//     });
//   } catch (error) {
//     return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
//       success: false,
//       message: error.message || "Error updating nurse profile."
//     });
//   }
// };