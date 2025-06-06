const { validationResult, check } = require("express-validator");

// Middleware to handle validation errors
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      errors: errors.array(),
    });
  }

  next();
};

// Validation rules for availability
const availabilityValidationRules = [
  check("dayOfWeek")
    .isInt({ min: 0, max: 6 })
    .withMessage("Day of week must be between 0 (Sunday) and 6 (Saturday)"),

  check("startTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
    .withMessage("Start time must be in format HH:MM:SS"),

  check("endTime")
    .matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/)
    .withMessage("End time must be in format HH:MM:SS")
    .custom((value, { req }) => {
      if (value <= req.body.startTime) {
        throw new Error("End time must be after start time");
      }
      return true;
    }),

  check("isRecurring")
    .isBoolean()
    .withMessage("isRecurring must be a boolean value"),

  check("specificDate")
    .optional()
    .isDate()
    .withMessage("Specific date must be a valid date"),
];

// Validation rules for bookings
const bookingValidationRules = [
  check("tutorId").isUUID(4).withMessage("Tutor ID must be a valid UUID"),

  check("startTime")
    .isISO8601()
    .withMessage("Start time must be a valid ISO8601 date"),

  check("endTime")
    .isISO8601()
    .withMessage("End time must be a valid ISO8601 date")
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startTime)) {
        throw new Error("End time must be after start time");
      }
      return true;
    }),

  check("title")
    .isLength({ min: 2, max: 100 })
    .withMessage("Title must be between 2 and 100 characters"),

  check("description")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Description must be less than 500 characters"),
];

module.exports = {
  validateRequest,
  availabilityValidationRules,
  bookingValidationRules,
};
