import { StatusCodes } from "http-status-codes";
import * as pharmacyService from "../services/pharmacyService.js";
import { ensureAccessToPatient } from "../utils/accessControl.js";

const err = (res, e, msg) =>
  res
    .status(e.statusCode || 500)
    .json({ success: false, message: e.message || msg });

export const searchMeds = async (req, res) => {
  try {
    const data = await pharmacyService.searchMeds(req.query);
    return res.success("Meds search results.", data, StatusCodes.OK);
  } catch (e) {
    return err(res, e, "Search failed");
  }
};

export const createOrder = async (req, res) => {
  try {
    await ensureAccessToPatient(req.user, req.body.patientId);
    const order = await pharmacyService.createPrescriptionOrder(
      req.body,
      req.user._id
    );
    return res.success(
      "Prescription order created.",
      { order },
      StatusCodes.CREATED
    );
  } catch (e) {
    return err(res, e, "Failed to create order");
  }
};

export const getOrder = async (req, res) => {
  try {
    const { order } = await pharmacyService.getOrderById(req.params.id);
    await ensureAccessToPatient(req.user, order.patientId);
    return res.success(
      "Prescription order fetched.",
      { order },
      StatusCodes.OK
    );
  } catch (e) {
    return err(res, e, "Failed to fetch order");
  }
};
