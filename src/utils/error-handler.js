class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Creates a 400 Bad Request error
 * @param {string} message - Error message
 * @returns {AppError} Error object
 */
const badRequest = (message = "Bad Request") => {
  return new AppError(message, 400);
};

/**
 * Creates a 401 Unauthorized error
 * @param {string} message - Error message
 * @returns {AppError} Error object
 */
const unauthorized = (message = "Unauthorized") => {
  return new AppError(message, 401);
};

/**
 * Creates a 403 Forbidden error
 * @param {string} message - Error message
 * @returns {AppError} Error object
 */
const forbidden = (message = "Forbidden") => {
  return new AppError(message, 403);
};

/**
 * Creates a 404 Not Found error
 * @param {string} message - Error message
 * @returns {AppError} Error object
 */
const notFound = (message = "Resource Not Found") => {
  return new AppError(message, 404);
};

/**
 * Creates a 409 Conflict error
 * @param {string} message - Error message
 * @returns {AppError} Error object
 */
const conflict = (message = "Conflict") => {
  return new AppError(message, 409);
};

/**
 * Creates a 500 Internal Server Error
 * @param {string} message - Error message
 * @returns {AppError} Error object
 */
const serverError = (message = "Internal Server Error") => {
  return new AppError(message, 500);
};

/**
 * Async error handler - eliminates need for try/catch in controllers
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
  catchAsync,
};
