import { StatusCodes } from "http-status-codes";
import * as dailyJournalService from "../services/dailyJournalService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";

const errorResponse = (res, error, fallback) =>
  res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || fallback
  });

// POST /daily-journals
export const createJournal = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.body.patientId);
    const journal = await dailyJournalService.createJournal(
      req.body,
      req.user._id
    );
    return res.success(
      "Daily journal created successfully.",
      { journal },
      StatusCodes.CREATED
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to create daily journal");
  }
};

// GET /daily-journals?patientId=&from=&to=&mood=&page=&limit=
export const getJournals = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.query.patientId);
    const result = await dailyJournalService.getJournals(
      req.query,
      parseInt(req.query.page),
      parseInt(req.query.limit)
    );
    return res.success(
      "Daily journals fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch daily journals");
  }
};

// GET /daily-journals/:id
export const getJournal = async (req, res) => {
  try {
    const { journal } = await dailyJournalService.getJournalById(req.params.id);
    await ensureAccessToPatient(req.user, journal.patientId);
    return res.success(
      "Daily journal fetched successfully.",
      { journal },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch daily journal");
  }
};

// PATCH /daily-journals/:id
export const updateJournal = async (req, res) => {
  try {
    const { journal } = await dailyJournalService.getJournalById(req.params.id);
    await ensureAccessToPatient(req.user, journal.patientId);

    const updated = await dailyJournalService.updateJournal(
      req.params.id,
      req.body,
      req.user._id
    );
    return res.success(
      "Daily journal updated successfully.",
      { journal: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update daily journal");
  }
};

// DELETE /daily-journals/:id (soft delete)
export const deleteJournal = async (req, res) => {
  try {
    const { journal } = await dailyJournalService.getJournalById(req.params.id);
    await ensureAccessToPatient(req.user, journal.patientId);

    const deleted = await dailyJournalService.softDeleteJournal(
      req.params.id,
      req.user._id
    );
    return res.success(
      "Daily journal deleted successfully.",
      { journal: deleted },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to delete daily journal");
  }
};

// --- Incremental sub-updates ---

export const addActivity = async (req, res) => {
  try {
    const { journal } = await dailyJournalService.getJournalById(req.params.id);
    await ensureAccessToPatient(req.user, journal.patientId);

    const updated = await dailyJournalService.addActivityToJournal(
      req.params.id,
      req.body,
      req.user._id
    );
    return res.success(
      "Activity added to journal.",
      { journal: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to add activity");
  }
};

export const updateActivity = async (req, res) => {
  try {
    const { journal } = await dailyJournalService.getJournalById(req.params.id);
    await ensureAccessToPatient(req.user, journal.patientId);

    const updated = await dailyJournalService.updateActivityInJournal(
      req.params.id,
      req.params.activityId,
      req.body,
      req.user._id
    );
    return res.success(
      "Activity updated in journal.",
      { journal: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update activity");
  }
};

export const addNote = async (req, res) => {
  try {
    const { journal } = await dailyJournalService.getJournalById(req.params.id);
    await ensureAccessToPatient(req.user, journal.patientId);

    const updated = await dailyJournalService.addNoteToJournal(
      req.params.id,
      req.body.text,
      req.user._id
    );
    return res.success(
      "Note added to journal.",
      { journal: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to add note");
  }
};

export const updateNote = async (req, res) => {
  try {
    const { journal } = await dailyJournalService.getJournalById(req.params.id);
    await ensureAccessToPatient(req.user, journal.patientId);

    const updated = await dailyJournalService.updateNoteInJournal(
      req.params.id,
      req.params.noteId,
      req.body.text,
      req.user._id
    );
    return res.success(
      "Note updated in journal.",
      { journal: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update note");
  }
};
