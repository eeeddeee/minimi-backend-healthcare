import * as patientService from "../services/patientService.js";
import { StatusCodes } from "http-status-codes";
import { uploadBufferToS3 } from "../utils/s3Service.js";
import * as userService from "../services/userService.js";
import Nurse from "../models/nurseModel.js";
import Hospital from "../models/hospitalModel.js";
import mongoose from "mongoose";


export const getPatients = async (req, res) => {
  try {
    const { page = 1, limit = 10, isActive, search } = req.query;

    const hospitalId = req.user?._id;
    console.log(hospitalId,"Hospital ID")

    const filters = {};
    if (isActive !== undefined) {
      filters.isActive = isActive;
    }
    if (search) {
      filters.search = search;
    }

    const result = await patientService.getPatients(
      filters,
      parseInt(page),
      parseInt(limit),
      hospitalId
    );

    return res.success(
      "Patients fetched successfully.",
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

export const getNursePatients = async (req, res) => {
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

    const result = await patientService.getPatientsForNurse(
      filters,
      parseInt(page),
      parseInt(limit),
      [nurseUserId, nurseDocId].filter(Boolean)
    );

    return res.success(
      "Patients fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};


// export const getNursePatients = async (req, res) => {
//   try {
//     const { page = 1, limit = 10, isActive, search } = req.query;

//     const nurseUserId = req.user?._id;
//     let nurseDocId = null;
//     if (mongoose.Types.ObjectId.isValid(nurseUserId)) {
//       const nurseDoc = await Nurse.findOne(
//         { nurseUserId: new mongoose.Types.ObjectId(nurseUserId) },
//         { _id: 1 }
//       ).lean();
//       nurseDocId = nurseDoc?._id || null;
//     }

//     const filters = {};
//     if (isActive !== undefined) filters.isActive = isActive;
//     if (search) filters.search = search;

//     const result = await patientService.getPatientsForNurse(
//       filters,
//       parseInt(page),
//       parseInt(limit),
//       [nurseUserId, nurseDocId].filter(Boolean)
//     );

//     return res.success(
//       "Patients fetched successfully.",
//       result,
//       StatusCodes.OK
//     );
//   } catch (error) {
//     return res
//       .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
//       .json({ success: false, message: error.message });
//   }
// };

export const getPatient = async (req, res) => {
  try {
    const patient = await patientService.getPatientById(req.params.id);

    return res.success(
      "Patient fetched successfully.",
      patient,
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

export const updatePatient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { patient } = await patientService.getPatientById(req.params.id);
    const userId = patient.patientUserId?._id || patient.patientUserId;

    if (!userId) {
      throw {
        statusCode: StatusCodes.NOT_FOUND,
        message: "Associated user not found for this patient"
      };
    }

    // Handle profile image upload
    let profileImageKey;
    if (req.file?.buffer) {
      const { key } = await uploadBufferToS3({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        keyPrefix: "profiles/patient"
      });
      profileImageKey = key;
    }

    // Parse form data fields
    const userPayload = {};
    const patientPayload = {};

    // Extract user data from form fields starting with 'userData.'
    Object.keys(req.body).forEach((key) => {
      if (key.startsWith("userData.")) {
        const fieldName = key.replace("userData.", "");
        userPayload[fieldName] = req.body[key];
      } else if (key.startsWith("patientData.")) {
        const fieldName = key.replace("patientData.", "");
        patientPayload[fieldName] = req.body[key];
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

    // Update patient data if provided
    let updatedPatient = null;
    if (Object.keys(patientPayload).length > 0) {
      updatedPatient = await patientService.updatePatient(
        req.params.id,
        patientPayload,
        session
      );
    }

    await session.commitTransaction();
    session.endSession();

    return res.success("Patient updated successfully.", {
      user: updatedUser,
      patient: updatedPatient
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res
      .status(error.statusCode || 500)
      .json({
        success: false,
        message: error.message || "Failed to update patient"
      });
  }
};


export const updatePatientStatus = async (req, res) => {
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

    const { patient } = await patientService.getPatientById(req.params.id);
    const userId = patient.patientUserId?._id || patient.patientUserId;

    const user = await userService.updateUserStatus(
      userId,
      isActive,
      session,
      req.user._id
    );

    await session.commitTransaction();
    session.endSession();

    const message = isActive
      ? "Patient user activated successfully."
      : "Patient user deactivated successfully.";

    return res.success(message, { user });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};