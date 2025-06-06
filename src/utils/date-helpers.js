/**
 * Converts a time string to minutes since midnight
 * @param {string} timeString - Time in format HH:MM:SS
 * @returns {number} Minutes since midnight
 */
const timeToMinutes = (timeString) => {
  // Handle both HH:MM:SS and HH:MM formats
  const parts = timeString.split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
};

/**
 * Checks if two time ranges overlap
 * @param {string} startTime1 - First range start time (HH:MM:SS or HH:MM)
 * @param {string} endTime1 - First range end time (HH:MM:SS or HH:MM)
 * @param {string} startTime2 - Second range start time (HH:MM:SS or HH:MM)
 * @param {string} endTime2 - Second range end time (HH:MM:SS or HH:MM)
 * @returns {boolean} True if ranges overlap
 */
const timeRangesOverlap = (startTime1, endTime1, startTime2, endTime2) => {
  const start1 = timeToMinutes(startTime1);
  const end1 = timeToMinutes(endTime1);
  const start2 = timeToMinutes(startTime2);
  const end2 = timeToMinutes(endTime2);

  return start1 < end2 && start2 < end1;
};

/**
 * Gets the day of week (0-6) from a date
 * @param {Date|string} date - Date object or ISO string
 * @returns {number} Day of week (0 = Sunday, 6 = Saturday)
 */
const getDayOfWeek = (date) => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.getDay();
};

/**
 * Normalizes a time string to HH:MM:SS format
 * @param {string} timeString - Time string (HH:MM or HH:MM:SS)
 * @returns {string} Normalized time string (HH:MM:SS)
 */
const normalizeTimeString = (timeString) => {
  if (!timeString) return null;
  
  // If already in HH:MM:SS format
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeString)) {
    return timeString;
  }
  
  // If in HH:MM format
  if (/^\d{2}:\d{2}$/.test(timeString)) {
    return `${timeString}:00`;
  }
  
  return timeString;
};

/**
 * Converts a date and time to a consistent ISO string
 * @param {string|Date} date - Date or date string
 * @param {string} time - Time string (HH:MM or HH:MM:SS)
 * @returns {string} ISO date string
 */
const dateTimeToISOString = (date, time) => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const [hours, minutes] = time.split(':').map(Number);
  
  const newDate = new Date(dateObj);
  newDate.setHours(hours, minutes, 0, 0);
  
  return newDate.toISOString();
};

module.exports = {
  timeToMinutes,
  timeRangesOverlap,
  getDayOfWeek,
  normalizeTimeString,
  dateTimeToISOString
};
