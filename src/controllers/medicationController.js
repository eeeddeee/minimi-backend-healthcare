import { StatusCodes } from "http-status-codes";
import * as medicationService from "../services/medicationService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";
import MedicationReminder from "../models/medicationReminderModel.js";

const errorResponse = (res, error, fallback = "Something went wrong") =>
  res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || fallback
  });

// POST /medications/reminders
export const createReminder = async (req, res) => {
  try {
    const body = req.body;

    // RBAC: user must have access to this patient
    await ensureAccessToPatient(req.user, body.patientId);

    const reminder = await medicationService.createReminder(
      {
        patientId: body.patientId,
        medicationName: body.medicationName,
        dosage: body.dosage,
        notes: body.notes,
        frequency: body.frequency,
        specificTimes: body.specificTimes || [],
        startDate: body.startDate,
        endDate: body.endDate,
        status: body.status || "active"
      },
      req.user._id
    );

    return res.success(
      "Medication reminder created successfully.",
      { reminder },
      StatusCodes.CREATED
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to create medication reminder");
  }
};

// GET /medications/reminders?patientId=&status=&from=&to=&page=&limit=
export const getReminders = async (req, res) => {
  try {
    const { patientId, status, from, to, page = 1, limit = 10 } = req.query;

    // RBAC: access check
    await ensureAccessToPatient(req.user, patientId);

    const result = await medicationService.getReminders(
      { patientId, status, from, to },
      parseInt(page),
      parseInt(limit)
    );

    return res.success(
      "Medication reminders fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch medication reminders");
  }
};

// GET /medications/reminders/:id
export const getReminder = async (req, res) => {
  try {
    const { reminder } = await medicationService.getReminderById(req.params.id);
    // check access to reminder.patientId
    await ensureAccessToPatient(req.user, reminder.patientId);

    return res.success(
      "Medication reminder fetched successfully.",
      { reminder },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch medication reminder");
  }
};

// PATCH /medications/reminders/:id
export const updateReminder = async (req, res) => {
  try {
    const { reminder } = await medicationService.getReminderById(req.params.id);
    await ensureAccessToPatient(req.user, reminder.patientId);

    const updated = await medicationService.updateReminder(
      req.params.id,
      req.body
    );
    return res.success(
      "Medication reminder updated successfully.",
      { reminder: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update medication reminder");
  }
};

// PATCH /medications/reminders/:id/status
export const updateReminderStatus = async (req, res) => {
  try {
    const { reminder } = await medicationService.getReminderById(req.params.id);
    await ensureAccessToPatient(req.user, reminder.patientId);

    const updated = await medicationService.updateReminderStatus(
      req.params.id,
      req.body.status
    );
    return res.success(
      "Medication reminder status updated successfully.",
      { reminder: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update medication status");
  }
};

// POST /medications/reminders/:id/logs
export const addReminderLog = async (req, res) => {
  try {
    const { reminder } = await medicationService.getReminderById(req.params.id);
    await ensureAccessToPatient(req.user, reminder.patientId);

    const log = await medicationService.addReminderLog(
      req.params.id,
      req.body,
      req.user._id
    );
    return res.success(
      "Medication log added successfully.",
      { log },
      StatusCodes.CREATED
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to add medication log");
  }
};

// GET /medications/reminders/:id/logs?status=&from=&to=&page=&limit=
export const getReminderLogs = async (req, res) => {
  try {
    const { reminder } = await medicationService.getReminderById(req.params.id);
    await ensureAccessToPatient(req.user, reminder.patientId);

    const { status, from, to, page = 1, limit = 10 } = req.query;
    const result = await medicationService.getReminderLogs(req.params.id, {
      status,
      from,
      to,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    return res.success(
      "Medication logs fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch medication logs");
  }
};

// PATCH /medications/reminder-logs/:logId
export const updateReminderLog = async (req, res) => {
  try {
    // to check access, we need the parent reminder; find it by logId
    // quick lookup:
    // find reminder containing the log -> authorize -> update
    const parent = await MedicationReminder.findOne(
      { "logs._id": req.params.logId },
      { patientId: 1 }
    ).lean();

    if (!parent) {
      return errorResponse(res, {
        statusCode: StatusCodes.NOT_FOUND,
        message: "Medication log not found"
      });
    }

    await ensureAccessToPatient(req.user, parent.patientId);

    const log = await medicationService.updateReminderLog(
      req.params.logId,
      req.body
    );
    return res.success(
      "Medication log updated successfully.",
      { log },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update medication log");
  }
};
