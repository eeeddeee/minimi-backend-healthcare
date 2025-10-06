import { StatusCodes } from "http-status-codes";
import * as authService from "../services/authService.js";

// export const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;
//     const ipAddress = req.ip;
//     const userAgent = req.headers["user-agent"];

//     const { token, user } = await authService.loginUser(
//       email,
//       password,
//       ipAddress,
//       userAgent
//     );

//     return res.success(
//       "User login successful.",
//       {
//         id: user._id,
//         email: user.email,
//         role: user.role,
//         languagePreference: user.languagePreference,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         profile_image: user.profile_image,
//         phone: user.phone,
//         role: user.role,
//         street: user.street,
//         city: user.city,
//         state: user.state,
//         postalCode: user.postalCode,
//         country: user.country,
//         dateOfBirth: user.dateOfBirth,
//         gender: user.gender,
//         isPayment: user.isPayment,
//         subscription: user.subscription,
//         token
//       },
//       StatusCodes.OK
//     );
//   } catch (err) {
//     return res
//       .status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
//       .json({
//         success: false,
//         message: err.message || "Authentication failed"
//       });
//   }
// };

const WEB_ROLES = ["super_admin", "nurse", "hospital"];
const MOBILE_ROLES = ["caregiver", "family", "patient"];

export const webLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];

    const { token, user } = await authService.loginUser(
      email,
      password,
      ipAddress,
      userAgent
    );
    if (!WEB_ROLES.includes(user.role)) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "This account is not allowed to access web login.",
      });
    }

    return res.success(
      "Web user login successful.",
      {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        languagePreference: user.languagePreference,
        profile_image: user.profile_image,
        phone: user.phone,
        address: {
          street: user.street,
          city: user.city,
          state: user.state,
          postalCode: user.postalCode,
          country: user.country,
        },
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        isPayment: user.isPayment,
        subscription: user.subscription,
        token,
      },
      StatusCodes.OK
    );
  } catch (err) {
    return res
      .status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: err.message || "Authentication failed",
      });
  }
};

export const mobileLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.headers["user-agent"];

    const { token, user } = await authService.loginUser(
      email,
      password,
      ipAddress,
      userAgent
    );

    if (!MOBILE_ROLES.includes(user.role)) {
      return res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: "This account is not allowed to access mobile login.",
      });
    }

    return res.success(
      "Mobile user login successful.",
      {
        id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        languagePreference: user.languagePreference,
        profile_image: user.profile_image,
        phone: user.phone,
        address: {
          street: user.street,
          city: user.city,
          state: user.state,
          postalCode: user.postalCode,
          country: user.country,
        },
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        isPayment: user.isPayment,
        subscription: user.subscription,
        token,
      },
      StatusCodes.OK
    );
  } catch (err) {
    return res
      .status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: err.message || "Authentication failed",
      });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    await authService.forgotPassword(email);

    return res.success(
      "User login successful.",
      {
        success: true,
        message: "Password reset link sent if email exists",
      },
      StatusCodes.OK
    );
  } catch (err) {
    return res
      .status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: err.message || "Password reset failed",
      });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    await authService.resetPassword(token, newPassword);

    return res.success(
      "User login successful.",
      {
        success: true,
        message: "Password reset successful",
      },
      StatusCodes.OK
    );
  } catch (err) {
    return res
      .status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: err.message || "Password reset failed",
      });
  }
};

export const changePassword = async (req, res) => {
  try {
    const result = await authService.changePassword(
      req.user.id,
      req.body.currentPassword,
      req.body.newPassword
    );

    return res.success(
      {
        success: true,
        message: result.message,
        token: result.token,
      },
      StatusCodes.OK
    );
  } catch (err) {
    res.status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: err.message || "Password change failed",
    });
  }
};

export const logout = async (req, res) => {
  try {
    const userId = req.user.id;
    await authService.logoutUser(userId);

    return res.success(
      "User login successful.",
      {
        success: true,
        message: "Logged out successfully",
      },
      StatusCodes.OK
    );
  } catch (err) {
    return res
      .status(err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR)
      .json({
        success: false,
        message: err.message || "Logout failed",
      });
  }
};
