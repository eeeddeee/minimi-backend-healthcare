import * as incidentService from "../services/incidentService.js";
import { StatusCodes } from "http-status-codes";
import { uploadBufferToS3, buildMessageKey } from "../utils/s3.js";
import { mapMimeToAttachmentType } from "../middleware/attachmentUploadMiddleware.js";

export const createIncident = async (req, res) => {
  try {
    const { patientId, type, description, severity, actionTaken, occurredAt } =
      req.body;
    const incident = await incidentService.createIncident(
      { patientId, type, description, severity, actionTaken, occurredAt },
      req.user._id
    );
    return res.success(
      "Incident reported successfully.",
      { incident },
      StatusCodes.CREATED
    );
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getIncidents = async (req, res) => {
  try {
    const filters = {};
    if (req.query.patientId) filters.patientId = req.query.patientId;
    if (req.query.status) filters.status = req.query.status;
    if (req.query.severity) filters.severity = Number(req.query.severity);
    const result = await incidentService.getIncidents(
      filters,
      parseInt(req.query.page || 1),
      parseInt(req.query.limit || 10)
    );
    return res.success(
      "Incidents fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const getIncident = async (req, res) => {
  try {
    const incident = await incidentService.getIncidentById(req.params.id);
    return res.success(
      "Incident fetched successfully.",
      { incident },
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateIncident = async (req, res) => {
  try {
    const updated = await incidentService.updateIncident(
      req.params.id,
      req.body,
      req.user._id
    );
    return res.success(
      "Incident updated successfully.",
      { updated },
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const updateIncidentStatus = async (req, res) => {
  try {
    const updated = await incidentService.updateIncidentStatus(
      req.params.id,
      req.body.status,
      req.user._id
    );
    return res.success(
      "Incident status updated successfully.",
      { updated },
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};

export const addAttachments = async (req, res) => {
  try {
    const files = req.files || [];
    if (!files.length)
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: "No files uploaded" });

    const attachments = [];
    for (const f of files) {
      const key = buildMessageKey(`incident-${req.params.id}`, f.originalname);
      await uploadBufferToS3({
        buffer: f.buffer,
        key,
        contentType: f.mimetype
      });
      attachments.push({
        type: mapMimeToAttachmentType(f.mimetype),
        key,
        originalName: f.originalname,
        size: f.size,
        mimeType: f.mimetype
      });
    }
    const updated = await incidentService.addAttachments(
      req.params.id,
      attachments,
      req.user._id
    );
    return res.success(
      "Attachments added successfully.",
      { updated },
      StatusCodes.OK
    );
  } catch (error) {
    return res
      .status(error.statusCode || 500)
      .json({ success: false, message: error.message });
  }
};
