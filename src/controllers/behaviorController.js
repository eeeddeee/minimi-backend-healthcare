// controllers/behaviorController.js
import { StatusCodes } from "http-status-codes";
import * as behaviorService from "../services/behaviorService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";

const errorResponse = (res, error, fallback) =>
  res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || fallback
  });

// POST /behavior-logs
export const createBehaviorLog = async (req, res) => {
  try {
    // RBAC: only nurse/caregiver/hospital/super_admin will reach here (routes)
    await ensureAccessToPatient(req.user, req.body.patientId);

    // caregiverId should be current user (nurse/caregiver) typically; but schema allows passing explicitly.
    const payload = { ...req.body };
    if (!payload.caregiverId) payload.caregiverId = req.user._id;

    const log = await behaviorService.createBehaviorLog(payload, req.user._id);
    return res.success(
      "Behavior log created successfully.",
      { log },
      StatusCodes.CREATED
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to create behavior log");
  }
};

// GET /behavior-logs?patientId=&mood=&incidentType=&severityMin=&severityMax=&from=&to=&page=&limit=
export const getBehaviorLogs = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.query.patientId);
    const result = await behaviorService.getBehaviorLogs(
      req.query,
      parseInt(req.query.page),
      parseInt(req.query.limit)
    );
    return res.success(
      "Behavior logs fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch behavior logs");
  }
};

// GET /behavior-logs/:id
export const getBehaviorLog = async (req, res) => {
  try {
    const { log } = await behaviorService.getBehaviorLogById(req.params.id);
    await ensureAccessToPatient(req.user, log.patientId);
    return res.success(
      "Behavior log fetched successfully.",
      { log },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch behavior log");
  }
};

// PATCH /behavior-logs/:id
export const updateBehaviorLog = async (req, res) => {
  try {
    const { log } = await behaviorService.getBehaviorLogById(req.params.id);
    await ensureAccessToPatient(req.user, log.patientId);

    const updated = await behaviorService.updateBehaviorLog(
      req.params.id,
      req.body
    );
    return res.success(
      "Behavior log updated successfully.",
      { log: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update behavior log");
  }
};

export const addIncident = async (req, res) => {
  try {
    const { log } = await behaviorService.getBehaviorLogById(req.params.id);
    await ensureAccessToPatient(req.user, log.patientId);

    const updated = await behaviorService.addIncidentToBehaviorLog(
      req.params.id,
      req.body,
      req.user._id
    );
    return res.success(
      "Incident added successfully.",
      { log: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to add incident");
  }
};

export const updateIncident = async (req, res) => {
  try {
    const { log } = await behaviorService.getBehaviorLogById(req.params.id);
    await ensureAccessToPatient(req.user, log.patientId);

    const updated = await behaviorService.updateIncidentInBehaviorLog(
      req.params.id,
      req.params.incidentId,
      req.body,
      req.user._id
    );
    return res.success(
      "Incident updated successfully.",
      { log: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update incident");
  }
};

// Similar for meals
export const addMeal = async (req, res) => {
  try {
    const { log } = await behaviorService.getBehaviorLogById(req.params.id);
    await ensureAccessToPatient(req.user, log.patientId);

    const updated = await behaviorService.addMealToBehaviorLog(
      req.params.id,
      req.body,
      req.user._id
    );
    return res.success(
      "Meal added successfully.",
      { log: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to add meal");
  }
};

export const updateMeal = async (req, res) => {
  try {
    const { log } = await behaviorService.getBehaviorLogById(req.params.id);
    await ensureAccessToPatient(req.user, log.patientId);

    const updated = await behaviorService.updateMealInBehaviorLog(
      req.params.id,
      req.params.mealId,
      req.body,
      req.user._id
    );
    return res.success(
      "Meal updated successfully.",
      { log: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update meal");
  }
};

// Similar for activities
export const addActivity = async (req, res) => {
  try {
    const { log } = await behaviorService.getBehaviorLogById(req.params.id);
    await ensureAccessToPatient(req.user, log.patientId);

    const updated = await behaviorService.addActivityToBehaviorLog(
      req.params.id,
      req.body,
      req.user._id
    );
    return res.success(
      "Activity added successfully.",
      { log: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to add activity");
  }
};

export const updateActivity = async (req, res) => {
  try {
    const { log } = await behaviorService.getBehaviorLogById(req.params.id);
    await ensureAccessToPatient(req.user, log.patientId);

    const updated = await behaviorService.updateActivityInBehaviorLog(
      req.params.id,
      req.params.activityId,
      req.body,
      req.user._id
    );
    return res.success(
      "Activity updated successfully.",
      { log: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update activity");
  }
};