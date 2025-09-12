import { StatusCodes } from "http-status-codes";
import * as activityService from "../services/activityService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";

const errorResponse = (res, error, fallback) =>
  res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || fallback
  });

export const createActivity = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.body.patientId);
    const activity = await activityService.createActivity(
      req.body,
      req.user._id
    );
    return res.success(
      "Activity created successfully.",
      { activity },
      StatusCodes.CREATED
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to create activity");
  }
};

export const getActivities = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.query.patientId);
    const result = await activityService.getActivities(
      req.query,
      parseInt(req.query.page),
      parseInt(req.query.limit)
    );
    return res.success(
      "Activities fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch activities");
  }
};

export const getActivity = async (req, res) => {
  try {
    const { activity } = await activityService.getActivityById(req.params.id);
    await ensureAccessToPatient(req.user, activity.patientId);
    return res.success(
      "Activity fetched successfully.",
      { activity },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch activity");
  }
};

export const updateActivity = async (req, res) => {
  try {
    const { activity } = await activityService.getActivityById(req.params.id);
    await ensureAccessToPatient(req.user, activity.patientId);
    const updated = await activityService.updateActivity(
      req.params.id,
      req.body
    );
    return res.success(
      "Activity updated successfully.",
      { activity: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update activity");
  }
};

export const updateActivityStatus = async (req, res) => {
  try {
    const { activity } = await activityService.getActivityById(req.params.id);
    await ensureAccessToPatient(req.user, activity.patientId);
    const updated = await activityService.updateActivityStatus(
      req.params.id,
      req.body.status
    );
    return res.success(
      "Activity status updated successfully.",
      { activity: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update activity status");
  }
};

export const updateActivityOutcome = async (req, res) => {
  try {
    const { activity } = await activityService.getActivityById(req.params.id);
    await ensureAccessToPatient(req.user, activity.patientId);
    const updated = await activityService.updateActivityOutcome(
      req.params.id,
      req.body.outcome,
      req.body.notes
    );
    return res.success(
      "Activity outcome updated successfully.",
      { activity: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update activity outcome");
  }
};
