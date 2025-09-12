// controllers/patientStatusHistoryController.js
import { StatusCodes } from "http-status-codes";
import * as patientStatusHistoryService from "../services/patientStatusHistoryService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";

const errorResponse = (res, error, fallback) =>
  res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || fallback
  });

// GET /patients/:id/status-history
export const getPatientStatusHistory = async (req, res) => {
  try {
    const patientId = req.params.id;
    await ensureAccessToPatient(req.user, patientId);

    const { from, to, page = 1, limit = 10 } = req.query;
    const result = await patientStatusHistoryService.getHistoryByPatient(
      patientId,
      {
        from,
        to,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    );

    return res.success(
      "Patient status history fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch patient status history");
  }
};
