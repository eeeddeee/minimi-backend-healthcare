// controllers/reportController.js
import { StatusCodes } from "http-status-codes";
import * as reportService from "../services/reportService.js";
import { exportReportToPdf } from "../services/reportExportService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";
import Report from "../models/patientReportModel.js";

const errorResponse = (res, error, fallback) =>
  res.status(error.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: error.message || fallback
  });

// POST /reports  (auto-generate content from period)
export const createReport = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.body.patientId);
    const report = await reportService.createReport(req.body, req.user._id);
    return res.success(
      "Report generated successfully.",
      { report },
      StatusCodes.CREATED
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to create report");
  }
};

// GET /reports?patientId=&from=&to=&page=&limit=
export const getReports = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.query.patientId);
    const result = await reportService.getReports(
      req.query,
      parseInt(req.query.page),
      parseInt(req.query.limit)
    );
    return res.success("Reports fetched successfully.", result, StatusCodes.OK);
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch reports");
  }
};

// GET /reports/:id
export const getReport = async (req, res) => {
  try {
    const { report } = await reportService.getReportById(req.params.id);
    await ensureAccessToPatient(req.user, report.patientId);
    return res.success(
      "Report fetched successfully.",
      { report },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to fetch report");
  }
};

// PATCH /reports/:id
export const updateReport = async (req, res) => {
  try {
    const { report } = await reportService.getReportById(req.params.id);
    await ensureAccessToPatient(req.user, report.patientId);
    const updated = await reportService.updateReport(
      req.params.id,
      req.body,
      req.user._id
    );
    return res.success(
      "Report updated successfully.",
      { report: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to update report");
  }
};

// PATCH /reports/:id/share
export const shareReport = async (req, res) => {
  try {
    const { report } = await reportService.getReportById(req.params.id);
    await ensureAccessToPatient(req.user, report.patientId);
    const updated = await reportService.shareReport(
      req.params.id,
      req.body.sharedWith,
      req.user._id
    );
    return res.success(
      "Report shared successfully.",
      { report: updated },
      StatusCodes.OK
    );
  } catch (error) {
    return errorResponse(res, error, "Failed to share report");
  }
};

// GET /reports/:id/export (PDF → S3)
export const exportReport = async (req, res) => {
  try {
    // Only those with access to report/patient
    const { report } = await reportService.getReportById(req.params.id);
    await ensureAccessToPatient(req.user, report.patientId);

    const result = await exportReportToPdf(req.params.id);
    return res.success("Report exported as PDF.", result, StatusCodes.OK);
  } catch (error) {
    return errorResponse(res, error, "Failed to export report");
  }
};
