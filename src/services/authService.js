import User from "../models/userModel.js";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { StatusCodes } from "http-status-codes";
import SystemLog from "../models/systemLogModel.js";
import { sendEmail } from "../utils/emailService.js";
import { resetPasswordTemplate } from "../utils/emailTemplates.js";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = process.env.JWT_EXPIRY || "1d";

export const loginUser = async (email, password, ipAddress, userAgent) => {
  // Fetch the user with the required fields
  const user = await User.findOne({ email }).select("+passwordHash +isActive");

  // Check if the user exists
  if (!user) {
    console.log("User not found:", email);
    throw {
      message: "Invalid credentials",
      statusCode: StatusCodes.UNAUTHORIZED,
    };
  }

  // If the user's account is disabled, deny access
  if (!user.isActive) {
    console.log("User is disabled:", email);
    throw {
      message: "Account disabled",
      statusCode: StatusCodes.FORBIDDEN,
    };
  }

  // Validate the password by comparing the hashed password
  const isMatch = await bcrypt.compare(password.trim(), user.passwordHash);
  console.log("Password match:", isMatch); // Log whether the password matches

  if (!isMatch) {
    // If password doesn't match, throw invalid credentials
    console.log("Invalid password for user:", email);
    throw {
      message: "Invalid credentials",
      statusCode: StatusCodes.UNAUTHORIZED,
    };
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user._id, role: user.role, securityId: user.securityId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  // Log the user login activity
  await SystemLog.create({
    action: "user_login",
    entityType: "User",
    entityId: user._id,
    metadata: {
      ip: ipAddress,
      device: userAgent,
    },
  });

  // Update last login and token for the user
  user.accessToken = token;
  user.lastLogin = new Date();
  await user.save();

  // Return token and user data
  return {
    token,
    user,
    // {
    //   id: user._id,
    //   email: user.email,
    //   role: user.role,
    //   languagePreference: user.languagePreference
    // }
  };
};

export const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error("User not found.");
    error.statusCode = StatusCodes.NOT_FOUND;
    throw error;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpiry = Date.now() + 15 * 60 * 1000;

  user.reset_password_token = resetToken;
  user.reset_password_expiry = resetTokenExpiry;
  await user.save();

  const resetUrl = `https://minimi-healthcare.onrender.com/reset-password?token=${resetToken}`;

  const html = resetPasswordTemplate(resetUrl);

  try {
    await sendEmail({
      to: email,
      subject: "Password Reset Link",
      html,
    });
  } catch (mailError) {
    user.reset_password_token = null;
    user.reset_password_expiry = null;
    await user.save();

    const error = new Error("Failed to send reset email.");
    error.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    throw error;
  }

  return {
    email: user.email,
    resetLinkSent: true,
    expiresAt: new Date(resetTokenExpiry),
  };
};

export const resetPassword = async (token, newPassword) => {
  const user = await User.findOne({
    reset_password_token: token,
    reset_password_expiry: { $gt: Date.now() },
  }).select("+passwordHash");
  if (!user) {
    throw {
      message: "Invalid or expired token",
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  if (newPassword.length < 8) {
    throw {
      message: "Password must be at least 8 characters",
      statusCode: StatusCodes.BAD_REQUEST,
    };
  }

  user.passwordHash = newPassword;
  user.reset_password_token = undefined;
  user.reset_password_expiry = undefined;
  user.accessToken = undefined;
  user.isPasswordChanged = true;
  await user.save();

  // HIPAA audit log
  await SystemLog.create({
    action: "password_reset",
    entityType: "User",
    entityId: user._id,
  });

  return user;
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId).select("+passwordHash");

  if (!user)
    throw { message: "User not found", statusCode: StatusCodes.NOT_FOUND };
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw {
      message: "Current password is incorrect",
      statusCode: StatusCodes.UNAUTHORIZED,
    };
  }

  // Update password
  user.passwordHash = newPassword;
  user.isPasswordChanged = true;

  // Generate new token
  const newToken = jwt.sign(
    { id: user._id, role: user.role, securityId: user.securityId },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );

  // Update access token
  user.accessToken = newToken;
  await user.save();

  await SystemLog.create({
    action: "password_changed",
    entityType: "User",
    entityId: user._id,
  });

  return {
    success: true,
    message: "Password changed successfully",
    token: newToken,
  };
};

export const logoutUser = async (userId) => {
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        accessToken: null,
        refreshToken: null,
        updatedAt: Date.now(),
      },
    },
    { new: true }
  );

  if (!user) {
    throw {
      message: "User not found",
      statusCode: StatusCodes.NOT_FOUND,
    };
  }

  // HIPAA audit log
  await SystemLog.create({
    action: "user_logout",
    entityType: "User",
    entityId: user._id,
  });

  return { success: true, message: "Logged out successfully" };
};
