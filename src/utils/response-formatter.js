/**
 * Formats a success response
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @returns {Object} Formatted response
 */
const success = (data, message = "Success") => {
  return {
    success: true,
    message,
    data,
  };
};

/**
 * Formats a paginated response
 * @param {Array} data - Array of items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @param {number} total - Total count of items
 * @param {string} message - Success message
 * @returns {Object} Formatted paginated response
 */
const paginated = (data, page, limit, total, message = "Success") => {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    message,
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Formats an error response
 * @param {string} message - Error message
 * @param {Array} errors - Array of error details
 * @returns {Object} Formatted error response
 */
const error = (message = "Error", errors = null) => {
  return {
    success: false,
    message,
    errors,
  };
};

module.exports = {
  success,
  paginated,
  error,
};
