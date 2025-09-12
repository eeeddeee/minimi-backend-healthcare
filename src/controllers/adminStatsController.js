import { StatusCodes } from "http-status-codes";
import * as adminStatsService from "../services/adminStatsService.js";

const err = (res, e, m) =>
  res.status(e.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({
    success: false,
    message: e.message || m
  });

// GET /admin/stats/overview
export const getOverview = async (req, res) => {
  try {
    const data = await adminStatsService.getOverview(req.query || {});
    return res.success(
      "Admin stats fetched successfully.",
      data,
      StatusCodes.OK
    );
  } catch (e) {
    return err(res, e, "Failed to fetch admin stats");
  }
};
