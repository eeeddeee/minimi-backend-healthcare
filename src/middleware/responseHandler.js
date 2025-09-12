import { StatusCodes } from "http-status-codes";

export default function responseHandler(req, res, next) {
  res.success = (
    message = "Success",
    data = null,
    statusCode = StatusCodes.OK
  ) => {
    res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data
    });
  };

  res.error = (
    message = "Something went wrong",
    statusCode = StatusCodes.INTERNAL_SERVER_ERROR,
    error = null
  ) => {
    res.status(statusCode).json({
      success: false,
      statusCode,
      message,
      error
    });
  };

  next();
}
