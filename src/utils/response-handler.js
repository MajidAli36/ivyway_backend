/**
 * Standard success response format
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @returns {Object} Formatted response object
 */
const success = (data, message = "Operation successful") => {
  return {
    status: "success",
    message,
    data,
  };
};

/**
 * Standard error response format
 * @param {string} message - Error message
 * @param {*} errors - Optional error details
 * @returns {Object} Formatted error object
 */
const error = (message = "An error occurred", errors = null) => {
  return {
    status: "error",
    message,
    errors,
  };
};

module.exports = {
  success,
  error,
};