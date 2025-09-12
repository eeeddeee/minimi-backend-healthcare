import Joi from "joi";

export default function validate(validationSchema = {}) {
  return (req, res, next) => {
    let validationError = null;

    if (validationSchema.body) {
      const { error } = validationSchema.body.validate(req.body);
      if (error) validationError = error;
    }

    if (!validationError && validationSchema.params) {
      const { error } = validationSchema.params.validate(req.params);
      if (error) validationError = error;
    }

    if (!validationError && validationSchema.query) {
      const { error } = validationSchema.query.validate(req.query);
      if (error) validationError = error;
    }

    if (validationError) {
      const errorMessages = validationError.details.map(
        (detail) => detail.message
      );
      return res.status(400).json({
        message: "Validation failed",
        errors: errorMessages
      });
    }
    next();
  };
}