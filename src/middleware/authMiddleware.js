import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import SystemLog from "../models/systemLogModel.js";
import { StatusCodes } from "http-status-codes";

export const authenticate = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Not authorized to access this route",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findOne({
      _id: decoded.id,
      securityId: decoded.securityId,
    });

    if (!user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "User no longer exists",
      });
    }

    if (user.accessToken && user.accessToken !== token) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        success: false,
        message: "Session expired",
      });
    }

    if (user.role !== "super_admin") {
      let hospitalId = null;

      if (user.role === "hospital") {
        hospitalId = user._id;
      } else {
        hospitalId = user.createdBy;
      }

      if (hospitalId) {
        const hospital = await User.findById(hospitalId).select("isPayment role");
        if (!hospital || hospital.role !== "hospital" || hospital.isPayment !== true) {
          return res.status(StatusCodes.FORBIDDEN).json({
            success: false,
            message: "Hospital subscription inactive. Access denied.",
          });
        }
      }
    }

    await SystemLog.create({
      action: "api_access",
      entityType: "User",
      entityId: user._id,
      metadata: {
        path: req.path,
        method: req.method,
      },
    });

    req.user = user;
    next();
  } catch (err) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Not authorized to access this route",
    });
  }
};

export const authorize = (allowedRoles) => {
  return (req, res, next) => {
    console.log("User role:", req.user.role); // Log the role
    const userRole = req.user.role;

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Role (${userRole}) is not allowed`
      });
    }

    next();
  };
};


// export const authenticate = async (req, res, next) => {
//   try {
//     let token;

//     // Check Authorization header
//     if (req.headers.authorization?.startsWith("Bearer")) {
//       token = req.headers.authorization.split(" ")[1];
//     }

//     if (!token) {
//       return res.status(StatusCodes.UNAUTHORIZED).json({
//         success: false,
//         message: "Not authorized to access this route"
//       });
//     }

//     // Verify token
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);

//     // Check if user still exists
//     const user = await User.findOne({
//       _id: decoded.id,
//       securityId: decoded.securityId // HIPAA verification
//     });

//     if (!user) {
//       return res.status(StatusCodes.UNAUTHORIZED).json({
//         success: false,
//         message: "User no longer exists"
//       });
//     }

//     // // Check if token was invalidated
//     // if (user.accessToken !== token) {
//     //   return res.status(StatusCodes.UNAUTHORIZED).json({
//     //     success: false,
//     //     message: "Session expired"
//     //   });
//     // }

//     // Change this check in authenticate middleware:
//     if (user.accessToken && user.accessToken !== token) {
//       return res.status(StatusCodes.UNAUTHORIZED).json({
//         success: false,
//         message: "Session expired"
//       });
//     }

//     // HIPAA access log
//     await SystemLog.create({
//       action: "api_access",
//       entityType: "User",
//       entityId: user._id,
//       metadata: {
//         path: req.path,
//         method: req.method
//       }
//     });

//     req.user = user;
//     next();
//   } catch (err) {
//     return res.status(StatusCodes.UNAUTHORIZED).json({
//       success: false,
//       message: "Not authorized to access this route"
//     });
//   }
// };

// export const authorize = (...roles) => {
//   return (req, res, next) => {
//     if (!roles.includes(req.user.role)) {
//       return res.status(StatusCodes.FORBIDDEN).json({
//         success: false,
//         message: `Role (${req.user.role}) is not allowed`
//       });
//     }
//     next();
//   };
// };


// import jwt from "jsonwebtoken";
// import { StatusCodes } from "http-status-codes";

// export function authenticateUser(req, res, next) {
//   const authHeader = req.header("Authorization");
//   const token = authHeader?.replace("Bearer ", "");

//   if (!token) {
//     return res.error(
//       "Access token is missing or invalid.",
//       StatusCodes.UNAUTHORIZED
//     );
//   }

//   try {
//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     req.user = decoded;
//     next();
//   } catch (error) {
//     return res.error("Invalid or expired token.", StatusCodes.UNAUTHORIZED);
//   }
// }

// export function authorizeRoles(allowedRoles = []) {
//   return (req, res, next) => {
//     if (!allowedRoles.includes(req.user.role)) {
//       return res.error("Access forbidden.", StatusCodes.FORBIDDEN);
//     }
//     next();
//   };
// }
