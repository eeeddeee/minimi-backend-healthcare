import * as dashboardService from "../services/dashboardService.js";
import { StatusCodes } from "http-status-codes";

const errorResponse = (res, error, defaultMessage) => {
  const statusCode = error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  const message = error.message || defaultMessage;

  return res.status(statusCode).json({
    success: false,
    message,
    statusCode,
  });
};

export const getUserDashboard = async (req, res) => {
  try {
    // User info from token (via authenticate middleware)
    const dashboardData = await dashboardService.getUserDashboard(req.user);

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Dashboard data fetched successfully",
      data: dashboardData,
    });
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch dashboard data");
  }
};

export const getPatientDailyTracking = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { date } = req.query;

    if (!patientId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Patient ID is required",
      });
    }

    const trackingData = await dashboardService.getPatientDailyTracking(
      req.user,
      patientId,
      date
    );

    return res.status(StatusCodes.OK).json({
      success: true,
      message: "Daily tracking data fetched successfully",
      data: trackingData,
    });
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch daily tracking data");
  }
};
