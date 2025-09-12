import { StatusCodes } from "http-status-codes";
import * as systemLogService from "../services/systemLogService.js";

const err = (res, e, m) =>
  res.status(e.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: e.message || m
  });

export const getLogs = async (req, res) => {
  try {
    const result = await systemLogService.getLogs(
      req.query,
      parseInt(req.query.page),
      parseInt(req.query.limit)
    );
    return res.success(
      "System logs fetched successfully.",
      result,
      StatusCodes.OK
    );
  } catch (e) {
    return err(res, e, "Failed to fetch system logs");
  }
};

export const getLog = async (req, res) => {
  try {
    const data = await systemLogService.getLogById(req.params.id);
    return res.success(
      "System log fetched successfully.",
      data,
      StatusCodes.OK
    );
  } catch (e) {
    return err(res, e, "Failed to fetch system log");
  }
};
