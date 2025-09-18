import { StatusCodes } from "http-status-codes";
import * as hospitalService from "../services/hospitalService.js";
import * as userService from "../services/userService.js";
import { uploadBufferToS3 } from "../utils/s3Service.js";
import mongoose from "mongoose";


export const getHospitals = async (req, res) => {
  try {
    const { page, limit, isActive, search } = req.query;

    const filters = {};
    if (isActive !== undefined) {
      filters.isActive = isActive;
    }
    if (search) {
      filters.search = search;
    }

    const result = await hospitalService.getHospitals(
      filters,
      parseInt(page),
      parseInt(limit)
    );

    return res.success(
      "Hospitals fetched successfully.",
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

export const getHospital = async (req, res) => {
  try {
    const hospital = await hospitalService.getHospitalById(req.params.id);

    return res.success(
      "Hospital fetched successfully.",
      hospital,
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


export const updateHospital = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    // 1) fetch hospital to read linked userId
    const existingHospital = await hospitalService.getHospitalById(
      req.params.id
    );
    const userId =
      existingHospital.hospital.hospitalUserId?._id ||
      existingHospital.hospital.hospitalUserId;

    if (!userId) {
      throw {
        statusCode: StatusCodes.NOT_FOUND,
        message: "Associated user not found for this hospital"
      };
    }

    // 2) upload photo if provided
    let profileImageKey;
    if (req.file?.buffer) {
      const { key } = await uploadBufferToS3({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        keyPrefix: "profiles/hospital"
      });
      profileImageKey = key;
    }

    const userPayload = {};
    const hospitalPayload = {};

    // Extract user data from form fields starting with 'userData.'
    Object.keys(req.body).forEach(key => {
      if (key.startsWith('userData.')) {
        const fieldName = key.replace('userData.', '');
        userPayload[fieldName] = req.body[key];
      } else if (key.startsWith('hospitalData.')) {
        const fieldName = key.replace('hospitalData.', '');
        hospitalPayload[fieldName] = req.body[key];
      }
    });

    // 4) update user basics if user data is provided
    let updatedUser = null;
    if (Object.keys(userPayload).length > 0) {
      if (profileImageKey) userPayload.profile_image = profileImageKey;
      updatedUser = await userService.updateUserBasics(
        userId,
        userPayload,
        session
      );
    }

    // 5) update hospital data if provided
    let updatedHospital = null;
    if (Object.keys(hospitalPayload).length > 0) {
      updatedHospital = await hospitalService.updateHospital(
        req.params.id,
        hospitalPayload,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();


    // // 3) update user basics if user data is provided
    // let updatedUser = null;
    // if (req.body.userData) {
    //   const userPayload = JSON.parse(req.body.userData);
    //   if (profileImageKey) userPayload.profile_image = profileImageKey;

    //   updatedUser = await userService.updateUserBasics(
    //     userId,
    //     userPayload,
    //     session
    //   );
    // }

    // let updatedHospital = null;
    // if (req.body.hospitalData) {
    //   const hospitalPayload = JSON.parse(req.body.hospitalData);
    //   updatedHospital = await hospitalService.updateHospital(
    //     req.params.id,
    //     hospitalPayload,
    //     session
    //   );
    // }


    // await session.commitTransaction();
    // session.endSession();

    return res.success(
      "Hospital updated successfully.",
      { user: updatedUser, hospital: updatedHospital },
      StatusCodes.OK
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message || "Failed to update hospital"
      });
  }
};


export const updateHospitalStatus = async (req, res) => {
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

    const { hospital } = await hospitalService.getHospitalById(req.params.id);
    const userId = hospital.hospitalUserId?._id || hospital.hospitalUserId;

    const user = await userService.updateUserStatus(
      userId,
      isActive,
      session,
      req.user._id
    );

    await session.commitTransaction();
    session.endSession();

    const message = isActive
      ? "Hospital user activated successfully."
      : "Hospital user deactivated successfully.";

    return res.success(message, { user });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};