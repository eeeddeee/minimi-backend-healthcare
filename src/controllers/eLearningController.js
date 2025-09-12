// controllers/eLearningController.js
import { StatusCodes } from "http-status-codes";
import * as eLearningService from "../services/eLearningService.js";

const errorResponse = (res, error, fallback) =>
  res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || fallback
  });

// POST /e-learning/resources
export const createResource = async (req, res) => {
  try {
    const resource = await eLearningService.createResource(
      req.body,
      req.user._id
    );
    return res.success(
      "Training resource created successfully.",
      { resource },
      StatusCodes.CREATED
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to create resource");
  }
};

// GET /e-learning/resources
export const getResources = async (req, res) => {
  try {
    const result = await eLearningService.getResources(
      req.query,
      parseInt(req.query.page),
      parseInt(req.query.limit)
    );
    return res.success(
      "Training resources fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch resources");
  }
};

// GET /e-learning/resources/:id
export const getResource = async (req, res) => {
  try {
    const data = await eLearningService.getResourceById(req.params.id);
    return res.success(
      "Training resource fetched successfully.",
      data,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch resource");
  }
};

// PATCH /e-learning/resources/:id
export const updateResource = async (req, res) => {
  try {
    const updated = await eLearningService.updateResource(
      req.params.id,
      req.body,
      req.user._id
    );
    return res.success(
      "Training resource updated successfully.",
      { resource: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update resource");
  }
};

// PATCH /e-learning/resources/:id/active
export const setActive = async (req, res) => {
  try {
    const updated = await eLearningService.setActive(
      req.params.id,
      req.body.isActive,
      req.user._id
    );
    return res.success(
      "Training resource activation updated.",
      { resource: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update activation");
  }
};

// POST /e-learning/resources/:id/view
export const markView = async (req, res) => {
  try {
    const updated = await eLearningService.markViewOrProgress(
      req.params.id,
      req.user._id,
      req.body.completionPercentage || 0
    );
    return res.success(
      "Progress saved.",
      { resource: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to save progress");
  }
};

// PATCH /e-learning/resources/:id/progress
export const updateProgress = async (req, res) => {
  try {
    const updated = await eLearningService.markViewOrProgress(
      req.params.id,
      req.user._id,
      req.body.completionPercentage
    );
    return res.success(
      "Progress updated.",
      { resource: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update progress");
  }
};

// POST /e-learning/resources/:id/feedback
export const submitFeedback = async (req, res) => {
  try {
    const fb = await eLearningService.submitFeedback(
      req.params.id,
      req.user._id,
      req.body.rating,
      req.body.comment
    );
    return res.success(
      "Feedback submitted.",
      { feedback: fb },
      StatusCodes.CREATED
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to submit feedback");
  }
};

export const listFeedback = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 100);

    const result = await eLearningService.getFeedbackForResource({
      resourceId: req.params.id,
      page,
      limit,
      user: req.user
    });

    return res.success("Feedback fetched.", result, StatusCodes.OK);
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch feedback");
  }
};
