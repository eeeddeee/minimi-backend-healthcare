import { StatusCodes } from "http-status-codes";
import * as userService from "../services/userService.js";
import * as hospitalService from "../services/hospitalService.js";
import * as nurseService from "../services/nurseService.js";
import * as caregiverService from "../services/caregiverService.js";
import * as patientService from "../services/patientService.js";
import * as familyService from "../services/familyService.js";
import Patient from "../models/patientModel.js";
import { uploadBufferToS3 } from "../utils/s3Service.js";
import { sendEmail } from "../utils/emailService.js";
import SystemLog from "../models/systemLogModel.js";
import {
  hospitalAdminTemplate,
  nurseTemplate,
  caregiverTemplate,
  familyMemberTemplate,
  patientTemplate,
} from "../utils/emailTemplates.js";
import mongoose from "mongoose";

const errorResponse = (res, error) => {
  return res
    .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
    .json({
      success: false,
      message: error.message || "Something went wrong",
    });
};

// Hospital Admin Registration

export const registerHospitalAdmin = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Create user in transaction
    const { user, randomPassword } = await userService.createHospitalAdmin(
      req.body,
      req.user._id,
      session
    );

    const hospitalData = {
      ...req.body.hospitalData,
      hospitalUserId: user.id || user._id,
    };

    // console.log("User returned:", user);
    // console.log("Hospital data:", hospitalData);

    // 2. Create hospital in transaction
    const hospital = await hospitalService.createHospital(
      hospitalData,
      req.user.id,
      session
    );

    await session.commitTransaction();
    session.endSession();

    const loginUrl = process.env.LOGIN_URL;
    const template = hospitalAdminTemplate;
    await sendEmail({
      to: user.email,
      subject: `Your Hospital Admin Account Credentials`,
      html: template(user.email, randomPassword, loginUrl),
    });

    return res.success(
      "Hospital admin registered successfully.",
      { user, hospital },
      StatusCodes.CREATED
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return errorResponse(res, error);
  }
};

// Nurse Registration
export const registerNurse = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { user, randomPassword } = await userService.createNurse(
      req.body,
      req.user._id,
      session
    );

    const nurseData = {
      ...req.body.nurseData,
      nurseUserId: user.id || user._id,
      hospitalId: req.user.id,
    };

    console.log("User returned:", user);
    console.log("Nurse data:", nurseData);

    const nurse = await nurseService.createNurse(
      nurseData,
      req.user.id,
      session
    );

    await session.commitTransaction();
    session.endSession();

    const loginUrl = process.env.LOGIN_URL;
    const template = nurseTemplate;
    await sendEmail({
      to: user.email,
      subject: `Your Nurse Account Credentials`,
      html: template(user.email, randomPassword, loginUrl),
    });

    return res.success(
      "Nurse registered successfully.",
      { user, nurse },
      StatusCodes.CREATED
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return errorResponse(res, error);
  }
};

export const registerCaregiver = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // 1. Create caregiver user account
    const { user, randomPassword } = await userService.createCaregiver(
      req.body,
      req.user._id,
      session
    );

    // 2. Prepare caregiver-specific data
    const caregiverData = {
      ...req.body.caregiverData,
      caregiverUserId: user.id || user._id,
      hospitalId: req.user.id,
    };

    // 3. Create caregiver profile
    const caregiver = await caregiverService.createCaregiver(
      caregiverData,
      req.user.id,
      session
    );

    await session.commitTransaction();
    session.endSession();

    const loginUrl = process.env.LOGIN_URL;
    const template = caregiverTemplate;
    await sendEmail({
      to: user.email,
      subject: `Your Caregiver Account Credentials`,
      html: template(user.email, randomPassword, loginUrl),
    });

    return res.success(
      "Caregiver registered successfully.",
      { user, caregiver },
      StatusCodes.CREATED
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return errorResponse(res, error);
  }
};

// Patient Registration
export const registerPatient = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { user, randomPassword } = await userService.createPatient(
      {
        ...req.body,
        hospitalId: req.user.hospitalId || req.user.id,
      },
      req.user._id,
      session
    );
    // console.log("REGISTER PATIENT BODY: ", req.body);
    const patient = await patientService.createPatient(
      {
        patientUserId: user.id,
        hospitalId: req.user.hospitalId || req.user.id,
        bloodGroup: req.body.bloodGroup,
        medicalConditions: req.body.medicalConditions,
        allergies: req.body.allergies,
        height: req.body.height,
        weight: req.body.weight,
        emergencyContacts: req.body.emergencyContacts,
        insurance: req.body.insurance,
      },
      req.user._id,
      session
    );

    await session.commitTransaction();
    session.endSession();

    const loginUrl = process.env.LOGIN_URL;
    const template = patientTemplate;
    await sendEmail({
      to: user.email,
      subject: `Your Patient Account Credentials`,
      html: template(user.email, randomPassword, loginUrl),
    });

    return res.success(
      "Patient registered successfully.",
      { user, patient },
      StatusCodes.CREATED
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return errorResponse(res, error);
  }
};

export const registerFamilyMember = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1. Fetch the patient using patientNumber
    const patient = await Patient.findOne({
      patientId: req.body.patientUserId,
    }).session(session);

    if (!patient) {
      throw {
        statusCode: StatusCodes.NOT_FOUND,
        message: "Patient not found with the provided patient number",
      };
    }

    // 2. Verify patient belongs to the same hospital0
    if (
      String(patient.hospitalId) !== String(req.user.hospitalId || req.user._id)
    ) {
      throw {
        statusCode: StatusCodes.FORBIDDEN,
        message: "Patient does not belong to your hospital",
      };
    }

    // 3. Create family member (same logic as before)
    const { user, randomPassword } = await userService.createFamilyMember(
      {
        ...req.body,
        hospitalId: req.user.hospitalId || req.user._id,
      },
      req.user._id,
      session
    );

    // 4. Create family member profile
    const familyMember = await familyService.createFamilyMember(
      {
        familyMemberUserId: user._id,
        patientId: patient._id, // Use the patientId fetched above
        relationship: req.body.relationship,
        canMakeAppointments: req.body.canMakeAppointments || false,
        canAccessMedicalRecords: req.body.canAccessMedicalRecords || false,
      },
      req.user._id,
      session
    );

    // 5. Add family member to patient
    await patientService.addFamilyMember(
      patient._id, // Use the patientId directly here
      user._id,
      req.user._id,
      session
    );

    await session.commitTransaction();

    // Send email
    const loginUrl = process.env.LOGIN_URL;
    await sendEmail({
      to: user.email,
      subject: `Your Family Member Account Credentials`,
      html: familyMemberTemplate(user.email, randomPassword, loginUrl),
    });

    return res.success(
      "Family member registered successfully.",
      { user, familyMember },
      StatusCodes.CREATED
    );
  } catch (error) {
    await session.abortTransaction();
    return errorResponse(res, error);
  } finally {
    session.endSession();
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.user;
    const updateData = req.body;
    const file = req.file;

    // Update user profile
    const user = await updateUserProfile(id, updateData, file);

    // Update role-specific profile if data exists
    let roleProfile = null;
    if (updateData.roleData) {
      roleProfile = await updateRoleSpecificProfile(
        role,
        id,
        updateData.roleData,
        id
      );
    }

    // Log the update
    await SystemLog.create({
      action: "profile_updated",
      entityType: "User",
      entityId: id,
      performedBy: req.user._id,
      metadata: {
        updatedFields: Object.keys(updateData),
      },
    });

    return res.success(
      "Profile updated successfully",
      { user, roleProfile },
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message || "Failed to update profile",
      });
  }
};

export const deactivateUser = async (req, res) => {
  try {
    const deactivatedUser = await userService.deactivateUser(req.params.id);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "User has been deactivated successfully.",
      data: deactivatedUser,
    });
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message:
        error.message || "Something went wrong while deactivating the user.",
    });
  }
};

export const updateUserProfile = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const userId = req.user.id;

    // Handle profile image upload
    let profileImageKey;
    if (req.file?.buffer) {
      const { key } = await uploadBufferToS3({
        buffer: req.file.buffer,
        mimeType: req.file.mimetype,
        keyPrefix: "profiles/users",
      });
      profileImageKey = key;
    }

    // Parse form data fields
    const userPayload = {};

    // Extract data from form fields
    Object.keys(req.body).forEach((key) => {
      userPayload[key] = req.body[key];
    });

    // Add profile image if uploaded
    if (profileImageKey) {
      userPayload.profile_image = profileImageKey;
    }

    // Use the existing userService to update user basics
    const updatedUser = await userService.updateUserBasics(
      userId,
      userPayload,
      session
    );

    // Create system log
    await SystemLog.create(
      [
        {
          action: "profile_updated",
          entityType: "User",
          entityId: userId,
          performedBy: userId,
          metadata: { fields: Object.keys(userPayload) },
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.success(
      "Profile updated successfully.",
      { user: updatedUser },
      StatusCodes.OK
    );
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message || "Failed to update profile",
      });
  }
};

export const getUserStatsByRole = async (req, res) => {
  try {
    const { role, hospitalId: hospitalIdFromQuery } = req.query;

    const hospitalId =
      req.user?.role === "hospital"
        ? req.user._id
        : hospitalIdFromQuery || undefined;

    const result = await userService.getUserStatsByRole(role, hospitalId);

    return res.success(
      "User stats fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

// export const getUserStatsByRole = async (req, res) => {
//   try {
//     const { role } = req.query;

//     const result = await userService.getUserStatsByRole(role);

//     return res.success(
//       "User stats fetched successfully.",
//       result,
//       StatusCodes.OK
//     );
//   } catch (error) {
//     return res
//       .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
//       .json({
//         success: false,
//         message: error.message
//       });
//   }
// };

export const getUserStatsForAdmin = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await userService.getUserStatsForAdmin(startDate, endDate);

    return res.success(
      "User stats fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message,
      });
  }
};

export const getHospitalStatsByDate = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const result = await userService.getHospitalStatsByDate(startDate, endDate);

    return res.success(
      "Hospital stats fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message,
      });
  }
};

export const getNurseStats = async (req, res) => {
  try {
    const nurseId = req.user.id;
    const { startDate, endDate } = req.query;

    const result = await userService.getNurseStats(nurseId, startDate, endDate);

    return res.success(
      "Nurse stats fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message,
      });
  }
};

export const getHospitalStats = async (req, res) => {
  try {
    const hospitalId = req.user.id;
    console.log("Hospital ID from req.user:", hospitalId);

    const { startDate, endDate } = req.query;

    const result = await userService.getHospitalStats(
      hospitalId,
      startDate,
      endDate
    );

    return res.success(
      "Hospital stats fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: error.message,
      });
  }
};

const extractFilters = (req) => {
  const { page = 1, limit = 10, search, isActive, hospitalId } = req.query;
  // console.log("Hospital ID from query:", hospitalId);
  const filters = { search, isActive };
  return {
    filters,
    page: parseInt(page),
    limit: parseInt(limit),
    hospitalId,
  };
};

export const getNurses = async (req, res) => {
  try {
    const { filters, page, limit, hospitalId } = extractFilters(req);
    const result = await userService.getNurses(
      filters,
      page,
      limit,
      hospitalId
    );
    // console.log(result,"Zainnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnnn");
    return res.success("Nurses fetched successfully.", result, StatusCodes.OK);
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

export const getCaregivers = async (req, res) => {
  try {
    const { filters, page, limit, hospitalId } = extractFilters(req);
    const result = await userService.getCaregivers(
      filters,
      page,
      limit,
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
      .json({ success: false, message: error.message });
  }
};

export const getFamilies = async (req, res) => {
  try {
    const { filters, page, limit, hospitalId } = extractFilters(req);
    const result = await userService.getFamilies(
      filters,
      page,
      limit,
      hospitalId
    );
    return res.success(
      "Families fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: error.message });
  }
};

export const getPatients = async (req, res) => {
  try {
    const { filters, page, limit, hospitalId } = extractFilters(req);
    const result = await userService.getPatients(
      filters,
      page,
      limit,
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
      .json({ success: false, message: error.message });
  }
};
