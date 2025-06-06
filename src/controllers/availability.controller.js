const { Availability, User } = require("../models");
const { success } = require("../utils/response-formatter");
const {
  catchAsync,
  notFound,
  badRequest,
  forbidden,
} = require("../utils/error-handler");
const { Op } = require("sequelize");

/**
 * Helper function to convert day number (0-6) to day name
 * @param {number} dayOfWeek - Day of week (0=Sunday, 6=Saturday)
 * @returns {string} Day name
 */
function getDayName(dayOfWeek) {
  const days = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];
  return days[dayOfWeek] || "Unknown";
}

/**
 * Create a new availability slot
 */
const createAvailability = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const providerName = req.user.fullName;
  const providerRole = req.user.role;

  // Check if user is authorized to create availability
  if (!["tutor", "counselor"].includes(providerRole)) {
    throw forbidden("Only tutors and counselors can set availability");
  }

  // Handle both single objects and arrays
  const availabilityItems = Array.isArray(req.body) ? req.body : [req.body];

  if (availabilityItems.length === 0) {
    throw badRequest("No availability slots provided");
  }

  const itemsToCreate = [];

  for (const item of availabilityItems) {
    const {
      dayOfWeek,
      startTime,
      endTime,
      isAvailable = true,
      recurrence = "weekly",
    } = item;

    // Validate day of week - careful with zero!
    if (
      dayOfWeek === undefined ||
      dayOfWeek === null ||
      dayOfWeek < 0 ||
      dayOfWeek > 6
    ) {
      throw badRequest(
        `Valid day of week (0-6) is required for slot ${startTime}-${endTime}`
      );
    }

    if (!startTime || !endTime) {
      throw badRequest("Start time and end time are required for all slots");
    }

    // Validate time format and range
    try {
      // Basic time format validation (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        throw new Error("Time format must be HH:MM");
      }

      // Compare times
      const [startHour, startMin] = startTime.split(":").map(Number);
      const [endHour, endMin] = endTime.split(":").map(Number);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      if (endMinutes <= startMinutes) {
        throw new Error("End time must be after start time");
      }
    } catch (error) {
      throw badRequest(`Invalid time format: ${error.message}`);
    }

    // Check for overlapping slots on the same day
    const existingSlots = await Availability.findAll({
      where: {
        userId,
        dayOfWeek: dayOfWeek,
        isAvailable: true,
      },
    });

    // Check for time overlaps
    for (const existing of existingSlots) {
      // Parse existing times
      const [existingStartHour, existingStartMin] = existing.startTime
        .split(":")
        .map(Number);
      const [existingEndHour, existingEndMin] = existing.endTime
        .split(":")
        .map(Number);

      // Convert to minutes for easier comparison
      const existingStartMinutes = existingStartHour * 60 + existingStartMin;
      const existingEndMinutes = existingEndHour * 60 + existingEndMin;

      // Parse new slot times
      const [newStartHour, newStartMin] = startTime.split(":").map(Number);
      const [newEndHour, newEndMin] = endTime.split(":").map(Number);

      const newStartMinutes = newStartHour * 60 + newStartMin;
      const newEndMinutes = newEndHour * 60 + newEndMin;

      // Check for overlap
      // Slots overlap if one starts before the other ends
      if (
        (newStartMinutes < existingEndMinutes &&
          newEndMinutes > existingStartMinutes) ||
        (existingStartMinutes < newEndMinutes &&
          existingEndMinutes > newStartMinutes) ||
        (newStartMinutes === existingStartMinutes &&
          newEndMinutes === existingEndMinutes)
      ) {
        throw badRequest(
          `Cannot create overlapping availability slot on ${getDayName(
            dayOfWeek
          )} at ${startTime}-${endTime}. ` +
            `You already have a slot from ${existing.startTime} to ${existing.endTime}.`
        );
      }
    }

    // Add to creation array if no overlaps
    itemsToCreate.push({
      userId,
      providerName,
      providerRole,
      dayOfWeek,
      startTime,
      endTime,
      isAvailable,
      recurrence,
    });
  }

  // Bulk create all slots
  const createdItems = await Availability.bulkCreate(itemsToCreate);

  res
    .status(201)
    .json(
      success(
        createdItems,
        `${createdItems.length} availability slot(s) created successfully`
      )
    );
});

/**
 * Get availability for a specific provider (tutor/counselor)
 */
const getProviderAvailability = catchAsync(async (req, res) => {
  const { providerId } = req.params;
  // Add this validation
  if (!providerId) {
    throw badRequest("Provider ID is required");
  }
  // Ensure provider exists and has the right role
  const provider = await User.findOne({
    where: {
      id: providerId,
      role: {
        [Op.in]: ["tutor", "counselor"],
      },
    },
  });

  if (!provider) {
    throw notFound("Provider not found or is not a tutor/counselor");
  }

  // Get availability slots
  const availabilities = await Availability.findAll({
    where: {
      userId: providerId,
      isAvailable: true,
    },
    order: [
      ["dayOfWeek", "ASC"],
      ["startTime", "ASC"],
    ],
  });

  res.json(
    success(
      {
        provider: {
          id: provider.id,
          name: provider.fullName,
          role: provider.role,
        },
        availabilities,
      },
      "Provider availability retrieved successfully"
    )
  );
});

/**
 * Update an availability slot
 */
const updateAvailability = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const providerRole = req.user.role;

  // Check if user is authorized to update availability
  if (!["tutor", "counselor"].includes(providerRole)) {
    throw forbidden("Only tutors and counselors can update availability");
  }

  // Find the availability slot
  const availability = await Availability.findByPk(id);

  if (!availability) {
    throw notFound("Availability slot not found");
  }

  // Check ownership
  if (availability.userId !== userId) {
    throw forbidden("You can only update your own availability slots");
  }

  const { dayOfWeek, startTime, endTime, isAvailable, recurrence } = req.body;

  // Update the slot
  const updates = {};

  if (dayOfWeek !== undefined && dayOfWeek >= 0 && dayOfWeek <= 6) {
    updates.dayOfWeek = dayOfWeek;
  }

  if (startTime) {
    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(startTime)) {
      throw badRequest("Start time format must be HH:MM");
    }
    updates.startTime = startTime;
  }

  if (endTime) {
    // Validate time format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(endTime)) {
      throw badRequest("End time format must be HH:MM");
    }
    updates.endTime = endTime;
  }

  // If both start and end times are provided, validate end is after start
  if (updates.startTime && updates.endTime) {
    const [startHour, startMin] = updates.startTime.split(":").map(Number);
    const [endHour, endMin] = updates.endTime.split(":").map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      throw badRequest("End time must be after start time");
    }
  } else if (updates.startTime) {
    // Check against existing end time
    const existingEndTime = availability.endTime;
    const [startHour, startMin] = updates.startTime.split(":").map(Number);
    const [endHour, endMin] = existingEndTime.split(":").map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      throw badRequest("New start time would be after existing end time");
    }
  } else if (updates.endTime) {
    // Check against existing start time
    const existingStartTime = availability.startTime;
    const [startHour, startMin] = existingStartTime.split(":").map(Number);
    const [endHour, endMin] = updates.endTime.split(":").map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      throw badRequest("New end time would be before existing start time");
    }
  }

  if (isAvailable !== undefined) {
    updates.isAvailable = Boolean(isAvailable);
  }

  if (
    recurrence &&
    ["one-time", "weekly", "biweekly", "monthly"].includes(recurrence)
  ) {
    updates.recurrence = recurrence;
  }

  await availability.update(updates);

  res.json(success(availability, "Availability updated successfully"));
});

/**
 * Delete an availability slot
 */
const deleteAvailability = catchAsync(async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const providerRole = req.user.role;

  // Check if user is authorized to delete availability
  if (!["tutor", "counselor"].includes(providerRole)) {
    throw forbidden("Only tutors and counselors can delete availability");
  }

  const availability = await Availability.findByPk(id);

  if (!availability) {
    throw notFound("Availability slot not found");
  }

  // Check ownership
  if (availability.userId !== userId) {
    throw forbidden("You can only delete your own availability slots");
  }

  await availability.destroy();

  res.json(success(null, "Availability deleted successfully"));
});

/**
 * Get current provider's availability
 */
const getMyAvailability = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const providerRole = req.user.role;

  // Check if user is authorized to view availability
  if (!["tutor", "counselor"].includes(providerRole)) {
    throw forbidden("Only tutors and counselors can view their availability");
  }

  const availabilities = await Availability.findAll({
    where: { userId },
    order: [
      ["dayOfWeek", "ASC"],
      ["startTime", "ASC"],
    ],
  });

  res.json(success(availabilities, "Your availability retrieved successfully"));
});

/**
 * Get all providers with their availability
 */
const getAllProvidersAvailability = catchAsync(async (req, res) => {
  const providers = await User.findAll({
    where: {
      role: {
        [Op.in]: ["tutor", "counselor"],
      },
    },
    attributes: ["id", "fullName", "role"],
    include: [
      {
        model: Availability,
        as: "availabilities",
        where: { isAvailable: true },
        required: false,
      },
    ],
  });

  res.json(
    success(providers, "All providers with availability retrieved successfully")
  );
});

const getTutorAvailability = getProviderAvailability;

module.exports = {
  createAvailability,
  getProviderAvailability,
  getTutorAvailability,
  updateAvailability,
  deleteAvailability,
  getMyAvailability,
  getAllProvidersAvailability,
};
