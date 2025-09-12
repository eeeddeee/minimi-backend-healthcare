import { StatusCodes } from "http-status-codes";
import * as aiService from "../services/aiPredictionService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";

const errorResponse = (res, error, fallback) =>
  res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || fallback
  });

export const createPrediction = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.body.patientId);
    const prediction = await aiService.createPrediction(req.body, req.user._id);
    return res.success(
      "AI prediction saved.",
      { prediction },
      StatusCodes.CREATED
    );
  } catch (e) {
    return errorResponse(res, e, "Failed to save AI prediction");
  }
};

export const getPredictions = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.query.patientId);
    const result = await aiService.getPredictions(
      req.query,
      parseInt(req.query.page),
      parseInt(req.query.limit)
    );
    return res.success("AI predictions fetched.", result, StatusCodes.OK);
  } catch (e) {
    return errorResponse(res, e, "Failed to fetch AI predictions");
  }
};

export const getPrediction = async (req, res) => {
  try {
    const { prediction } = await aiService.getPredictionById(req.params.id);
    await ensureAccessToPatient(req.user, prediction.patientId);
    return res.success(
      "AI prediction fetched.",
      { prediction },
      StatusCodes.OK
    );
  } catch (e) {
    return errorResponse(res, e, "Failed to fetch AI prediction");
  }
};

export const updatePrediction = async (req, res) => {
  try {
    const { prediction } = await aiService.getPredictionById(req.params.id);
    await ensureAccessToPatient(req.user, prediction.patientId);
    const updated = await aiService.updatePrediction(
      req.params.id,
      req.body,
      req.user._id
    );
    return res.success(
      "AI prediction updated.",
      { prediction: updated },
      StatusCodes.OK
    );
  } catch (e) {
    return errorResponse(res, e, "Failed to update AI prediction");
  }
};

export const markNotified = async (req, res) => {
  try {
    const { prediction } = await aiService.getPredictionById(req.params.id);
    await ensureAccessToPatient(req.user, prediction.patientId);
    const updated = await aiService.markNotified(req.params.id, req.user._id);
    return res.success(
      "AI prediction marked notified.",
      { prediction: updated },
      StatusCodes.OK
    );
  } catch (e) {
    return errorResponse(res, e, "Failed to mark notified");
  }
};

export const getLatest = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.params.patientId);
    const data = await aiService.getLatestForPatient(req.params.patientId);
    return res.success("Latest AI prediction fetched.", data, StatusCodes.OK);
  } catch (e) {
    return errorResponse(res, e, "Failed to fetch latest prediction");
  }
};
