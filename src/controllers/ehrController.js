import { StatusCodes } from "http-status-codes";
import * as ehrService from "../services/ehrService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";

const err = (res, e, m) =>
  res
    .status(e.statusCode || 500)
    .json({ success: false, message: e.message || m });

export const exportFhir = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.params.patientId);
    const data = await ehrService.exportPatientFhir(req.params.patientId);
    return res.success("FHIR bundle exported.", data, StatusCodes.OK);
  } catch (e) {
    return err(res, e, "Failed to export FHIR");
  }
};

export const importFhir = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.params.patientId);
    const data = await ehrService.importPatientFhir(
      req.params.patientId,
      req.body.bundle,
      req.user._id
    );
    return res.success("FHIR import processed.", data, StatusCodes.OK);
  } catch (e) {
    return err(res, e, "Failed to import FHIR");
  }
};
